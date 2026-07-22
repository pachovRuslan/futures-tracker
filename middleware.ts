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
  // Если БД недоступна или таблица пуста — fallback на env ALLOWED_EMAILS.
  let isAllowed = false;
  try {
    const { data: dbAllowlist, error } = await supabase
      .from("allowed_emails")
      .select("email");
    if (error) throw error;

    if (dbAllowlist && dbAllowlist.length > 0) {
      isAllowed = dbAllowlist.some((row) => row.email.toLowerCase() === email);
    } else {
      // Таблица пуста — используем env как fallback.
      isAllowed = envAllowedEmails.includes(email);
    }
  } catch (err) {
    console.error(
      "[middleware] Ошибка чтения allowed_emails из БД, fallback на env:",
      err instanceof Error ? err.message : String(err)
    );
    isAllowed = envAllowedEmails.includes(email);
  }

  // FAIL-CLOSED: если allowlist пуст (ни в БД, ни в env) — никого не пускаем.
  // Раньше пустой список означал «открытый вход для любого Google-аккаунта».
  if (!isAllowed) {
    // Дополнительная проверка: если allowlist вообще пуст — показываем
    // понятную ошибку. Иначе — обычный /not-allowed.
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
