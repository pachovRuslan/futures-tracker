import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import SignOutButton from "@/components/SignOutButton";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Futures Tracker",
  description: "Личный трекер фьючерсных сделок: Bybit + Bitunix",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // На /login сессии ещё нет — user будет null, это нормально
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email;

  return (
    <html lang="ru">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
            <span className="font-mono-tabular text-sm tracking-wide text-[var(--color-text-muted)]">
              FUTURES_TRACKER
            </span>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/" className="text-[var(--color-text)] hover:text-[var(--color-accent)]">
                Дашборд
              </Link>
              <Link href="/trades" className="text-[var(--color-text)] hover:text-[var(--color-accent)]">
                Сделки
              </Link>
              <Link href="/manual" className="text-[var(--color-text)] hover:text-[var(--color-accent)]">
                Добавить сделку
              </Link>
              <Link href="/connections" className="text-[var(--color-text)] hover:text-[var(--color-accent)]">
                Подключения
              </Link>
              {user && (
                <div className="flex items-center gap-2 pl-3 ml-1 border-l border-[var(--color-border)]">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={displayName ?? "avatar"}
                      width={24}
                      height={24}
                      className="rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center text-[10px] text-[var(--color-text-muted)]">
                      {displayName?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <span className="text-xs text-[var(--color-text-muted)] hidden md:inline">
                    {displayName}
                  </span>
                </div>
              )}
              <SignOutButton />
            </nav>
          </header>
          <main className="flex-1 px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
