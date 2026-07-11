import crypto from "crypto";
import type { SyncedTrade } from "../types";
import type { ExchangeAdapter, ExchangeCredentials } from "./types";

const BASE_URL = "https://api.bitget.com";

interface BitgetPositionItem {
  symbol: string;
  marginCoin: string;
  side: "openLong" | "openShort" | "closeLong" | "closeShort";
  total: string;
  openPriceAvg: string;
  closePriceAvg: string;
  pnl: string;
  fee: string;
  fundingRate: string;
  cTime: number; // ms epoch
  uTime: number; // ms epoch
}

interface BitgetClosedPositionResponse {
  code: string;
  msg: string;
  data: { list: BitgetPositionItem[]; endId: string };
}

interface BitgetTokenResponse {
  code: string;
  msg: string;
  data: { ts: number };
}

function sign(timestamp: string, method: string, path: string, queryString: string, body: string, secret: string): string {
  const payload = timestamp + method.toUpperCase() + path + (queryString ? `?${queryString}` : "") + body;
  return crypto.createHmac("sha256", secret).update(payload).digest("base64");
}

async function signedGet<T>(
  path: string,
  params: Record<string, string>,
  credentials: ExchangeCredentials
): Promise<T> {
  const { apiKey, apiSecret, passphrase } = credentials;
  if (!passphrase) {
    throw new Error("Bitget требует passphrase — укажите третье поле в форме подключения");
  }

  const timestamp = (await getServerTime(credentials)).toString();
  const queryString = new URLSearchParams(params).toString();
  const signature = sign(timestamp, "GET", path, queryString, "", apiSecret);

  const res = await fetch(`${BASE_URL}${path}?${queryString}`, {
    method: "GET",
    headers: {
      "ACCESS-KEY": apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": passphrase,
      "Content-Type": "application/json",
      "locale": "en-US",
    },
  });

  if (!res.ok) {
    throw new Error(`Bitget HTTP ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as T & { code: string; msg: string };
  if (data.code !== "00000") {
    throw new Error(`Bitget API error ${data.code}: ${data.msg}`);
  }
  return data;
}

async function getServerTime(credentials: ExchangeCredentials): Promise<number> {
  const { apiKey, apiSecret, passphrase } = credentials;
  if (!passphrase) {
    throw new Error("Bitget требует passphrase");
  }
  const timestamp = Date.now().toString();
  const path = "/api/v2/public/time";
  const signature = sign(timestamp, "GET", path, "", "", apiSecret);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "ACCESS-KEY": apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": passphrase,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Bitget time HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as BitgetTokenResponse;
  return data.data.ts;
}

/**
 * Bitget V2: /api/v2/mix/position/history-position
 *
 * Особенности:
 *   - Подпись: HMAC-SHA256 с base64 (как у OKX), нужен passphrase
 *   - timestamp берётся с сервера Bitget (чтобы избежать рассинхрона)
 *   - Пагинация по endId — курсором, передаём в idLess для следующей страницы
 *   - symbol обязателен для productType=USDT-FUTURES, но можно через "all" — зависит от аккаунта
 *   - productType: USDT-FUTURES (linear), COIN-FUTURES (inverse), SUSDT-FUTURES (mock)
 *
 * Регионы: блокирует US, Канада, часть ЕС.
 */
async function fetchClosedTrades(
  credentials: ExchangeCredentials,
  opts?: { sinceMs?: number; untilMs?: number; cursor?: string }
): Promise<{ trades: SyncedTrade[]; nextCursor: string | null }> {
  const limit = "100";
  const allTrades: SyncedTrade[] = [];

  // Пагинация курсором (idLess).
  let idLess: string | undefined = opts?.cursor;

  for (let page = 0; page < 50; page++) {
    const params: Record<string, string> = {
      productType: "USDT-FUTURES",
      limit,
      ...(idLess ? { idLess } : {}),
    };
    // Опционально фильтруем по времени, если задано
    if (opts?.sinceMs) params.startTime = String(opts.sinceMs);
    if (opts?.untilMs) params.endTime = String(opts.untilMs);

    const data = await signedGet<BitgetClosedPositionResponse>(
      "/api/v2/mix/position/history-position",
      params,
      credentials
    );

    const trades: SyncedTrade[] = data.data.list.map((p) => ({
      exchange: "bitget" as const,
      external_id: `${p.symbol}_${p.cTime}`,
      symbol: p.symbol,
      side: p.side === "openLong" || p.side === "closeLong" ? "long" : "short",
      qty: Number(p.total),
      entry_price: Number(p.openPriceAvg),
      close_price: Number(p.closePriceAvg),
      realized_pnl: Number(p.pnl),
      fee: Number(p.fee),
      funding: Number(p.fundingRate),
      opened_at: new Date(p.cTime).toISOString(),
      closed_at: new Date(p.uTime).toISOString(),
      raw: p,
    }));

    allTrades.push(...trades);

    // Если вернулось меньше limit — достигли конца.
    if (data.data.list.length < Number(limit)) break;
    idLess = data.data.endId;
    if (!idLess) break;
  }

  return { trades: allTrades, nextCursor: null };
}

async function testCredentials(credentials: ExchangeCredentials): Promise<void> {
  // Простой запрос с limit=1.
  await signedGet<BitgetClosedPositionResponse>(
    "/api/v2/mix/position/history-position",
    { productType: "USDT-FUTURES", limit: "1" },
    credentials
  );
}

export const bitgetAdapter: ExchangeAdapter = {
  id: "bitget",
  label: "Bitget",
  credentialsSchema: "key+secret+passphrase",
  fetchClosedTrades,
  testCredentials,
};
