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
  side: "LONG" | "SHORT";
  fee: string;
  funding: string;
  realizedPNL: string;
  ctime: number; // ms epoch — открытие
  mtime: number; // ms epoch — последнее изменение/закрытие
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

  const allTrades: SyncedTrade[] = [];

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

      const trades: SyncedTrade[] = data.data.positionList.map((p) => ({
        exchange: "bitunix" as const,
        external_id: p.positionId,
        symbol: p.symbol,
        side: p.side === "LONG" ? "long" : "short",
        qty: Number(p.maxQty),
        entry_price: Number(p.entryPrice),
        close_price: Number(p.closePrice),
        realized_pnl: Number(p.realizedPNL),
        fee: Number(p.fee),
        funding: Number(p.funding),
        opened_at: toIso(p.ctime),
        closed_at: toIso(p.mtime),
        raw: p,
      }));

      allTrades.push(...trades);
      if (trades.length < limit) break;
      skip += limit;
    }
  }

  // Bitunix не использует курсор — nextCursor всегда null.
  return { trades: allTrades, nextCursor: null };
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
