import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import crypto from "crypto";

export type SyncAuth =
  | { mode: "cron" }
  | { mode: "user"; userId: string }
  | { error: NextResponse };

/**
 * Безопасное сравнение строк — защищает от timing-атак.
 * Если длины разные — сразу false (без утечки времени сравнения).
 * Если одинаковые — constant-time compare через crypto.timingSafeEqual.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Авторизация для sync-роутов (/api/sync/*) + определение режима работы.
 *
 *   1. Vercel cron — заголовок `Authorization: Bearer $CRON_SECRET`, который
 *      Vercel автоматически шлёт при запуске cron-задач. В этом режиме
 *      синкаются ВСЕ подключения всех пользователей (cron не имеет сессии).
 *   2. Залогиненный пользователь — ручной запуск с дашборда. В этом режиме
 *      синкается ТОЛЬКО подключение этого пользователя.
 *
 * Любой другой запрос получает 401. Раньше sync-роуты были полностью
 * публичными — любой, кто знал URL, мог дёргать синк и забивать rate-limit
 * биржи, даже не получая данных.
 *
 * Сравнение CRON_SECRET — timing-safe (crypto.timingSafeEqual), чтобы
 * защитить от атак по времени выполнения.
 */
export async function authenticateSyncRequest(
  req: NextRequest
): Promise<SyncAuth> {
  // 1. Vercel cron — timing-safe сравнение секрета
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && safeEqual(authHeader, `Bearer ${cronSecret}`)) {
      return { mode: "cron" };
    }
  }

  // 2. Пользовательская сессия (ручной запуск)
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }) };
  }
  return { mode: "user", userId: user.id };
}
