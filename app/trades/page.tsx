"use client";

import { useEffect, useState, useCallback } from "react";
import type { Trade, Exchange } from "@/lib/types";
import { EXCHANGES, REGISTRY } from "@/lib/exchanges";

function fmt(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

function fmtFee(fee: number, exchange: Exchange): string {
  // Bybit closedPnl уже включает комиссию, и в API её можно получить только
  // через отдельный эндпоинт /v5/account/transaction-log. Пока показываем «—»,
  // чтобы не вводить в заблуждение нулями. Это известное ограничение — TODO.
  if (exchange === "bybit" && fee === 0) return "—";
  return fmt(fee);
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

function NotesCell({ trade, onSaved }: { trade: Trade; onSaved: () => void }) {
  const [value, setValue] = useState(trade.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (value === (trade.notes ?? "")) return;
    setSaving(true);
    try {
      await fetch(`/api/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value || null }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      placeholder="заметка..."
      disabled={saving}
      className="w-full bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none text-xs text-[var(--color-text-muted)] py-1"
    />
  );
}

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filter, setFilter] = useState<Exchange | "all">("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Раньше тут был баг: при filter==="all" URL получался вида
    // `/api/trades&limit=500` (без "?"), и limit не парсился — сервер
    // отдавал дефолтные 200 записей вместо 500. URLSearchParams строит
    // валидный query string в обоих случаях.
    const params = new URLSearchParams({ limit: "500" });
    if (filter !== "all") params.set("exchange", filter);
    const res = await fetch(`/api/trades?${params.toString()}`);
    const data = await res.json();
    setTrades(data.trades ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Удалить эту сделку?")) return;
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3 flex-wrap">
        {(["all", ...EXCHANGES, "manual"] as const).map((ex) => (
          <button
            key={ex}
            onClick={() => setFilter(ex)}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              filter === ex
                ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-surface)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            {ex === "all" ? "Все" : REGISTRY[ex as (typeof EXCHANGES)[number]]?.label ?? ex}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
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
              <th className="text-left px-4 py-3 font-normal w-48">Заметки</th>
              <th className="px-4 py-3 font-normal"></th>
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
                  <td className="px-4 py-2.5 font-mono-tabular text-[var(--color-text-muted)] whitespace-nowrap">
                    {fmtDate(t.closed_at)}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                    {t.exchange === "manual" ? "manual" : REGISTRY[t.exchange as (typeof EXCHANGES)[number]]?.label ?? t.exchange}
                  </td>
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
                    {fmtFee(t.fee, t.exchange)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono-tabular ${
                      positive ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {fmt(t.realized_pnl - t.fee + t.funding)}
                  </td>
                  <td className="px-2 py-1">
                    <NotesCell trade={t} onSaved={load} />
                  </td>
                  <td className="px-4 py-2.5">
                    {t.exchange === "manual" && (
                      <button
                        onClick={() => remove(t.id)}
                        className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-loss)]"
                      >
                        Удалить
                      </button>
                    )}
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
