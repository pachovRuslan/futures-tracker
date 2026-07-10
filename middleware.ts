import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// ALLOWED_EMAILS — временный allowlist, пока нет полноценной мультитенантности
// (RLS + user_id на таблице trades). Кто угодно из этого списка может залогиниться
// через Google, но данные у всех пока общие. Список через запятую.
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function middleware(request: NextRequest) {
  // Публичные пути — логин, OAuth callback и страница отказа должны быть
  // доступны без полноценного прохождения проверки ниже
  const publicPaths = ["/login", "/auth/callback", "/auth/auth-code-error", "/not-allowed"];
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
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() (а не getSession()) — реально проверяет токен на сервере Supabase,
  // а не просто читает cookie, которую можно подделать
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // FAIL-CLOSED: если ALLOWED_EMAILS пуст — никого не пускаем. Раньше пустой
  // список означал «открытый вход для любого Google-аккаунта», что в проде
  // опасная конфигурация (футган упоминался в README, теперь кодом защищены).
  if (allowedEmails.length === 0) {
    console.error(
      "[middleware] ALLOWED_EMAILS пуст — вход заблокирован. " +
        "Задайте переменную окружения со списком email-ов через запятую."
    );
    return NextResponse.redirect(new URL("/not-allowed", request.url));
  }

  const email = user?.email?.toLowerCase();
  const isAllowed = !!email && allowedEmails.includes(email);

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!isAllowed) {
    return NextResponse.redirect(new URL("/not-allowed", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
