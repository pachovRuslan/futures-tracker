import { getSupabaseServerClient } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import type { ExchangeCredentials } from "@/lib/exchanges/types";
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
  // Читаем в т.ч. passphrase_encrypted — для бирж, которые его требуют (Bitget, OKX, KuCoin).
  // Для бирж без passphrase колонка будет null — просто не передаём поле.
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
    // passphrase может быть null для бирж без него (Bybit, Binance, MEXC, BingX).
    if (row.passphrase_encrypted) {
      creds.passphrase = decrypt(row.passphrase_encrypted);
    }
    return { userId: row.user_id, credentials: creds };
  });
}

/**
 * Минимальная задержка между запросами к бирже, чтобы не упереться в
 * rate-limit при синке нескольких пользователей подряд.
 *
 * Bybit: ~120 req/s для V5, но мы консервативны. Bitunix: лимиты ниже.
 * 200 мс = 5 req/s — оставляет запас на пагинацию внутри одного юзера.
 */
const RATE_LIMIT_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Цикл по всем целям с изоляцией ошибок и rate-limit задержкой между юзерами.
 *
 * fn получает (target) — туда входят и userId, и credentials. Это позволяет
 * роуту подставлять user_id в строки trades, не прибегая к обходным путям.
 *
 * Если у одного пользователя ключ стал невалидным (revoked на бирже),
 * мы не роняем синк для всех остальных — логируем и идём дальше.
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
      // Логируем только сообщение — в err может быть URL с подписью.
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sync] user=${target.userId} failed: ${msg}`);
      results.push({ userId: target.userId, upserted: 0, error: msg });
    }
  }
  return results;
}

/**
 * Сводка по результатам синка — для ответа роута.
 */
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
