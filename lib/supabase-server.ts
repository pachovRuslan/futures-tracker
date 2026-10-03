import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Вызывается из Server Component, где нельзя писать cookies —
            // безопасно игнорировать, middleware всё равно обновит сессию
          }
        },
      },
    }
  );
}

/**
 * Supabase-клиент для API-роутов: Bearer-JWT (мобильное приложение)
 * или cookie-сессия (браузер).
 *
 * Мобильное приложение Expo шлёт Authorization: Bearer <access token>
 * вместо cookie-сессии сайта. Если заголовок есть — создаём клиент
 * с этим JWT: supabase.auth.getUser() валидирует токен на сервере
 * Supabase, а RLS (auth.uid()) работает как у обычного юзера.
 *
 * Нет заголовка — обычный cookie-клиент (сайт, Server Components).
 */
export async function createApiSupabaseClient(
  req: NextRequest
): Promise<SupabaseClient> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );
  }
  return createServerSupabaseClient();
}
