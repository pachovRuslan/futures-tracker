import crypto from "crypto";
import type { SyncedTrade } from "../types";
import type { ExchangeAdapter, ExchangeCredentials } from "./types";

const BASE_URL = "https://open-api.bingx.com";

interface BingxPositionItem {
  positionId: string; // int64 как строка — может превышать Number.MAX_SAFE_INTEGER
  symbol: string;
  isolated: boolean;
  positionSide: "LONG" | "SHORT";
  openTime: number; // ms epoch
  updateTime: number; // ms epoch — для закрытых ≈ время закрытия
  avgPrice: string;
  avgClosePrice: string;
  realisedProfit: string;
  netProfit: string;
  positionAmt: string;
  closePositionAmt: string;
  leverage: number;
  closeAllPositions: boolean;
  positionCommission: string;
  totalFunding: string;
}

interface BingxPositionHistoryResponse {
  code: number;
  msg: string;
  data:
    | { positionHistory: BingxPositionItem[] }   // CCXT-стиль (старая схема)
    | { list: BingxPositionItem[]; total: number } // AI-skill стиль (новая схема)
    | null;
}

interface BingxIncomeItem {
  symbol: string;
  incomeType: string;
  income: string;
  asset: string;
  time: number;
  tranId: string;
}

interface BingxIncomeResponse {
  code: number;
  msg: string;
  data: BingxIncomeItem[] | { incomeHistory: BingxIncomeItem[] } | null;
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

