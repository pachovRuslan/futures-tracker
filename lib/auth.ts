import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Авторизация для sync-роутов (/api/sync/*).
 *
 * Пропускает один из двух случаев:
 *   1. Vercel cron — он автоматически шлёт заголовок
 *      `Authorization: Bearer $CRON_SECRET`, если переменная задана в env.
 *   2. Залогиненный пользователь — для ручного запуска с дашборда
 *      (кнопки "Синк Bybit" / "Синк Bitunix").
 *
 * Любой другой запрос получает 401. Раньше sync-роуты были полностью
 * публичными — любой, кто знал URL, мог дёргать синк и забивать rate-limit
 * биржи, даже не получая данных.
 *
 * Возвращает null, если запрос авторизован, либо NextResponse с ошибкой.
 */
export async function authorizeSyncRequest(
  req: NextRequest
): Promise<NextResponse | null> {
  // 1. Vercel cron
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) {
      return null;
    }
  }

  // 2. Пользовательская сессия (ручной запуск)
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  return null;
}
