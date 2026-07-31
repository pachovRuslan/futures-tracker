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
  // BingX требует, чтобы значения НЕ URL-encoding-овались перед подписью
  // (кроме случаев со спецсимволами — у нас их нет в числах и символах).
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
 * BingX: /openApi/swap/v1/trade/positionHistory
 *
 * Особенности (актуальная документация BingX, август 2026):
 *   - Эндпоинт: /openApi/swap/v1/trade/positionHistory (НЕ v2/user/positions/history,
 *     который использовался раньше — он не существует, BingX отдаёт 100400)
 *   - symbol ОБЯЗАТЕЛЕН — нужно тянуть по одному символу за раз
 *   - startTs/endTs (НЕ startTime/endTime!) — максимальный span 3 месяца
 *   - Пагинация: pageIndex + pageSize (max 100)
 *   - positionId может превышать Number.MAX_SAFE_INTEGER — парсим как строку
 *   - Подпись: HMAC-SHA256, параметры отсортированы по ключу
 *
 * Список символов берётся из env BINGX_SYMBOLS (через запятую).
 * Если env пустой — берём только BTC-USDT как минимальный рабочий сценарий
 * (без symbol запрос невозможен). TODO: тянуть список всех контрактов через
 * /openApi/swap/v2/quote/contracts.
 */
async function fetchClosedTrades(
  credentials: ExchangeCredentials,
  opts?: { sinceMs?: number; untilMs?: number; cursor?: string }
): Promise<{ trades: SyncedTrade[]; nextCursor: string | null }> {
  const now = Date.now();
  const until = opts?.untilMs ?? now;
  const since = opts?.sinceMs ?? now - 365 * 24 * 60 * 60 * 1000;

  // BingX требует symbol обязательным. Берём список из env.
  // Формат BingX: "BTC-USDT" (с дефисом), не "BTCUSDT" как у Bybit/Binance.
  const symbolsEnv = process.env.BINGX_SYMBOLS?.trim();
  const symbols = symbolsEnv
    ? symbolsEnv.split(",").map((s) => s.trim()).filter(Boolean)
    : ["BTC-USDT"]; // минимальный дефолт

  // BingX отдаёт максимум 3 месяца за один запрос.
  // Нарезаем на 3-месячные окна.
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
  const allTrades: SyncedTrade[] = [];

  for (const symbol of symbols) {
    for (let windowEnd = until; windowEnd > since; windowEnd -= THREE_MONTHS_MS) {
      const windowStart = Math.max(windowEnd - THREE_MONTHS_MS, since);

      // Пагинация по pageIndex.
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

        // BingX возвращает data в одном из двух форматов (расхождение между
        // старой и новой схемой). Обрабатываем оба.
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
          external_id: p.positionId, // строка, не число — сохраняем точность
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
        if (records.length < 100) break;
      }
    }
  }

  // BingX не использует курсор — nextCursor всегда null.
  return { trades: allTrades, nextCursor: null };
}

async function testCredentials(credentials: ExchangeCredentials): Promise<void> {
  // Простой запрос с минимальным окном — если ключ невалиден, BingX вернёт
  // ошибку авторизации. Если ключ валиден, но символа нет — вернёт пустой
  // data.positionHistory, что нам и нужно для проверки.
  const now = Date.now();
  await signedGet<BingxPositionHistoryResponse>(
    "/openApi/swap/v1/trade/positionHistory",
    {
      symbol: "BTC-USDT",
      startTs: String(now - 60 * 1000), // последняя минута
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