  // Каноническая строка: параметры отсортированы по ключу, key=value&key=value.
  // BingX требует, чтобы значения НЕ URL-encoding-овались перед подписью.
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
 * Авто-обнаружение всех торгуемых символов пользователя через income endpoint.
 *
 * BingX /openApi/swap/v1/trade/positionHistory требует symbol обязательным —
 * нельзя запросить «все сделки разом». Но перечислять все пары вручную неудобно,
 * если их много.
 *
 * Решение: если BINGX_SYMBOLS не задан, вызываем /openApi/swap/v2/user/income
 * (он НЕ требует symbol) и извлекаем уникальные символы из записей о доходах
 * (PnL, фандинг, комиссии). Это даёт список всех пар, по которым у пользователя
 * была активность в запрошенном периоде.
 *
 * Ограничение: income endpoint хранит данные только 3 месяца. Для периодов
 * старше 3 месяцев авто-обнаружение не найдёт символы — тогда нужно
 * заполнить BINGX_SYMBOLS вручную.
 */
async function discoverTradedSymbols(
  credentials: ExchangeCredentials,
  sinceMs: number,
  untilMs: number
): Promise<string[]> {
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
  const symbols = new Set<string>();

  for (let windowEnd = untilMs; windowEnd > sinceMs; windowEnd -= THREE_MONTHS_MS) {
    const windowStart = Math.max(windowEnd - THREE_MONTHS_MS, sinceMs);

    try {
      const data = await signedGet<BingxIncomeResponse>(
        "/openApi/swap/v2/user/income",
        {
          startTime: String(windowStart),
          endTime: String(windowEnd),
          limit: "1000",
        },
        credentials
      );

      const records: BingxIncomeItem[] = data.data
        ? Array.isArray(data.data)
          ? data.data
          : "incomeHistory" in data.data
          ? data.data.incomeHistory ?? []
          : []
        : [];

      for (const item of records) {
        if (item.symbol) symbols.add(item.symbol);
      }
    } catch (err) {
      console.warn(
        `[bingx] discover symbols failed for window ${windowStart}-${windowEnd}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return Array.from(symbols);
}

/**
 * BingX: /openApi/swap/v1/trade/positionHistory
 *
 * Особенности (актуальная документация BingX, август 2026):
 *   - Эндпоинт: /openApi/swap/v1/trade/positionHistory
 *   - symbol ОБЯЗАТЕЛЕН — нужно тянуть по одному символу за раз
 *   - startTs/endTs (НЕ startTime/endTime!) — максимальный span 3 месяца
 *   - Пагинация: pageIndex + pageSize (max 100)
 *   - positionId может превышать Number.MAX_SAFE_INTEGER — парсим как строку
 *   - Подпись: HMAC-SHA256, параметры отсортированы по ключу
 *
 * Список символов:
 *   - Если BINGX_SYMBOLS задан — используем его (формат BTC-USDT с дефисом)
 *   - Если BINGX_SYMBOLS пустой — АВТО-ОБНАРУЖЕНИЕ всех торгуемых пар через
 *     /openApi/swap/v2/user/income. Не требует ручного указания.
 *     Ограничение: авто-обнаружение работает только за последние 3 месяца
 *     (income endpoint хранит данные 3 месяца). Для более старых периодов
 *     нужно заполнить BINGX_SYMBOLS.
 */
async function fetchClosedTrades(
  credentials: ExchangeCredentials,
  opts?: { sinceMs?: number; untilMs?: number; cursor?: string }
): Promise<{ trades: SyncedTrade[]; nextCursor: string | null }> {
  const now = Date.now();
  const until = opts?.untilMs ?? now;
  const since = opts?.sinceMs ?? now - 365 * 24 * 60 * 60 * 1000;

  // Определяем список символов для синка
  const symbolsEnv = process.env.BINGX_SYMBOLS?.trim();
  let symbols: string[];

  if (symbolsEnv) {
    // Ручной список из env — формат BTC-USDT (с дефисом)
    symbols = symbolsEnv.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    // Авто-обнаружение — находим все пары, по которым была активность
    symbols = await discoverTradedSymbols(credentials, since, until);
    if (symbols.length === 0) {
      console.warn(
        "[bingx] авто-обнаружение символов не нашло ни одной пары. " +
          "Заполните BINGX_SYMBOLS в env (формат BTC-USDT,ETH-USDT,...)"
      );
      return { trades: [], nextCursor: null };
    }
    console.log(`[bingx] авто-обнаружено ${symbols.length} символов: ${symbols.join(", ")}`);
  }

  // BingX отдаёт максимум 3 месяца за один запрос.
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
  const allTrades: SyncedTrade[] = [];

  for (const symbol of symbols) {
    let symbolTradesCount = 0;
    for (let windowEnd = until; windowEnd > since; windowEnd -= THREE_MONTHS_MS) {
      const windowStart = Math.max(windowEnd - THREE_MONTHS_MS, since);

      for (let pageIndex = 1; pageIndex <= 50; pageIndex++) {
        const data = await signedGet<BingxPositionHistoryResponse>(
          "/openApi/swap/v1/trade/positionHistory",
          {
            symbol,
            startTs: String(windowStart),
            endTs: String(windowEnd),
            pageIndex: String(pageIndex),
            pageSize: "100",
          },
          credentials
        );

        // Debug: логируем сырую структуру data для первого запроса каждого символа.
        // Это поможет понять, что реально отдаёт BingX.
        if (pageIndex === 1 && windowEnd === until) {
          const dataStr = JSON.stringify(data.data).slice(0, 500);
          console.log(`[bingx] ${symbol} raw data:`, dataStr);
          console.log(`[bingx] ${symbol} data keys:`, data.data ? Object.keys(data.data) : "null");
        }

        const records: BingxPositionItem[] = data.data
          ? "positionHistory" in data.data
            ? data.data.positionHistory ?? []
            : "list" in data.data
            ? data.data.list ?? []
            : []
          : [];

        if (records.length === 0) break;

        const trades: SyncedTrade[] = records.map((p) => ({
          exchange: "bingx" as const,
          external_id: p.positionId,
          symbol: p.symbol,
          side: p.positionSide === "LONG" ? "long" : "short",
          qty: Number(p.positionAmt),
          entry_price: Number(p.avgPrice),
          close_price: Number(p.avgClosePrice),
          realized_pnl: Number(p.realisedProfit),
          fee: Math.abs(Number(p.positionCommission)),
          funding: Number(p.totalFunding),
          opened_at: new Date(p.openTime).toISOString(),
          closed_at: new Date(p.updateTime).toISOString(),
          raw: p,
        }));

        allTrades.push(...trades);
        symbolTradesCount += trades.length;
        if (records.length < 100) break;
      }
    }
    // Debug-лог: сколько сделок найдено по каждому символу.
    console.log(`[bingx] ${symbol}: ${symbolTradesCount} trades`);
  }

  console.log(`[bingx] total: ${allTrades.length} trades from ${symbols.length} symbols`);

  return { trades: allTrades, nextCursor: null };
}

async function testCredentials(credentials: ExchangeCredentials): Promise<void> {
  const now = Date.now();
  await signedGet<BingxPositionHistoryResponse>(
    "/openApi/swap/v1/trade/positionHistory",
    {
      symbol: "BTC-USDT",
      startTs: String(now - 60 * 1000),
      endTs: String(now),
      pageIndex: "1",
      pageSize: "1",
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
