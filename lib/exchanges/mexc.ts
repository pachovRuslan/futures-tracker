import crypto from "crypto";
import type { SyncedTrade } from "../types";
import type { ExchangeAdapter, ExchangeCredentials } from "./types";

const BASE_URL = "https://contract.mexc.com";

interface MexcPositionItem {
  positionId: number;
  symbol: string;
  positionType: 1 | 2; // 1=Long, 2=Short
  holdVol: string;
  openAvgPrice: string;
  closeAvgPrice: string;
  realizedAmount: string;
  fee: string;
  fundingAmount: string;
  openTime: number; // ms epoch
  closeTime: number; // ms epoch
}

interface MexcHistoryResponse {
  success: boolean;
  code: number;
  data: { resultList: MexcPositionItem[]; page: { total: number; pageSize: number; pageNum: number } };
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
      "ApiKey": apiKey,
      "Request-Time": timestamp,
    },
  });

  if (!res.ok) {
    throw new Error(`MEXC HTTP ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as T & { success: boolean; code: number };
  if (!data.success || data.code !== 0) {
    throw new Error(`MEXC API error ${data.code}`);
  }
  return data;
}

/**
 * MEXC: /api/v1/private/position/list/history-position
 *
 * Особенности:
 *   - Подпись: HMAC-SHA256 (как Binance)
 *   - Пагинация по pageNum/pageSize
 *   - Возвращает готовые fee, fundingAmount, realizedAmount
 *   - positionType: 1=Long, 2=Short
 *
 * Регионы: блокирует US, Канада. Жёстче rate-limit, чем у Binance.
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

    const data = await signedGet<MexcHistoryResponse>(
      "/api/v1/private/position/list/history-position",
      params,
      credentials
    );

    const trades: SyncedTrade[] = data.data.resultList.map((p) => ({
      exchange: "mexc" as const,
      external_id: String(p.positionId),
      symbol: p.symbol,
      side: p.positionType === 1 ? "long" : "short",
      qty: Number(p.holdVol),
      entry_price: Number(p.openAvgPrice),
      close_price: Number(p.closeAvgPrice),
      realized_pnl: Number(p.realizedAmount),
      fee: Number(p.fee),
      funding: Number(p.fundingAmount),
      opened_at: new Date(p.openTime).toISOString(),
      closed_at: new Date(p.closeTime).toISOString(),
      raw: p,
    }));

    allTrades.push(...trades);

    if (data.data.resultList.length < Number(pageSize)) break;
    pageNum++;
  }

  return { trades: allTrades, nextCursor: null };
}

async function testCredentials(credentials: ExchangeCredentials): Promise<void> {
  await signedGet<MexcHistoryResponse>(
    "/api/v1/private/position/list/history-position",
    { pageSize: "1", pageNum: "1" },
    credentials
  );
}

export const mexcAdapter: ExchangeAdapter = {
  id: "mexc",
  label: "MEXC",
  credentialsSchema: "key+secret",
  fetchClosedTrades,
  testCredentials,
};
