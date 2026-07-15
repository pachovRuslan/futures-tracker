import crypto from "crypto";
import type { SyncedTrade } from "../types";
import type { ExchangeAdapter, ExchangeCredentials } from "./types";

const BASE_URL = "https://fapi.bitunix.com";

interface BitunixPosition {
  positionId: string;
  symbol: string;
  maxQty: string;
  entryPrice: string;
  closePrice: string;
  // Bitunix отдаёт side в разных форматах в зависимости от версии API:
  //   "LONG" / "SHORT"  — документированный формат
  //   "long" / "short"  — lowercase (некоторые эндпоинты)
  //   "BUY" / "SELL"    — side ордера (не позиции)
  //   1 / 2             — числовой формат (1=Long, 2=Short)
  //   "openLong" / "openShort" / "closeLong" / "closeShort" — расширенный
  // Делаем тип string и нормализуем через normalizeSide.
  side: string;
  fee: string;
  funding: string;
  realizedPNL: string;
  ctime: number; // ms epoch — открытие
  mtime: number; // ms epoch — последнее изменение/закрытие
}

/**
 * Нормализация side из ответа Bitunix в наш union "long" | "short".
 *
 * ВАЖНОЕ УТОЧНЕНИЕ после сопоставления с реальными сделками пользователя:
 *
 * Bitunix /api/v1/futures/position/get_history_positions возвращает side
 * ОТКРЫВАЮЩЕГО ордера (стандартная конвенция), а не закрывающего:
 *   - BUY  = открыли LONG позицию  → side должно быть "long"
 *   - SELL = открыли SHORT позицию → side должно быть "short"
 *
 * Это отличается от Bybit, где side = закрывающий ордер (там инверсия).
 *
 * Подтверждение данными пользователя (сопоставление с интерфейсом Bitunix):
 *   - GWEIUSDT: API→SELL, в трекере был Long (баг), должно быть Short ✓
 *   - LABUSDT:  API→BUY,  в трекере был Short (баг), должно быть Long ✓
 *
 * Если значение не распознано — логируем warning и возвращаем "short"
 * (безопасный дефолт).
 */
function normalizeSide(rawSide: string): "long" | "short" {
  const s = String(rawSide).toUpperCase();
  // BUY = открыли LONG позицию → long
  if (s === "BUY" || s === "1" || s === "LONG" || s === "OPENLONG" || s === "CLOSESHORT") {
    return "long";
  }
  // SELL = открыли SHORT позицию → short
  if (s === "SELL" || s === "2" || s === "SHORT" || s === "OPENSHORT" || s === "CLOSELONG") {
    return "short";
  }
  console.warn(`[bitunix] unknown side value: ${JSON.stringify(rawSide)}, defaulting to short`);
  return "short";
}

