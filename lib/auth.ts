import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
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
 *   2. Bearer-JWT мобильного приложения (Expo) — токен Supabase Access Token.
 *      В этом режиме синкается ТОЛЬКО подключение этого пользователя.
 *   3. Залогиненный пользователь (cookie-сессия сайта) — ручной запуск
 *      с дашборда. В этом режиме синкается ТОЛЬКО подключение этого юзера.
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
  const authHeader = req.headers.get("authorization");

  // 1. Vercel cron — timing-safe сравнение секрета
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader) {
    if (safeEqual(authHeader, `Bearer ${cronSecret}`)) {
      return { mode: "cron" };
    }
  }

  // 2. Bearer-JWT мобильного приложения — валидируем токен на сервере
  //    Supabase. Проверяем ДО cookie-ветки: если заголовок есть, юзер
  //    точно не браузер. Невалидный JWT → 401 без fallback на cookie.
  if (authHeader?.startsWith("Bearer ")) {
    const mobile = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await mobile.auth.getUser();
    if (!user) {
      return { error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }) };
    }
    return { mode: "user", userId: user.id };
  }

  // 3. Пользовательская сессия (ручной запуск с сайта)
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }) };
  }
  return { mode: "user", userId: user.id };
}
