import crypto from "crypto";
import type { SyncedTrade } from "../types";
import type { ExchangeAdapter, ExchangeCredentials } from "./types";

const BASE_URL = "https://open-api.bingx.com";

interface BingxIncomeItem {
  symbol: string;
  incomeType: "REALIZED_PNL" | "TRADING_FEE" | "FUNDING_FEE" | "TRANSFER" | string;
  income: string;
  asset: string;
  info: string; // "Sell to Close", "Buy to Close", "Position opening fee", "Funding Fee", ...
  time: number; // ms epoch
  tranId: string;
  tradeId: string;
}

interface BingxIncomeResponse {
  code: number;
  msg: string;
  data: BingxIncomeItem[] | null;
}

function sign(queryString: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(queryString).digest("hex");
}

async function signedGet<T>(
  path: string,
  params: Record<string, string>,
  credentials: ExchangeCredentials
): Promise<T> {
  const { apiKey, apiSecret } = credentials;
  const timestamp = Date.now().toString();
  const allParams: Record<string, string> = { ...params, timestamp, recvWindow: "5000" };

  const queryString = Object.keys(allParams)
    .sort()
    .map((k) => `${k}=${allParams[k]}`)
    .join("&");

  const signature = sign(queryString, apiSecret);

  const res = await fetch(`${BASE_URL}${path}?${queryString}&signature=${signature}`, {
    method: "GET",
    headers: {
      "X-BX-APIKEY": apiKey,
      "X-SOURCE-KEY": "BX-AI-SKILL",
    },
  });

  if (!res.ok) {
    throw new Error(`BingX HTTP ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as T & { code: number; msg: string };
  if (data.code !== 0) {
    throw new Error(`BingX API error ${data.code}: ${data.msg}`);
  }
  return data;
}

/**
 * Определяет сторону позиции (long/short) по полю `info` из income endpoint.
 *
 * BingX income отдаёт info:
 *   - "Sell to Close" — продали, чтобы закрыть → позиция была LONG
 *   - "Buy to Close"  — откупили, чтобы закрыть → позиция была SHORT
 *   - "Position opening fee" / "Position closing fee" / "Funding Fee" —
 *     не определяют сторону, но можно взять с того же tradeId, где есть
 *     REALIZED_PNL с "Sell/Buy to Close".
 */
function sideFromInfo(info: string): "long" | "short" | null {
  const lower = info.toLowerCase();
  if (lower.includes("sell to close")) return "long";
  if (lower.includes("buy to close")) return "short";
  return null;
}

/**
 * BingX: /openApi/swap/v2/user/income
 *
 * ВАЖНО: используем income endpoint, а НЕ positionHistory.
 * positionHistory (/openApi/swap/v1/trade/positionHistory) у некоторых
 * аккаунтов возвращает пустой массив, хотя сделки есть (подтверждено
 * диагностикой на боевом аккаунте). BingX не объясняет почему.
 *
 * income endpoint отдаёт ВСЕ доходы: REALIZED_PNL, TRADING_FEE, FUNDING_FEE.
 * Группируем по tradeId — каждая закрытая позиция имеет уникальный tradeId.
 * Извлекаем side из поля info ("Sell to Close" → long, "Buy to Close" → short).
 *
 * Ограничения:
 *   - Хранение данных: 3 месяца
 *   - Пагинация: limit (max 1000), без offset — нужно тянуть по времени
 *   - НЕ требует symbol — возвращает все пары
 */
async function fetchClosedTrades(
  credentials: ExchangeCredentials,
  opts?: { sinceMs?: number; untilMs?: number; cursor?: string }
): Promise<{ trades: SyncedTrade[]; nextCursor: string | null }> {
  const now = Date.now();
  const until = opts?.untilMs ?? now;
  const since = opts?.sinceMs ?? now - 365 * 24 * 60 * 60 * 1000;

  // BingX income хранит данные только 3 месяца. Если since старше 3 месяцев —
  // ограничиваем, чтобы не получить пустые ответы за старые периоды.
  const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;
  const effectiveSince = Math.max(since, threeMonthsAgo);

  // Нарезаем на 7-дневные окна — в каждом окне тянем до 1000 записей.
  // 7 дней — безопасно, даже активный трейдер не сделает 1000 сделок за неделю.
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const allIncome: BingxIncomeItem[] = [];

  for (let windowEnd = until; windowEnd > effectiveSince; windowEnd -= SEVEN_DAYS_MS) {
    const windowStart = Math.max(windowEnd - SEVEN_DAYS_MS, effectiveSince);

    const data = await signedGet<BingxIncomeResponse>(
      "/openApi/swap/v2/user/income",
      {
        startTime: String(windowStart),
        endTime: String(windowEnd),
        limit: "1000",
      },
      credentials
    );

    const records = data.data ?? [];
    if (records.length === 0) continue;

    allIncome.push(...records);

    // Если вернулось ровно 1000 — возможно, есть ещё. Дробим окно.
    // Но для большинства случаев 1000 за неделю — это много, и можно идти дальше.
    if (records.length === 1000) {
      console.warn(
        `[bingx] income window ${windowStart}-${windowEnd} returned 1000 records — possible truncation`
      );
    }
  }

  console.log(`[bingx] income: ${allIncome.length} records total`);

  // Группируем по tradeId. Каждая закрытая позиция имеет REALIZED_PNL запись
  // с info "Sell to Close" или "Buy to Close". Это маркер закрытия.
  // Все другие записи (TRADING_FEE, FUNDING_FEE) с тем же tradeId относятся
  // к этой же позиции — суммируем их.
  const tradesMap = new Map<string, {
    symbol: string;
    side: "long" | "short";
    realized_pnl: number;
    fee: number;
    funding: number;
    closed_at: number;
    opened_at: number | null;
  }>();

  // Сначала найдём все REALIZED_PNL — это маркеры закрытых позиций.
  for (const item of allIncome) {
    if (item.incomeType !== "REALIZED_PNL") continue;

    // tradeId имеет формат "{positionId}_{accountId}_{orderId}" — берём первую часть как positionId
    const positionId = item.tradeId.split("_")[0];
    const side = sideFromInfo(item.info);
    if (!side) continue; // не REALIZED_PNL с close-marker — пропускаем

    tradesMap.set(item.tradeId, {
      symbol: item.symbol,
      side,
      realized_pnl: Number(item.income),
      fee: 0,
      funding: 0,
      closed_at: item.time,
      opened_at: null,
    });
  }

  // Теперь добавляем TRADING_FEE и FUNDING_FEE к соответствующим позициям.
  // Сопоставляем по tradeId (если есть) или по symbol+time.
  for (const item of allIncome) {
    if (item.incomeType === "REALIZED_PNL") continue; // уже обработали

    // Пробуем сопоставить по tradeId
    const trade = tradesMap.get(item.tradeId);
    if (trade) {
      if (item.incomeType === "TRADING_FEE") {
        trade.fee += Math.abs(Number(item.income));
      } else if (item.incomeType === "FUNDING_FEE") {
        trade.funding += Number(item.income);
      }
      // opened_at: берём минимальное время из всех записей
      if (trade.opened_at === null || item.time < trade.opened_at) {
        trade.opened_at = item.time;
      }
      continue;
    }

    // Если по tradeId не нашли — пробуем по tranId (иногда fee имеет тот же tranId)
    // tranId формат: "{positionId}_{accountId}_{internalId}_{typeSuffix}"
    const positionIdFromTran = item.tranId.split("_")[0];
    for (const [tid, t] of tradesMap.entries()) {
      if (tid.startsWith(positionIdFromTran + "_")) {
        if (item.incomeType === "TRADING_FEE") {
          t.fee += Math.abs(Number(item.income));
        } else if (item.incomeType === "FUNDING_FEE") {
          t.funding += Number(item.income);
        }
        if (t.opened_at === null || item.time < t.opened_at) {
          t.opened_at = item.time;
        }
        break;
      }
    }
  }

  // Преобразуем в SyncedTrade[]
  const trades: SyncedTrade[] = Array.from(tradesMap.entries()).map(([tradeId, t]) => ({
    exchange: "bingx" as const,
    external_id: tradeId, // уникальный идентификатор
    symbol: t.symbol,
    side: t.side,
    qty: null, // income endpoint не отдаёт qty — нужно отдельно тянуть positionHistory
    entry_price: null, // нет в income
    close_price: null, // нет в income
    realized_pnl: t.realized_pnl,
    fee: t.fee,
    funding: t.funding,
    opened_at: t.opened_at ? new Date(t.opened_at).toISOString() : null,
    closed_at: new Date(t.closed_at).toISOString(),
    raw: { tradeId, source: "income" },
  }));

  console.log(`[bingx] grouped into ${trades.length} trades`);

  return { trades, nextCursor: null };
}

async function testCredentials(credentials: ExchangeCredentials): Promise<void> {
  const now = Date.now();
  await signedGet<BingxIncomeResponse>(
    "/openApi/swap/v2/user/income",
    {
      startTime: String(now - 60 * 1000),
      endTime: String(now),
      limit: "1",
    },
    credentials
  );
}

export const bingxAdapter: ExchangeAdapter = {
  id: "bingx",
  label: "BingX",
  credentialsSchema: "key+secret",
  fetchClosedTrades,
  testCredentials,
};
