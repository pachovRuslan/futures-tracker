import crypto from "crypto";
import type { Trade } from "../types";

const BASE_URL = "https://api.bybit.com";
const RECV_WINDOW = "5000";

interface BybitClosedPnlItem {
  orderId: string;
  symbol: string;
  side: "Buy" | "Sell";
  qty: string;
  avgEntryPrice: string;
  avgExitPrice: string;
  closedPnl: string;
  cumEntryValue: string;
  createdTime: string; // ms epoch, открытие
  updatedTime: string; // ms epoch, закрытие
}

interface BybitClosedPnlResponse {
  retCode: number;
  retMsg: string;
  result: {
    list: BybitClosedPnlItem[];
    nextPageCursor: string;
  };
}

function sign(
  timestamp: string,
  apiKey: string,
  queryString: string,
  secret: string
): string {
  const payload = timestamp + apiKey + RECV_WINDOW + queryString;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function signedGet<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const apiKey = process.env.BYBIT_API_KEY;
  const apiSecret = process.env.BYBIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("BYBIT_API_KEY / BYBIT_API_SECRET не заданы");
  }

  const timestamp = Date.now().toString();
  const queryString = new URLSearchParams(params).toString();
  const signature = sign(timestamp, apiKey, queryString, apiSecret);

  const res = await fetch(`${BASE_URL}${path}?${queryString}`, {
    method: "GET",
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-SIGN": signature,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": RECV_WINDOW,
    },
  });

  if (!res.ok) {
    throw new Error(`Bybit HTTP ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as T & { retCode: number; retMsg: string };
  if (data.retCode !== 0) {
    throw new Error(`Bybit API error ${data.retCode}: ${data.retMsg}`);
  }
  return data;
}

/**
 * Забирает закрытые позиции по USDT-перпетуалам (category=linear) начиная
 * с курсора. Bybit хранит closed-pnl историю максимум за 2 года и отдаёт
 * постранично через cursor.
 */
export async function fetchBybitClosedPnl(opts?: {
  cursor?: string;
  startTimeMs?: number;
  endTimeMs?: number;
}): Promise<{ trades: Omit<Trade, "id">[]; nextCursor: string | null }> {
  const params: Record<string, string> = {
    category: "linear",
    limit: "100",
  };
  if (opts?.cursor) params.cursor = opts.cursor;
  if (opts?.startTimeMs) params.startTime = String(opts.startTimeMs);
  if (opts?.endTimeMs) params.endTime = String(opts.endTimeMs);

  const data = await signedGet<BybitClosedPnlResponse>(
    "/v5/position/closed-pnl",
    params
  );

  const trades: Omit<Trade, "id">[] = data.result.list.map((item) => ({
    exchange: "bybit" as const,
    external_id: item.orderId,
    symbol: item.symbol,
    side: item.side === "Buy" ? "long" : "short",
    qty: Number(item.qty),
    entry_price: Number(item.avgEntryPrice),
    close_price: Number(item.avgExitPrice),
    realized_pnl: Number(item.closedPnl),
    fee: 0, // fee уже вычтена из closedPnl биржей, храним 0 чтобы не задваивать
    funding: 0,
    opened_at: new Date(Number(item.createdTime)).toISOString(),
    closed_at: new Date(Number(item.updatedTime)).toISOString(),
    raw: item,
  }));

  return {
    trades,
    nextCursor: data.result.nextPageCursor || null,
  };
}
