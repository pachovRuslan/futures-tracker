import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Список email-ов администраторов из env ADMIN_EMAILS.
 *
 * ВАЖНО: allowlist (кто может войти) и admin list (кто видит /admin) —
 * это РАЗНЫЕ списки. Allowlist хранится в БД (таблица allowed_emails) +
 * fallback на env ALLOWED_EMAILS. Admin list — только через env ADMIN_EMAILS,
 * потому что админов мало (2-3 человека) и редко меняется.
 *
 * Пример env:
 *   ALLOWED_EMAILS=user1@gmail.com,user2@gmail.com,user3@gmail.com  (вход)
 *   ADMIN_EMAILS=you@gmail.com,cofounder@gmail.com                  (админка)
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export interface AdminCheck {
  user: { id: string; email: string } | null;
  error: NextResponse | null;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}

/**
 * Проверка админских прав. Используется во всех /api/admin/* роутах.
 *
 * Логика:
 *   1. Если ADMIN_EMAILS не задан — fail-closed, 403 для всех.
 *   2. Если пользователь не залогинен — 401.
 *   3. Если email не в ADMIN_EMAILS — 403.
 *   4. Иначе — возвращаем user и supabase-клиент для дальнейших запросов.
 */
export async function requireAdmin(): Promise<AdminCheck> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return {
      user: null,
      error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }),
      supabase,
    };
  }

  const adminEmails = getAdminEmails();

  if (adminEmails.length === 0) {
    // Fail-closed: если ADMIN_EMAILS не задан — никто не админ.
    return {
      user: null,
      error: NextResponse.json(
        { error: "ADMIN_EMAILS не задан — админка недоступна" },
        { status: 403 }
      ),
      supabase,
    };
  }

  if (!adminEmails.includes(user.email.toLowerCase())) {
    return {
      user: null,
      error: NextResponse.json({ error: "Доступ запрещён" }, { status: 403 }),
      supabase,
    };
  }

  return {
    user: { id: user.id, email: user.email },
    error: null,
    supabase,
  };
}
