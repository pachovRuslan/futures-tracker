import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Fallback allowlist из env — используется, если БД недоступна или пуста.
// Основной источник allowlist теперь — таблица allowed_emails в Supabase,
// управляемая через админку. env остаётся для обратной совместимости и для
// первого входа (пока таблицу не заполнили).
const envAllowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Список админов из env ADMIN_EMAILS — кто видит /admin и может управлять
// allowlist. Это ОТДЕЛЬНЫЙ список от ALLOWED_EMAILS (который разрешает вход).
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Путь /api/sync/cron дёргает Vercel cron с заголовком Authorization: Bearer.
// Middleware его не трогает — авторизация внутри роута через CRON_SECRET.
const CRON_PATH = "/api/sync/cron";

export async function middleware(request: NextRequest) {
  // Публичные пути — логин, OAuth callback, страница отказа,静态 assets.
  const publicPaths = ["/login", "/auth/callback", "/auth/auth-code-error", "/not-allowed"];
  if (publicPaths.some((p) => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Vercel cron-запросы к /api/sync/cron идут с заголовком Authorization.
  // Их не нужно прогонять через Supabase Auth — роут сам проверит CRON_SECRET.
  if (request.nextUrl.pathname === CRON_PATH) {
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

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const email = user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.redirect(new URL("/not-allowed", request.url));
  }

  // Allowlist из БД — основной источник.
  // env ALLOWED_EMAILS ВСЕГДА работает как дополнительный fallback поверх БД.
  // Это защищает от ситуации: вы добавили email в БД через админку,
  // но забыли добавить свой собственный — и потеряли доступ.
  // С этим фиксом env-allowlist продолжает пускать вас, даже если в БД
  // вашего email-а нет.
  let isAllowed = envAllowedEmails.includes(email);
  try {
    const { data: dbAllowlist, error } = await supabase
      .from("allowed_emails")
      .select("email");
    if (error) throw error;

    if (dbAllowlist && dbAllowlist.length > 0) {
      // БД не пуста — проверяем email и в БД, и в env (объединение).
      // Если email есть в любом из источников — пускаем.
      isAllowed =
        isAllowed || dbAllowlist.some((row) => row.email.toLowerCase() === email);
    }
    // Если БД пуста — остаётся только env (уже установлен в isAllowed).
  } catch (err) {
    console.error(
      "[middleware] Ошибка чтения allowed_emails из БД, fallback на env:",
      err instanceof Error ? err.message : String(err)
    );
    // isAllowed уже установлен из env выше — оставляем как есть.
  }

  // FAIL-CLOSED: если allowlist пуст (ни в БД, ни в env) — никого не пускаем.
  if (!isAllowed) {
    return NextResponse.redirect(new URL("/not-allowed", request.url));
  }

  // Защита админки: пути /admin и /api/admin/* требуют ADMIN_EMAILS.
  // Если ADMIN_EMAILS не задан или текущий юзер не в нём — 403.
  const isAdminPath =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/api/admin");

  if (isAdminPath) {
    if (adminEmails.length === 0) {
      return NextResponse.redirect(new URL("/not-allowed", request.url));
    }
    if (!adminEmails.includes(email)) {
      return NextResponse.redirect(new URL("/not-allowed", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
