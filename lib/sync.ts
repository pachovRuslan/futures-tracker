import { getSupabaseServerClient } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import type { ExchangeCredentials, ExchangeAdapter } from "@/lib/exchanges/types";
import type { SyncAuth } from "@/lib/auth";
import { EXCHANGES, isValidExchange } from "@/lib/exchanges";

export interface SyncTarget {
  userId: string;
  credentials: ExchangeCredentials;
}

export interface SyncUserResult {
  userId: string;
  upserted: number;
  error?: string;
}

// ============================================================
// fetchWithRetry — HTTP-запрос с timeout, retry и backoff
// ============================================================

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTTP-запрос с:
 *   - timeout (AbortController, по умолчанию 15 сек)
 *   - retry (по умолчанию 3 попытки)
 *   - exponential backoff (1с, 2с, 4с)
 *   - Retry-After header (если биржа отдаёт 429/503)
 *
 * Используется во всех адаптерах вместо голого fetch().
 * Бросает Error только если все попытки исчерпаны.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  opts: { timeoutMs?: number; retries?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = opts;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      // 429 Too Many Requests или 503 Service Unavailable — retry с backoff
      if ((res.status === 429 || res.status === 503) && attempt < retries) {
        // Читаем Retry-After header (в секундах), по умолчанию 2^attempt сек
        const retryAfter = res.headers.get("retry-after");
        const delaySec = retryAfter ? parseInt(retryAfter, 10) : Math.pow(2, attempt);
        const delayMs = isNaN(delaySec) ? Math.pow(2, attempt) * 1000 : delaySec * 1000;
        console.warn(
          `[fetchWithRetry] ${res.status} on ${url.split("?")[0]}, retry ${attempt + 1}/${retries} after ${delayMs}ms`
        );
        await sleep(delayMs);
        continue;
      }

      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt === retries) throw err;

      // Network error / timeout — retry с exponential backoff
      const delayMs = Math.pow(2, attempt) * 1000;
      console.warn(
        `[fetchWithRetry] ${(err as Error).name} on ${url.split("?")[0]}, retry ${attempt + 1}/${retries} after ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }

  // Не должны сюда дойти, но TS требует return
  throw new Error("fetchWithRetry: все попытки исчерпаны");
}

// ============================================================
// syncUserExchange — общий цикл пагинации (убран из 2 роутов)
// ============================================================

/**
 * Синк одной биржи для одного пользователя.
 * Общий цикл пагинации — вызывается из /api/sync/[exchange] и /api/sync/cron.
 *
 * Возвращает количество upserted сделок.
 * Бросает Error при неудаче (ловится в syncAllUsers).
 */
export async function syncUserExchange(
  adapter: ExchangeAdapter,
  credentials: ExchangeCredentials,
  userId: string,
  sinceMs: number,
  untilMs: number
): Promise<number> {
  const supabase = getSupabaseServerClient();
  let userUpserted = 0;
  let cursor: string | undefined;

  for (let page = 0; page < 100; page++) {
    const { trades, nextCursor } = await adapter.fetchClosedTrades(credentials, {
      sinceMs,
      untilMs,
      cursor,
    });

    if (trades.length > 0) {
      const rows = trades.map((t) => ({ ...t, user_id: userId }));
      const { error } = await supabase
        .from("trades")
        .upsert(rows, { onConflict: "user_id,exchange,external_id" });
      if (error) throw error;
      userUpserted += trades.length;
    }

    if (!nextCursor) break;
    cursor = nextCursor;
  }

  return userUpserted;
}

// ============================================================
// getSyncTargets — список подключений для синка
// ============================================================

/**
 * Возвращает список подключений, которые нужно просинкать в текущем запуске.
 *
 *   - mode === "cron": все подключения этой биржи (цикл по всем юзерам)
 *   - mode === "user": только подключение текущего пользователя
 *
 * Ключи расшифровываются здесь же — наружу отдаются готовые credentials.
 */
export async function getSyncTargets(
  exchange: (typeof EXCHANGES)[number],
  auth: SyncAuth
): Promise<SyncTarget[]> {
  if ("error" in auth) return [];

  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("exchange_connections")
    .select("user_id, api_key_encrypted, api_secret_encrypted, passphrase_encrypted")
    .eq("exchange", exchange);

  if (auth.mode === "user") {
    query = query.eq("user_id", auth.userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map((row) => {
    const creds: ExchangeCredentials = {
      apiKey: decrypt(row.api_key_encrypted),
      apiSecret: decrypt(row.api_secret_encrypted),
    };
    if (row.passphrase_encrypted) {
      creds.passphrase = decrypt(row.passphrase_encrypted);
    }
    return { userId: row.user_id, credentials: creds };
  });
}

// ============================================================
// syncAllUsers — цикл по целям с изоляцией ошибок
// ============================================================

const RATE_LIMIT_DELAY_MS = 200;

/**
 * Цикл по всем целям с изоляцией ошибок и rate-limit задержкой между юзерами.
 *
 * fn получает (target) — туда входят и userId, и credentials.
 * Если у одного пользователя ключ стал невалидным, остальные синкаются.
 */
export async function syncAllUsers(
  targets: SyncTarget[],
  fn: (target: SyncTarget) => Promise<number>
): Promise<SyncUserResult[]> {
  const results: SyncUserResult[] = [];
  for (let i = 0; i < targets.length; i++) {
    if (i > 0) await sleep(RATE_LIMIT_DELAY_MS);
    const target = targets[i];
    try {
      const upserted = await fn(target);
      results.push({ userId: target.userId, upserted });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sync] user=${target.userId} failed: ${msg}`);
      results.push({ userId: target.userId, upserted: 0, error: msg });
    }
  }
  return results;
}

// ============================================================
// summarizeResults — сводка для ответа роута
// ============================================================

export function summarizeResults(results: SyncUserResult[]): {
  processed: number;
  succeeded: number;
  failed: number;
  upserted: number;
  errors: { userId: string; error: string }[];
} {
  return {
    processed: results.length,
    succeeded: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
    upserted: results.reduce((acc, r) => acc + r.upserted, 0),
    errors: results
      .filter((r) => r.error)
      .map((r) => ({ userId: r.userId, error: r.error! })),
  };
}
