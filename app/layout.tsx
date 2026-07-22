import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import SignOutButton from "@/components/SignOutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { ThemeProvider } from "@/components/ThemeProvider";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Futures Tracker",
  description: "Личный трекер фьючерсных сделок: Bybit, Bitunix, Binance, Bitget, BingX, MEXC",
};

// Предотвращаем FOUC (flash of unstyled content) — скрипт применяет тему
// из localStorage ДО первого рендера, чтобы не было мигания.
const themeInitScript = `
  (function() {
    try {
      var saved = localStorage.getItem('futures-tracker-theme') || 'system';
      var resolved = saved === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : saved;
      document.documentElement.setAttribute('data-theme', resolved);
    } catch (e) {}
  })();
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email;

  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <div className="min-h-screen flex flex-col">
            <header className="border-b border-[var(--color-border)] px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 bg-[var(--color-bg)]/80 backdrop-blur-md z-10">
              {/* Логотип + название */}
              <div className="flex items-center gap-2">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-[var(--color-profit)]">
                  <path d="M3 17l5-5 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 8h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-mono-tabular text-sm tracking-wide text-[var(--color-text-muted)] hidden sm:inline">
                  FUTURES_TRACKER
                </span>
              </div>

              {/* Навигация */}
              <nav className="flex items-center gap-2 sm:gap-5 text-sm">
                <Link href="/" className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors hidden sm:inline">
                  Дашборд
                </Link>
                <Link href="/trades" className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors">
                  Сделки
                </Link>
                <Link href="/balance" className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors hidden sm:inline">
                  Баланс
                </Link>
                <Link href="/manual" className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors hidden sm:inline">
                  Добавить
                </Link>
                <Link href="/connections" className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors hidden sm:inline">
                  Подключения
                </Link>
                <Link href="/admin" className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors hidden sm:inline">
                  Админка
                </Link>

                <div className="flex items-center gap-2 pl-2 sm:pl-3 ml-1 border-l border-[var(--color-border)]">
                  <ThemeToggle />
                  {user && (
                    <div className="flex items-center gap-2">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt={displayName ?? "avatar"}
                          width={28}
                          height={28}
                          className="rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                          {displayName?.[0]?.toUpperCase() ?? "?"}
                        </div>
                      )}
                      <span className="text-xs text-[var(--color-text-muted)] hidden md:inline max-w-[150px] truncate">
                        {displayName}
                      </span>
                    </div>
                  )}
                  <SignOutButton />
                </div>
              </nav>
            </header>
            <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
