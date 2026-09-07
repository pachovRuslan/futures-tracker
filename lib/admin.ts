import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Список email-ов администраторов из env ADMIN_EMAILS.
 *
 * ВАЖНО: allowlist (кто может войти) и admin list (кто видит /admin) —
 * это РАЗНЫЕ списки. Allowlist хранится в БД (таблица allowed_emails) +
 * fallback на env ALLOWED_EMAILS. Admin list — в БД (таблица admin_emails)
 * + fallback на env ADMIN_EMAILS, потому что:
 *   - SQL функции (security_definer) не имеют доступа к env, проверяют через БД
 *   - middleware/env — для быстрой проверки на каждом HTTP-запросе
 *
 * Пример env:
 *   ALLOWED_EMAILS=user1@gmail.com,user2@gmail.com,user3@gmail.com  (вход)
 *   ADMIN_EMAILS=you@gmail.com,cofounder@gmail.com                  (админка)
 *
 * После миграции 08 нужно также добавить админов в таблицу admin_emails:
 *   insert into admin_emails (email) values ('you@gmail.com');
 */
export function getAdminEmailsFromEnv(): string[] {
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
 *   1. Если пользователь не залогинен — 401.
 *   2. Проверяем admin_emails в БД (таблица admin_emails).
 *   3. Если в БД нет — fallback на env ADMIN_EMAILS.
 *   4. Если и там нет — fail-closed, 403.
 *
 * ВАЖНО: SQL-функции (get_users_overview и др.) проверяют admin ТОЛЬКО
 * через таблицу admin_emails (security_definer не имеет доступа к env).
 * Поэтому админы должны быть добавлены в таблицу admin_emails в БД,
 * иначе RPC-функции будут возвращать пустой результат даже для админов.
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

  const email = user.email.toLowerCase();

  // 1. Проверяем admin_emails в БД (основной источник для SQL функций)
  const { data: dbAdminEmails, error: dbError } = await supabase
    .from("admin_emails")
    .select("email");

  let isAdminInDb = false;
  if (!dbError && dbAdminEmails) {
    isAdminInDb = dbAdminEmails.some(
      (row: { email: string }) => row.email.toLowerCase() === email
    );
  }

  // 2. Fallback на env ADMIN_EMAILS (если БД недоступна или таблица пуста)
  const envAdminEmails = getAdminEmailsFromEnv();
  const isAdminInEnv = envAdminEmails.includes(email);

  if (!isAdminInDb && !isAdminInEnv) {
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
