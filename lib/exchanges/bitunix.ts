import crypto from "crypto";
import type { SyncedTrade } from "../types";

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
  body: string
) {
  const apiKey = process.env.BITUNIX_API_KEY;
  const secretKey = process.env.BITUNIX_API_SECRET;
  if (!apiKey || !secretKey) {
    throw new Error("BITUNIX_API_KEY / BITUNIX_API_SECRET не заданы");
  }

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
    language: "en-US",
    "Content-Type": "application/json",
  };
}

/**
 * Забирает закрытые позиции по фьючерсам. Bitunix отдаёт realizedPNL, fee и
 * funding уже готовыми полями — почти не требует пересчёта.
 * symbol опционален в их API, но по факту многие аккаунты требуют его
 * передавать по одному тикеру за раз — если так, дергать эту функцию в
 * цикле по списку торгуемых символов.
 */
export async function fetchBitunixHistoryPositions(opts?: {
  symbol?: string;
  skip?: number;
  limit?: number;
}): Promise<SyncedTrade[]> {
  const params: Record<string, string> = {};
  if (opts?.symbol) params.symbol = opts.symbol;
  if (opts?.skip) params.skip = String(opts.skip);
  params.limit = String(opts?.limit ?? 100);

  const headers = buildSignedHeaders(params, "");
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

  // Bitunix по документации отдаёт ctime/mtime как number (epoch ms), но на
  // практике встречаются и строковые значения — приводим явно через Number()
  // и подстраховываемся на случай отсутствующих/битых полей.
  function toIso(value: unknown): string {
    const ms = Number(value);
    if (!value || Number.isNaN(ms)) {
      return new Date().toISOString(); // не должно происходить, но не роняем весь синк
    }
    return new Date(ms).toISOString();
  }

  return data.data.positionList.map((p) => ({
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
}
