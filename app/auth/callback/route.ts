import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Безопасный путь для редиректа после логина.
 * Защищает от open redirect атак (?next=//evil.com/x).
 *
 * Разрешены только:
 *   - пути, начинающиеся с "/" (относительные)
 *   - НЕ начинающиеся с "//" (protocol-relative URL = внешний домен)
 *   - НЕ содержащие "://" (явный протокол = внешний домен)
 *
 * Если next невалиден — возвращаем "/" (домашняя страница).
 */
function safeNext(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/"; // protocol-relative = external
  if (next.includes("://")) return "/"; // explicit protocol = external
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
