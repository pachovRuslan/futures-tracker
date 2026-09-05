"use client";

import Link from "next/link";
import type { Trade } from "@/lib/types";
import { EXCHANGES, REGISTRY } from "@/lib/exchanges";

interface RecentTradesProps {
  trades: Trade[];
  isFilterActive: boolean;
  loading: boolean;
}

function fmt(n: number): string {
  return n.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Блок «Последние сделки» — 5 строк на дашборде.
 * Показывает: LONG/SHORT бейдж, символ, биржу, дату, PnL.
 * Если фильтр активен — показывает отфильтрованные сделки.
 * Ссылка «Все сделки →» ведёт на /trades.
 */
export default function RecentTrades({
  trades,
  isFilterActive,
  loading,
}: RecentTradesProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
          Последние сделки
          {isFilterActive && (
            <span className="ml-2 text-[var(--color-accent)]">(отфильтровано)</span>
          )}
        </div>
        <Link href="/trades" className="text-xs text-[var(--color-accent)] hover:underline">
          Все сделки →
        </Link>
      </div>
      {loading ? (
        <div className="p-5 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-8 w-full" />
          ))}
        </div>
      ) : trades.length === 0 ? (
        <div className="p-8 text-center text-sm text-[var(--color-text-faint)]">
          {isFilterActive
            ? "Нет сделок по выбранным биржам. Измените фильтр или синкните биржи."
            : "Сделок пока нет — нажмите «Синк всё», чтобы подтянуть историю."}
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {trades.map((t) => {
            const net = t.realized_pnl - t.fee + t.funding;
            const positive = net >= 0;
            const exchangeLabel =
              t.exchange === "manual"
                ? "manual"
                : REGISTRY[t.exchange as (typeof EXCHANGES)[number]]?.label ?? t.exchange;
            return (
              <div
                key={t.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`text-xs font-mono-tabular px-2 py-0.5 rounded ${
                      t.side === "long"
                        ? "bg-[var(--color-profit-dim)] text-[var(--color-profit)]"
                        : "bg-[var(--color-loss-dim)] text-[var(--color-loss)]"
                    }`}
                  >
                    {t.side === "long" ? "LONG" : "SHORT"}
                  </span>
                  <span className="font-mono-tabular text-sm truncate">{t.symbol}</span>
                  <span className="text-xs text-[var(--color-text-faint)] hidden sm:inline">
                    {exchangeLabel}
                  </span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-[var(--color-text-faint)] hidden sm:inline font-mono-tabular">
                    {fmtDate(t.closed_at)}
                  </span>
                  <span
                    className={`font-mono-tabular text-sm ${
                      positive ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {fmt(net)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
