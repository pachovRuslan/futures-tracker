import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { type CookieOptions } from '@supabase/ssr';

// ALLOWED_EMAILS — временный allowlist, пока нет полноценной мультитенантности
// (RLS + user_id на таблице trades). Кто угодно из этого списка может залогиниться
// через Google, но данные у всех пока общие. Список через запятую.
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function middleware(request: NextRequest) {
  // Публичные пути — логин и OAuth callback должны быть доступны без сессии
  const publicPaths = ["/login", "/auth/callback", "/auth/auth-code-error"];
  if (publicPaths.some((p) => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
       setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set({ name, value, ...options })
          );
        }
      },
    }
  );

  // getUser() (а не getSession()) — реально проверяет токен на сервере Supabase,
  // а не просто читает cookie, которую можно подделать
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase();
  const isAllowed = !!email && (allowedEmails.length === 0 || allowedEmails.includes(email));

  if (!user || !isAllowed) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
