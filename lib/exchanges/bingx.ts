import crypto from "crypto";
import type { SyncedTrade } from "../types";
import type { ExchangeAdapter, ExchangeCredentials } from "./types";

const BASE_URL = "https://open-api.bingx.com";

interface BingxPositionItem {
  positionId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  marginMode: "CROSS" | "ISOLATED";
  positionType: string;
  qty: string;
  entryPrice: string;
  closePrice: string;
  realizedPNL: string;
  fee: string;
  fundingFee: string;
  openTime: number; // ms epoch
  closeTime: number; // ms epoch
}

interface BingxHistoryResponse {
  code: number;
  msg: string;
  data: { positions: BingxPositionItem[]; total: number };
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
  const allParams = { ...params, timestamp, recvWindow: "5000" };
  const queryString = new URLSearchParams(allParams).toString();
  const signature = sign(queryString, apiSecret);

  const res = await fetch(`${BASE_URL}${path}?${queryString}&signature=${signature}`, {
    method: "GET",
    headers: {
      "X-BX-APIKEY": apiKey,
      "BING-API-KEY": apiKey,
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
 * BingX: /openApi/swap/v2/user/positions/history
 *
 * Особенности:
 *   - Подпись: HMAC-SHA256, как у Binance
 *   - Пагинация по pageNum/pageSize (offset-based)
 *   - Возвращает готовые fee, fundingFee, realizedPNL — почти не требуют пересчёта
 *   - positionType: 1=Long, 2=Short (но в v2 — side: LONG/SHORT)
 *
 * Регионы: лояльнее Binance, но часть ЕС под ограничениями.
 */
async function fetchClosedTrades(
  credentials: ExchangeCredentials,
  opts?: { sinceMs?: number; untilMs?: number; cursor?: string }
): Promise<{ trades: SyncedTrade[]; nextCursor: string | null }> {
  const pageSize = "100";
  const allTrades: SyncedTrade[] = [];

  let pageNum = opts?.cursor ? Number(opts.cursor) : 1;

  for (let page = 0; page < 50; page++) {
    const params: Record<string, string> = { pageSize, pageNum: String(pageNum) };
    if (opts?.sinceMs) params.startTime = String(opts.sinceMs);
    if (opts?.untilMs) params.endTime = String(opts.untilMs);

    const data = await signedGet<BingxHistoryResponse>(
      "/openApi/swap/v2/user/positions/history",
      params,
      credentials
    );

    const trades: SyncedTrade[] = data.data.positions.map((p) => ({
      exchange: "bingx" as const,
      external_id: p.positionId,
      symbol: p.symbol,
      side: p.side === "LONG" ? "long" : "short",
      qty: Number(p.qty),
      entry_price: Number(p.entryPrice),
      close_price: Number(p.closePrice),
      realized_pnl: Number(p.realizedPNL),
      fee: Number(p.fee),
      funding: Number(p.fundingFee),
      opened_at: new Date(p.openTime).toISOString(),
      closed_at: new Date(p.closeTime).toISOString(),
      raw: p,
    }));

    allTrades.push(...trades);

    if (data.data.positions.length < Number(pageSize)) break;
    pageNum++;
  }

  // BingX не использует курсор — nextCursor всегда null.
  return { trades: allTrades, nextCursor: null };
}

async function testCredentials(credentials: ExchangeCredentials): Promise<void> {
  // Простой запрос с pageSize=1.
  await signedGet<BingxHistoryResponse>(
    "/openApi/swap/v2/user/positions/history",
    { pageSize: "1", pageNum: "1" },
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
