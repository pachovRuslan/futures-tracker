import crypto from "crypto";
import type { SyncedTrade } from "../types";
import type { ExchangeAdapter, ExchangeCredentials } from "./types";

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
  // Bybit V5 /v5/position/closed-pnl документированно НЕ возвращает fee.
  // Но иногда биржа отдаёт undocumented поля — пробуем их читать, если есть.
  execFee?: string;
  feeRate?: string;
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
  params: Record<string, string>,
  credentials: ExchangeCredentials
): Promise<T> {
  const { apiKey, apiSecret } = credentials;

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
 * Bybit V5: /v5/position/closed-pnl
 *
 * Ограничения биржи:
 *   - История хранится ~2 года
 *   - Диапазон endTime - startTime <= 7 дней (или последние 24ч без явных дат)
 *   - Постраничная пагинация через cursor
 *
 * Поэтому fetchClosedTrades САМ нарезает запрошенный период на 7-дневные окна
 * и проходит их все с пагинацией. Это специфика Bybit — раньше логика жила
 * в route handler, теперь здесь, где ей и место.
 *
 * fee: Bybit closedPnl УЖЕ включает вычет комиссии, поэтому fee=0 чтобы не
 * задваивать. Это корректно для PnL-сводки, но не для расчёта баланса
 * (см. TODO в README — нужен отдельный эндпоинт /v5/account/transaction-log).
 * Пробуем читать undocumented поле execFee, если биржа его отдаёт.
 */
async function fetchClosedTrades(
  credentials: ExchangeCredentials,
  opts?: { sinceMs?: number; untilMs?: number; cursor?: string }
): Promise<{ trades: SyncedTrade[]; nextCursor: string | null }> {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const until = opts?.untilMs ?? now;
  // По умолчанию тянем год назад — как в старом route handler.
  const since = opts?.sinceMs ?? now - 365 * 24 * 60 * 60 * 1000;

  const allTrades: SyncedTrade[] = [];
  let finalCursor: string | null = null;

  // Нарезаем на 7-дневные окна — Bybit не отдаёт больше за один запрос.
  for (let windowEnd = until; windowEnd > since; windowEnd -= SEVEN_DAYS_MS) {
    const windowStart = Math.max(windowEnd - SEVEN_DAYS_MS, since);
    let cursor: string | undefined = opts?.cursor;

    // Пагинация курсором внутри одного окна (на случай, если сделок > 100).
    for (let page = 0; page < 10; page++) {
      const params: Record<string, string> = {
        category: "linear",
        limit: "100",
        startTime: String(windowStart),
        endTime: String(windowEnd),
      };
      if (cursor) params.cursor = cursor;

      const data = await signedGet<BybitClosedPnlResponse>(
        "/v5/position/closed-pnl",
        params,
        credentials
      );

      const trades: SyncedTrade[] = data.result.list.map((item) => {
        // Пробуем взять fee из undocumented полей, если Bybit их отдаёт.
        // Если нет — 0 (closedPnl уже включает вычет комиссии).
        const fee = item.execFee ? Number(item.execFee) : 0;
        return {
          exchange: "bybit" as const,
          external_id: item.orderId,
          symbol: item.symbol,
          side: item.side === "Buy" ? "long" : "short",
          qty: Number(item.qty),
          entry_price: Number(item.avgEntryPrice),
          close_price: Number(item.avgExitPrice),
          realized_pnl: Number(item.closedPnl),
          fee,
          funding: 0,
          opened_at: new Date(Number(item.createdTime)).toISOString(),
          closed_at: new Date(Number(item.updatedTime)).toISOString(),
          raw: item,
        };
      });

      allTrades.push(...trades);

      if (!data.result.nextPageCursor) break;
      cursor = data.result.nextPageCursor;
    }
  }

  // Возвращаем null как nextCursor — все 7-дневные окна уже прошли.
  // cursor от opts используется только для первой итерации первого окна,
  // что достаточно для наших сценариев синка.
  return { trades: allTrades, nextCursor: finalCursor };
}

async function testCredentials(credentials: ExchangeCredentials): Promise<void> {
  await signedGet<BybitClosedPnlResponse>(
    "/v5/position/closed-pnl",
    { category: "linear", limit: "1" },
    credentials
  );
}

export const bybitAdapter: ExchangeAdapter = {
  id: "bybit",
  label: "Bybit",
  credentialsSchema: "key+secret",
  fetchClosedTrades,
  testCredentials,
};

// Обратная совместимость — старые импорты fetchBybitClosedPnl / testBybitCredentials.
// deprecated, используйте bybitAdapter.fetchClosedTrades / bybitAdapter.testCredentials.
export { fetchClosedTrades as fetchBybitClosedPnl, testCredentials as testBybitCredentials };
