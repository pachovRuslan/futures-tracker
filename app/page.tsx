"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import Link from "next/link";
import type { MonthlySummary, Trade } from "@/lib/types";
import { EXCHANGES, REGISTRY } from "@/lib/exchanges";

function fmt(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtFee(fee: number, exchange: string): string {
  if (exchange === "bybit" && fee === 0) return "—";
  return fee.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

function PnlValue({ value, size = "md" }: { value: number; size?: "md" | "lg" | "xl" }) {
  const positive = value >= 0;
  const sizeClass =
    size === "xl" ? "text-4xl" : size === "lg" ? "text-2xl" : "text-xl";
  return (
    <span
      className={`font-mono-tabular font-semibold ${sizeClass} ${
        positive ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
      }`}
    >
      {positive ? "+" : ""}
      {fmt(value)}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-2">
        {label}
      </div>
      <div className="font-mono-tabular text-2xl">{value}</div>
      {hint && (
        <div className="text-xs text-[var(--color-text-faint)] mt-1">{hint}</div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-4">
      <div className="skeleton h-3 w-20 mb-2" />
      <div className="skeleton h-7 w-24" />
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<MonthlySummary[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number; current: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/trades?limit=500");
    const data = await res.json();
    setSummary(
      (data.summary ?? []).map((s: any) => ({
        month: s.month,
        totalPnl: Number(s.total_pnl),
        totalFee: Number(s.total_fee),
        totalFunding: Number(s.total_funding),
        netPnl: Number(s.net_pnl),
        tradeCount: Number(s.trade_count),
        winRate: Number(s.win_rate ?? 0),
      }))
    );
    setTrades(data.trades ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Синк ВСЕХ подключённых бирж последовательно.
  // Для каждой — отдельный запрос к /api/sync/[exchange].
  // Прогресс показываем юзеру, чтобы он понимал, что процесс идёт.
  async function syncAll() {
    setSyncing(true);
    setSyncMsg(null);
    setSyncProgress({ done: 0, total: EXCHANGES.length, current: REGISTRY[EXCHANGES[0]].label });

    let totalUpserted = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < EXCHANGES.length; i++) {
      const ex = EXCHANGES[i];
      setSyncProgress({ done: i, total: EXCHANGES.length, current: REGISTRY[ex].label });
      try {
        const res = await fetch(`/api/sync/${ex}`);
        const data = await res.json();
        if (!res.ok || !data.ok) {
          // Не падаем — идём к следующей бирже. Ошибку покажем в итоге.
          if (data.error && !data.error.includes("не подключён")) {
            errors.push(`${REGISTRY[ex].label}: ${data.error}`);
            failedCount++;
          }
        } else {
          totalUpserted += data.upserted ?? 0;
        }
      } catch (e) {
        errors.push(`${REGISTRY[ex].label}: ${e instanceof Error ? e.message : String(e)}`);
        failedCount++;
      }
    }

    setSyncProgress({ done: EXCHANGES.length, total: EXCHANGES.length, current: "" });
    setSyncing(false);
    setSyncProgress(null);

    if (failedCount === 0) {
      setSyncMsg(`Готово — обновлено ${totalUpserted} записей`);
    } else if (failedCount === EXCHANGES.length) {
      setSyncMsg(`Все синки упали: ${errors.join("; ")}`);
    } else {
      setSyncMsg(`Обновлено ${totalUpserted} записей. Ошибки: ${errors.join("; ")}`);
    }

    await load();
  }

  // Итог по всем сделкам — из monthly_summary (БД-агрегат, уважает RLS).
  const totalNet = summary.reduce((acc, s) => acc + s.netPnl, 0);
  const currentMonth = summary[0];

  const currentMonthTrades = currentMonth
    ? trades.filter((t) => t.closed_at.slice(0, 7) === currentMonth.month)
    : [];

  const currentMonthNetPnls = currentMonthTrades.map((t) => t.realized_pnl - t.fee + t.funding);
  const winCount = currentMonthNetPnls.filter((p) => p > 0).length;
  const lossCount = currentMonthNetPnls.filter((p) => p <= 0).length;
  const grossProfit = currentMonthNetPnls.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const grossLoss = currentMonthNetPnls.filter((p) => p <= 0).reduce((a, b) => a + b, 0);

  const chartData = [...summary].reverse().map((s) => ({ month: s.month, netPnl: s.netPnl }));

  // Последние 5 сделок для блока на дашборде
  const recentTrades = trades.slice(0, 5);

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header: итог + синк */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-1">
            Итог по всем сделкам
          </div>
          {loading ? (
            <div className="skeleton h-10 w-40" />
          ) : (
            <PnlValue value={totalNet} size="xl" />
          )}
          <div className="text-xs text-[var(--color-text-faint)] mt-1">
            {summary.length} {summary.length === 1 ? "месяц" : "месяцев"} в истории
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            onClick={syncAll}
            disabled={syncing}
            className="btn btn-primary"
          >
            {syncing ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Синк...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                Синк всё
              </>
            )}
          </button>
          {syncProgress && (
            <div className="text-xs text-[var(--color-text-muted)] font-mono-tabular">
              {syncProgress.done} / {syncProgress.total} — {syncProgress.current}
            </div>
          )}
          {!syncing && !syncProgress && (
            <div className="text-xs text-[var(--color-text-faint)]">
              {EXCHANGES.length} бирж · по одной
            </div>
          )}
        </div>
      </div>

      {syncMsg && (
        <div className="text-sm text-[var(--color-text-muted)] font-mono-tabular">{syncMsg}</div>
      )}

      {/* Статистика текущего месяца */}
      {currentMonth && (
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-3">
            Статистика {currentMonth.month}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <StatCard label="Сделок" value={String(currentMonth.tradeCount)} />
                <StatCard
                  label="Приб / Убыт"
                  value={
                    <span>
                      <span className="text-[var(--color-profit)]">{winCount}</span>
                      {" / "}
                      <span className="text-[var(--color-loss)]">{lossCount}</span>
                    </span>
                  }
                />
                <StatCard label="Win-rate" value={`${currentMonth.winRate}%`} />
                <StatCard label="Итог месяца" value={<PnlValue value={currentMonth.netPnl} />} />
                <StatCard label="Общая прибыль" value={<PnlValue value={grossProfit} />} />
                <StatCard label="Общий убыток" value={<PnlValue value={grossLoss} />} />
                <StatCard label="Комиссии" value={fmt(currentMonth.totalFee)} />
                <StatCard
                  label="Фандинг"
                  value={
                    <span className={currentMonth.totalFunding >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}>
                      {currentMonth.totalFunding >= 0 ? "+" : ""}
                      {fmt(currentMonth.totalFunding)}
                    </span>
                  }
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* График PnL по месяцам */}
      <div className="card p-5">
        <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-4">
          PnL по месяцам
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--color-text-faint)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--color-text-faint)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: "var(--color-surface-hover)" }}
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text)",
              }}
            />
            <Bar dataKey="netPnl" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Последние сделки */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
            Последние сделки
          </div>
          <Link
            href="/trades"
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Все сделки →
          </Link>
        </div>
        {loading ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-8 w-full" />
            ))}
          </div>
        ) : recentTrades.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-faint)]">
            Сделок пока нет — нажмите «Синк всё», чтобы подтянуть историю.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {recentTrades.map((t) => {
              const net = t.realized_pnl - t.fee + t.funding;
              const positive = net >= 0;
              const exchangeLabel = t.exchange === "manual" ? "manual" : REGISTRY[t.exchange as (typeof EXCHANGES)[number]]?.label ?? t.exchange;
              return (
                <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-[var(--color-surface-hover)] transition-colors">
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
                    <span className="text-xs text-[var(--color-text-faint)] hidden sm:inline">{exchangeLabel}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs text-[var(--color-text-faint)] hidden sm:inline font-mono-tabular">
                      {fmtDate(t.closed_at)}
                    </span>
                    <span
                      className={`font-mono-tabular text-sm ${positive ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}`}
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
    </div>
  );
}
