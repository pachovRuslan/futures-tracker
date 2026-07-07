"use client";

import { useEffect, useState } from "react";
import type { Trade, Exchange } from "@/lib/types";

function fmt(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filter, setFilter] = useState<Exchange | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = filter === "all" ? "" : `?exchange=${filter}`;
    fetch(`/api/trades${qs}&limit=500`.replace("?&", "?"))
      .then((r) => r.json())
      .then((data) => setTrades(data.trades ?? []))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        {(["all", "bybit", "bitunix"] as const).map((ex) => (
          <button
            key={ex}
            onClick={() => setFilter(ex)}
            className={`px-3 py-1.5 rounded-md text-sm border ${
              filter === ex
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {ex === "all" ? "Все" : ex}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface)] text-[var(--color-text-faint)] text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-normal">Закрыта</th>
              <th className="text-left px-4 py-3 font-normal">Биржа</th>
              <th className="text-left px-4 py-3 font-normal">Символ</th>
              <th className="text-left px-4 py-3 font-normal">Сторона</th>
              <th className="text-right px-4 py-3 font-normal">Вход</th>
              <th className="text-right px-4 py-3 font-normal">Выход</th>
              <th className="text-right px-4 py-3 font-normal">Комиссия</th>
              <th className="text-right px-4 py-3 font-normal">PnL</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => {
              const positive = t.realized_pnl >= 0;
              return (
                <tr
                  key={t.id}
                  className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                >
                  <td className="px-4 py-2.5 font-mono-tabular text-[var(--color-text-muted)]">
                    {fmtDate(t.closed_at)}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{t.exchange}</td>
                  <td className="px-4 py-2.5 font-mono-tabular">{t.symbol}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        t.side === "long" ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
                      }
                    >
                      {t.side === "long" ? "Long" : "Short"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">{fmt(t.entry_price)}</td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">{fmt(t.close_price)}</td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular text-[var(--color-text-muted)]">
                    {fmt(t.fee)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono-tabular ${
                      positive ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {fmt(t.realized_pnl - t.fee + t.funding)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && trades.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[var(--color-text-faint)]">
            Нет сделок за выбранный фильтр
          </div>
        )}
      </div>
    </div>
  );
}
