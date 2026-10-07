// ============================================================
// fetchWithRetry — HTTP-запрос с timeout, retry и backoff
// ============================================================
//
// Живёт в ОТДЕЛЬНОМ модуле (не в lib/sync.ts), чтобы разорвать
// циклическую зависимость:
//   lib/sync.ts ──> lib/exchanges/index ──> адаптеры ──> lib/sync.ts
// Адаптеры тянут отсюда только этот примитив; sync.ts про адаптеры
// знает, но обратной стрелки больше нет.

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 3;

/** Пауза между итерациями backoff; экспортирована для lib/sync.ts
 *  (RATE_LIMIT_DELAY_MS между юзерами в syncAllUsers). */
export function sleep(ms: number): Promise<void> {
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