interface BitunixHistoryPositionsResponse {
  code: number;
  msg: string;
  data: {
    positionList: BitunixPosition[];
    total: number;
  };
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Подпись Bitunix (см. openapidoc.bitunix.com/doc/common/sign.html):
 *   digest = sha256(nonce + timestamp + apiKey + sortedQueryParams + body)
 *   sign   = sha256(digest + secretKey)
 * sortedQueryParams — все query-параметры отсортированы по ключу (ASCII),
 * склеены как key+value без разделителей и без пробелов, без "?"/"&"/"=".
 */
function buildSignedHeaders(
  queryParams: Record<string, string>,
  body: string,
  credentials: ExchangeCredentials
) {
  const { apiKey, apiSecret: secretKey } = credentials;

  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now().toString();

  const sortedParamString = Object.keys(queryParams)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((k) => `${k}${queryParams[k]}`)
    .join("");

  const digest = sha256Hex(nonce + timestamp + apiKey + sortedParamString + body);
  const sign = sha256Hex(digest + secretKey);

  return {
    "api-key": apiKey,
    sign,
    nonce,
    timestamp,
    "language": "en-US",
    "Content-Type": "application/json",
  };
}

function toIso(value: unknown): string {
  const ms = Number(value);
  if (!value || Number.isNaN(ms)) {
    return new Date().toISOString();
  }
  return new Date(ms).toISOString();
}

/**
 * Bitunix: /api/v1/futures/position/get_history_positions
 *
 * Особенности:
 *   - symbol опционален в их API, но по факту многие аккаунты требуют его
 *     передавать по одному тикеру за раз. Список тикеров берётся из env
 *     BITUNIX_SYMBOLS (через запятую). Если env пустой — запрос без symbol.
 *   - Пагинация через skip/limit (offset-based), не курсором.
 *   - fee и funding приходят готовыми полями — почти не требуют пересчёта.
 *
 * Специфика цикла по символам живёт ЗДЕСЬ, а не в route handler.
 */
async function fetchClosedTrades(
  credentials: ExchangeCredentials,
  opts?: { sinceMs?: number; untilMs?: number; cursor?: string }
): Promise<{ trades: SyncedTrade[]; nextCursor: string | null }> {
  // Список торгуемых символов из env. Если пусто — тянем все разом.
  const symbolsEnv = process.env.BITUNIX_SYMBOLS?.trim();
  const symbols = symbolsEnv ? symbolsEnv.split(",").map((s) => s.trim()) : [undefined];

  // Накапливаем ВСЕ сырые позиции со всех страниц и символов.
  // Агрегацию по positionId делаем после сбора, чтобы поймать partials
  // одной позиции даже если они разнесены по разным страницам/символам.
  const allRawPositions: BitunixPosition[] = [];

  for (const symbol of symbols) {
    let skip = 0;
    const limit = 100;

    // 20 страниц максимум на символ — защиты от бесконечного цикла.
    for (let page = 0; page < 20; page++) {
      const params: Record<string, string> = { limit: String(limit) };
      if (symbol) params.symbol = symbol;
      if (skip > 0) params.skip = String(skip);

      const headers = buildSignedHeaders(params, "", credentials);
      const qs = new URLSearchParams(params).toString();

      const res = await fetch(
        `${BASE_URL}/api/v1/futures/position/get_history_positions?${qs}`,
        { method: "GET", headers }
      );

      if (!res.ok) {
        throw new Error(`Bitunix HTTP ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as BitunixHistoryPositionsResponse;
      if (data.code !== 0) {
        throw new Error(`Bitunix API error ${data.code}: ${data.msg}`);
      }

      // Накапливаем ВСЕ сырые позиции — агрегацию по positionId делаем
      // после сбора всех страниц, чтобы поймать partials одной позиции
      // даже если они разнесены по разным страницам пагинации.
      allRawPositions.push(...data.data.positionList);

      if (data.data.positionList.length < limit) break;
      skip += limit;
    }
  }

  // АГРЕГАЦИЯ PARTIALS ПО positionId.
  //
  // Проблема: если позиция закрыта частями (3 partial close-ордера),
  // Bitunix отдаёт 3 записи с одинаковым positionId, но разными
  // maxQty / closePrice / realizedPNL / fee / funding / mtime.
  //
  // Без агрегации:
  //   - upsert по (user_id, exchange, external_id=positionId) перезаписывает
  //     первую запись второй, второй третьей — остаётся только последний partial.
  //   - ИЛИ если positionId разные для partials — видим 3 отдельные сделки.
  //
  // С агрегацией:
  //   - Группируем по positionId.
  //   - qty = sum(maxQty) — суммарный объём всех partials.
  //   - realized_pnl = sum(realizedPNL).
  //   - fee = sum(fee), funding = sum(funding).
  //   - entry_price = entryPrice первой записи (одинаковая для всех partials).
  //   - close_price = weighted average по qty (средневзвешенная цена закрытия).
  //   - opened_at = min(ctime), closed_at = max(mtime).
  //   - raw = { partials: [...], count: N } — сохраняем все partials для отладки.
  //
  // Если у Bitunix positionId разные для каждого partial — этот код не сработает,
  // нужна будет эвристика по (symbol, ctime, side). Но по документации positionId
  // должен быть одинаковым для всех partials одной позиции.
  const positionMap = new Map<string, BitunixPosition[]>();
  for (const p of allRawPositions) {
    const key = p.positionId;
    if (!positionMap.has(key)) positionMap.set(key, []);
    positionMap.get(key)!.push(p);
  }

  const trades: SyncedTrade[] = Array.from(positionMap.entries()).map(
    ([positionId, partials]) => {
      // Сортируем по mtime — от первого закрытия к последнему.
      partials.sort((a, b) => a.mtime - b.mtime);
      const first = partials[0];

      const totalQty = partials.reduce((acc, p) => acc + Number(p.maxQty), 0);
      const totalPnl = partials.reduce((acc, p) => acc + Number(p.realizedPNL), 0);
      const totalFee = partials.reduce((acc, p) => acc + Number(p.fee), 0);
      const totalFunding = partials.reduce((acc, p) => acc + Number(p.funding), 0);

      // close_price — средневзвешенная по qty. Если totalQty=0 (все partials
      // с нулевым объёмом — странно, но defensively) — берём closePrice первой.
      const weightedClose =
        totalQty > 0
          ? partials.reduce((acc, p) => acc + Number(p.closePrice) * Number(p.maxQty), 0) / totalQty
          : Number(first.closePrice);

      const minCtime = Math.min(...partials.map((p) => p.ctime));
      const maxMtime = Math.max(...partials.map((p) => p.mtime));

      return {
        exchange: "bitunix" as const,
        external_id: positionId,
        symbol: first.symbol,
        side: normalizeSide(first.side),
        qty: totalQty,
        entry_price: Number(first.entryPrice),
        close_price: weightedClose,
        realized_pnl: totalPnl,
        fee: totalFee,
        funding: totalFunding,
        opened_at: toIso(minCtime),
        closed_at: toIso(maxMtime),
        // raw — массив всех partials, чтобы в БД сохранялась полная картина.
        // Это полезно для отладки и для будущих доработок (например, отображения
        // "закрыто в 3 ордера" в UI).
        raw: { partials, count: partials.length },
      };
    }
  );

  // Bitunix не использует курсор — nextCursor всегда null.
  return { trades, nextCursor: null };
}

async function testCredentials(credentials: ExchangeCredentials): Promise<void> {
  // Простой запрос с limit=1 — если ключ невалиден, Bitunix вернёт ошибку.
  const params: Record<string, string> = { limit: "1" };
  const headers = buildSignedHeaders(params, "", credentials);
  const qs = new URLSearchParams(params).toString();

  const res = await fetch(
    `${BASE_URL}/api/v1/futures/position/get_history_positions?${qs}`,
    { method: "GET", headers }
  );
  if (!res.ok) {
    throw new Error(`Bitunix HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as BitunixHistoryPositionsResponse;
  if (data.code !== 0) {
    throw new Error(`Bitunix API error ${data.code}: ${data.msg}`);
  }
}

export const bitunixAdapter: ExchangeAdapter = {
  id: "bitunix",
  label: "Bitunix",
  credentialsSchema: "key+secret",
  fetchClosedTrades,
  testCredentials,
};

// Обратная совместимость
export { fetchClosedTrades as fetchBitunixHistoryPositions, testCredentials as testBitunixCredentials };
