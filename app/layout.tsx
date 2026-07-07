import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Futures Tracker",
  description: "Личный трекер фьючерсных сделок: Bybit + Bitunix",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
            <span className="font-mono-tabular text-sm tracking-wide text-[var(--color-text-muted)]">
              FUTURES_TRACKER
            </span>
            <nav className="flex gap-5 text-sm">
              <Link href="/" className="text-[var(--color-text)] hover:text-[var(--color-accent)]">
                Дашборд
              </Link>
              <Link href="/trades" className="text-[var(--color-text)] hover:text-[var(--color-accent)]">
                Сделки
              </Link>
            </nav>
          </header>
          <main className="flex-1 px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
