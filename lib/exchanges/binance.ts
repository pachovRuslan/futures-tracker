import crypto from "crypto";
import type { SyncedTrade } from "../types";
import type { ExchangeAdapter, ExchangeCredentials } from "./types";

const BASE_URL = "https://fapi.binance.com";

interface BinanceIncomeItem {
  symbol: string;
  incomeType: "REALIZED_PNL" | "COMMISSION" | "FUNDING_FEE" | "TRANSFER" | "INTERNAL_TRANSFER" | string;
  income: string;
  asset: string;
  time: number; // ms epoch
  tranId: number;
  tradeId: string;
}

interface BinanceIncomeResponse extends Array<BinanceIncomeItem> {}

interface BinanceTradeItem {
  symbol: string;
  id: number;
  orderId: number;
  side: "BUY" | "SELL";
  price: string;
  qty: string;
  realizedPnl: string;
  marginAsset: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  positionSide: "BOTH" | "LONG" | "SHORT";
  buyer: boolean;
  maker: boolean;
}

interface BinanceTradeResponse extends Array<BinanceTradeItem> {}

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
  const allParams = { ...params, timestamp, recvWindow: "5000" };
  const queryString = new URLSearchParams(allParams).toString();
  const signature = sign(queryString, apiSecret);

  const res = await fetch(`${BASE_URL}${path}?${queryString}&signature=${signature}`, {
    method: "GET",
    headers: { "X-MBX-APIKEY": apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Binance HTTP ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

/**
 * Binance USDS-M Futures: /fapi/v1/income + /fapi/v1/userTrades
 *
 * Особенности:
 *   - У Binance нет отдельного эндпоинта "закрытые позиции". Вместо этого:
 *     1. /fapi/v1/income с incomeType=REALIZED_PNL — даёт PnL по сделкам
 *     2. /fapi/v1/income с incomeType=COMMISSION — комиссии
 *     3. /fapi/v1/income с incomeType=FUNDING_FEE — фандинг
 *     4. /fapi/v1/userTrades — детали (цена входа/выхода, qty, side)
 *   - Совмещаем по orderId/tradeId, маппим в унифицированный SyncedTrade.
 *   - startTime/endTime ограничены 7 днями для income, иначе ошибка.
 *   - Пагинация по startTime — сдвигаем окно.
 *
 * Лимиты: 30000 weight/мин (по IP), каждый запрос = 20 weight. ~1500 req/мин.
 *
 * Регионы: блокирует US, Канада, часть ЕС. Нужен регион Vercel вне США
 * (сейчас fra1 — подходит).
 */
async function fetchClosedTrades(
  credentials: ExchangeCredentials,
  opts?: { sinceMs?: number; untilMs?: number; cursor?: string }
): Promise<{ trades: SyncedTrade[]; nextCursor: string | null }> {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const until = opts?.untilMs ?? now;
  const since = opts?.sinceMs ?? now - 365 * 24 * 60 * 60 * 1000;

  const allTrades: SyncedTrade[] = [];

  // Нарезаем на 7-дневные окна (как Bybit).
  for (let windowEnd = until; windowEnd > since; windowEnd -= SEVEN_DAYS_MS) {
    const windowStart = Math.max(windowEnd - SEVEN_DAYS_MS, since);
    const limit = "1000";

    // 1. REALIZED_PNL — даёт сделки с PnL
    const pnlIncome = await signedGet<BinanceIncomeResponse>(
      "/fapi/v1/income",
      { incomeType: "REALIZED_PNL", startTime: String(windowStart), endTime: String(windowEnd), limit },
      credentials
    );

    if (pnlIncome.length === 0) continue;

    // 2. COMMISSION и FUNDING_FEE — на то же окно
    const [feeIncome, fundingIncome] = await Promise.all([
      signedGet<BinanceIncomeResponse>(
        "/fapi/v1/income",
        { incomeType: "COMMISSION", startTime: String(windowStart), endTime: String(windowEnd), limit },
        credentials
      ),
      signedGet<BinanceIncomeResponse>(
        "/fapi/v1/income",
        { incomeType: "FUNDING_FEE", startTime: String(windowStart), endTime: String(windowEnd), limit },
        credentials
      ),
    ]);

    // Группируем комиссии и фандинг по symbol + time (с допуском ±1сек для матчинга)
    const feeBySymbolTime = new Map<string, number>();
    for (const f of feeIncome) {
      const key = `${f.symbol}|${f.time}`;
      feeBySymbolTime.set(key, (feeBySymbolTime.get(key) ?? 0) + Number(f.income));
    }
    const fundingBySymbol = new Map<string, number>();
    for (const f of fundingIncome) {
      fundingBySymbol.set(f.symbol, (fundingBySymbol.get(f.symbol) ?? 0) + Number(f.income));
    }

    // 3. userTrades — детали цены/стороны. Тянем по каждому символу из PnL.
    const symbols = [...new Set(pnlIncome.map((p) => p.symbol))];
    for (const symbol of symbols) {
      let lastId: number | undefined;
      for (let page = 0; page < 20; page++) {
        const params: Record<string, string> = {
          symbol,
          startTime: String(windowStart),
          endTime: String(windowEnd),
          limit: "1000",
        };
        if (lastId) params.fromId = String(lastId + 1);

        const tradeDetails = await signedGet<BinanceTradeResponse>("/fapi/v1/userTrades", params, credentials);
        if (tradeDetails.length === 0) break;

        // Группируем по orderId — один ордер = одна "позиция" в нашей модели.
        const byOrderId = new Map<number, BinanceTradeItem[]>();
        for (const t of tradeDetails) {
          if (!byOrderId.has(t.orderId)) byOrderId.set(t.orderId, []);
          byOrderId.get(t.orderId)!.push(t);
        }

        for (const [orderId, fills] of byOrderId) {
          // Ищем PnL для этого orderId. Binance доход REALIZED_PNL привязан
          // к tradeId, но для простоты берём суммарный PnL по symbol+time.
          const firstFill = fills[0];
          const lastFill = fills[fills.length - 1];
          const symbolTime = `${symbol}|${firstFill.time}`;
          const fee = feeBySymbolTime.get(symbolTime) ?? 0;
          const funding = fundingBySymbol.get(symbol) ?? 0;

          const realizedPnl = fills.reduce((acc, f) => acc + Number(f.realizedPnl), 0);
          const totalQty = fills.reduce((acc, f) => acc + Number(f.qty), 0);

          allTrades.push({
            exchange: "binance" as const,
            external_id: String(orderId),
            symbol,
            side: firstFill.side === "BUY" ? "long" : "short",
            qty: totalQty,
            entry_price: firstFill.side === "BUY" ? Number(firstFill.price) : Number(lastFill.price),
            close_price: firstFill.side === "BUY" ? Number(lastFill.price) : Number(firstFill.price),
            realized_pnl: realizedPnl,
            // У Binance realizedPnl НЕ включает комиссию — она отдельной строкой.
            fee: Math.abs(fee),
            funding,
            opened_at: new Date(firstFill.time).toISOString(),
            closed_at: new Date(lastFill.time).toISOString(),
            raw: { fills, pnlIncome: pnlIncome.filter((p) => p.symbol === symbol) },
          });
        }

        if (tradeDetails.length < 1000) break;
        lastId = tradeDetails[tradeDetails.length - 1].id;
      }
    }
  }

  return { trades: allTrades, nextCursor: null };
}

async function testCredentials(credentials: ExchangeCredentials): Promise<void> {
  // Простой запрос баланса — если ключ невалиден, Binance вернёт -2015.
  await signedGet<unknown>("/fapi/v2/balance", {}, credentials);
}

export const binanceAdapter: ExchangeAdapter = {
  id: "binance",
  label: "Binance",
  credentialsSchema: "key+secret",
  fetchClosedTrades,
  testCredentials,
};
