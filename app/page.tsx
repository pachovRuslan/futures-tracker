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
import BalanceChart from "@/components/BalanceChart";

const ALL_EXCHANGES_WITH_MANUAL = [...EXCHANGES, "manual"] as const;
type FilterableExchange = (typeof ALL_EXCHANGES_WITH_MANUAL)[number];

const FILTER_STORAGE_KEY = "futures-tracker-exchange-filter";
const GRAPH_TAB_STORAGE_KEY = "futures-tracker-graph-tab";
const SELECTED_MONTH_STORAGE_KEY = "futures-tracker-selected-month";

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

/**
 * Загрузка выбранных бирж из localStorage.
 * По умолчанию все выбраны.
 */
function loadSelectedExchanges(): Set<FilterableExchange> {
  if (typeof window === "undefined") return new Set(ALL_EXCHANGES_WITH_MANUAL);
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!saved) return new Set(ALL_EXCHANGES_WITH_MANUAL);
    const arr = JSON.parse(saved) as string[];
    const valid = arr.filter((e) =>
      (ALL_EXCHANGES_WITH_MANUAL as readonly string[]).includes(e)
    ) as FilterableExchange[];
    return valid.length > 0 ? new Set(valid) : new Set(ALL_EXCHANGES_WITH_MANUAL);
  } catch {
    return new Set(ALL_EXCHANGES_WITH_MANUAL);
  }
}

function loadGraphTab(): "balance" | "pnl" {
  if (typeof window === "undefined") return "balance";
  try {
    const saved = localStorage.getItem(GRAPH_TAB_STORAGE_KEY);
    if (saved === "pnl" || saved === "balance") return saved;
  } catch {}
  return "balance";
}

function loadSelectedMonth(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(SELECTED_MONTH_STORAGE_KEY);
    if (saved && saved.length === 7) return saved; // YYYY-MM
  } catch {}
  return null;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<MonthlySummary[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number; current: string } | null>(null);

  // Фильтр бирж — влияет только на PnL (итог, статистика месяца, последние сделки, график PnL).
  // График «Спот vs Фьючерс» не зависит от этого фильтра (он использует отдельные данные баланса).
  const [selectedExchanges, setSelectedExchanges] = useState<Set<FilterableExchange>>(new Set(ALL_EXCHANGES_WITH_MANUAL));

  // Активный график на дашборде
  const [graphTab, setGraphTab] = useState<"balance" | "pnl">("balance");

  // Выбранный месяц в графике PnL (клик по столбцу).
  // null = самый свежий месяц (текущий). При клике на столбец —
  // статистика сверху и win-rate пересчитываются для выбранного месяца.
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Загружаем выбор из localStorage после монтирования (избегаем SSR mismatch)
  useEffect(() => {
    setSelectedExchanges(loadSelectedExchanges());
    setGraphTab(loadGraphTab());
    setSelectedMonth(loadSelectedMonth());
  }, []);

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

  function toggleExchange(ex: FilterableExchange) {
    setSelectedExchanges((prev) => {
      const next = new Set(prev);
      if (next.has(ex)) {
        // Не даём снять последний — иначе останется пустой фильтр
        if (next.size > 1) next.delete(ex);
      } else {
        next.add(ex);
      }
      try {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }

  function selectAllExchanges() {
    setSelectedExchanges(new Set(ALL_EXCHANGES_WITH_MANUAL));
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(Array.from(ALL_EXCHANGES_WITH_MANUAL)));
    } catch {}
  }

  function changeGraphTab(tab: "balance" | "pnl") {
    setGraphTab(tab);
    try {
      localStorage.setItem(GRAPH_TAB_STORAGE_KEY, tab);
    } catch {}
  }

  function selectMonth(month: string) {
    setSelectedMonth(month);
    try {
      localStorage.setItem(SELECTED_MONTH_STORAGE_KEY, month);
    } catch {}
  }

  function resetMonth() {
    setSelectedMonth(null);
    try {
      localStorage.removeItem(SELECTED_MONTH_STORAGE_KEY);
    } catch {}
  }

  // Синк ВСЕХ подключённых бирж последовательно.
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

  // === ФИЛЬТРАЦИЯ СДЕЛОК ПО ВЫБРАННЫМ БИРЖАМ ===
  // Влияет на: итог PnL, статистика месяца, последние сделки, график PnL по месяцам.
  // НЕ влияет на: график «Спот vs Фьючерс» (он использует отдельные данные баланса).
  const filteredTrades = trades.filter((t) => selectedExchanges.has(t.exchange as FilterableExchange));

  // Итог PnL по выбранным биржам — считается из filteredTrades, а не из summary,
  // потому что summary — это БД-агрегат по ВСЕМ биржам, без учёта фильтра.
  const totalNet = filteredTrades.reduce(
    (acc, t) => acc + (t.realized_pnl - t.fee + t.funding),
    0
  );

  // === ГРАФИК PnL ПО МЕСЯЦАМ ===
  // Пересчитываем из filteredTrades (с учётом фильтра бирж).
  // Группируем по месяцу closed_at.
  const chartData = (() => {
    const byMonth = new Map<string, { netPnl: number; trades: number }>();
    for (const t of filteredTrades) {
      const month = t.closed_at.slice(0, 7);
      const net = t.realized_pnl - t.fee + t.funding;
      const existing = byMonth.get(month) ?? { netPnl: 0, trades: 0 };
      existing.netPnl += net;
      existing.trades += 1;
      byMonth.set(month, existing);
    }
    return Array.from(byMonth.entries())
      .map(([month, v]) => ({ month, netPnl: v.netPnl, trades: v.trades }))
      .sort((a, b) => a.month.localeCompare(b.month));
  })();

  // === ВЫБРАННЫЙ МЕСЯЦ ===
  // null = самый свежий месяц (по умолчанию).
  // При клике на столбец графика — статистика пересчитывается для выбранного месяца.
  const activeMonth = selectedMonth ?? chartData[chartData.length - 1]?.month ?? null;

  // Сделки активного месяца с учётом фильтра бирж
  const activeMonthTrades = activeMonth
    ? filteredTrades.filter((t) => t.closed_at.slice(0, 7) === activeMonth)
    : [];

  const activeMonthNetPnls = activeMonthTrades.map((t) => t.realized_pnl - t.fee + t.funding);
  const winCount = activeMonthNetPnls.filter((p) => p > 0).length;
  const lossCount = activeMonthNetPnls.filter((p) => p <= 0).length;
  const grossProfit = activeMonthNetPnls.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const grossLoss = activeMonthNetPnls.filter((p) => p <= 0).reduce((a, b) => a + b, 0);
  const activeMonthNetPnl = activeMonthNetPnls.reduce((a, b) => a + b, 0);
  const activeMonthFee = activeMonthTrades.reduce((acc, t) => acc + t.fee, 0);
  const activeMonthFunding = activeMonthTrades.reduce((acc, t) => acc + t.funding, 0);
  const activeMonthWinRate =
    activeMonthTrades.length > 0
      ? ((winCount / activeMonthTrades.length) * 100).toFixed(1)
      : "0";

  // Последние 5 сделок с учётом фильтра
  const recentTrades = filteredTrades.slice(0, 5);

  const isFilterActive = selectedExchanges.size < ALL_EXCHANGES_WITH_MANUAL.length;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header: итог + синк */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-1">
            Итог по сделкам
          </div>
          {loading ? (
            <div className="skeleton h-10 w-40" />
          ) : (
            <PnlValue value={totalNet} size="xl" />
          )}
          <div className="text-xs text-[var(--color-text-faint)] mt-1">
            {selectedExchanges.size === ALL_EXCHANGES_WITH_MANUAL.length
              ? "Все биржи"
              : `${selectedExchanges.size} из ${ALL_EXCHANGES_WITH_MANUAL.length} бирж`}
            {" · "}
            {filteredTrades.length} сделок
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button onClick={syncAll} disabled={syncing} className="btn btn-primary">
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

      {/* Фильтр бирж — влияет только на PnL */}
      <div className="card p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mr-2">
            Биржи в PnL:
          </span>
          {ALL_EXCHANGES_WITH_MANUAL.map((ex) => {
            const checked = selectedExchanges.has(ex);
            const label = ex === "manual" ? "Manual" : REGISTRY[ex as (typeof EXCHANGES)[number]]?.label ?? ex;
            return (
              <button
                key={ex}
                onClick={() => toggleExchange(ex)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
                  checked
                    ? "border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-text)]"
                    : "border-[var(--color-border)] text-[var(--color-text-faint)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <span
                  className={`w-3 h-3 rounded-sm border flex items-center justify-center text-[10px] ${
                    checked
                      ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  {checked ? "✓" : ""}
                </span>
                {label}
              </button>
            );
          })}
          {isFilterActive && (
            <button
              onClick={selectAllExchanges}
              className="text-xs text-[var(--color-accent)] hover:underline ml-2"
            >
              Сбросить фильтр
            </button>
          )}
        </div>
      </div>

      {syncMsg && (
        <div className="text-sm text-[var(--color-text-muted)] font-mono-tabular">{syncMsg}</div>
      )}

      {/* Статистика выбранного месяца */}
      {activeMonth && (
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
              Статистика {activeMonth}
              {selectedMonth && (
                <span className="ml-2 text-[var(--color-accent)]">(выбран)</span>
              )}
              {!selectedMonth && (
                <span className="ml-2 text-[var(--color-text-faint)]">(текущий)</span>
              )}
              {isFilterActive && <span className="ml-2 text-[var(--color-accent)]">(отфильтровано)</span>}
            </div>
            {selectedMonth && (
              <button
                onClick={resetMonth}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Сбросить месяц
              </button>
            )}
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
                <StatCard label="Сделок" value={String(activeMonthTrades.length)} />
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
                <StatCard label="Win-rate" value={`${activeMonthWinRate}%`} />
                <StatCard label="Итог месяца" value={<PnlValue value={activeMonthNetPnl} />} />
                <StatCard label="Общая прибыль" value={<PnlValue value={grossProfit} />} />
                <StatCard label="Общий убыток" value={<PnlValue value={grossLoss} />} />
                <StatCard label="Комиссии" value={fmt(activeMonthFee)} />
                <StatCard
                  label="Фандинг"
                  value={
                    <span className={activeMonthFunding >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}>
                      {activeMonthFunding >= 0 ? "+" : ""}
                      {fmt(activeMonthFunding)}
                    </span>
                  }
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Табы графиков */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <div className="flex gap-1">
            <button
              onClick={() => changeGraphTab("balance")}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                graphTab === "balance"
                  ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              Спот vs Фьючерс
            </button>
            <button
              onClick={() => changeGraphTab("pnl")}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                graphTab === "pnl"
                  ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              PnL по месяцам
              {isFilterActive && (
                <span className="ml-1 text-xs text-[var(--color-accent)]">●</span>
              )}
            </button>
          </div>
        </div>

        {/* Содержимое активного графика */}
        <div className="p-5">
          {graphTab === "balance" ? (
            <BalanceChart />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-text-faint)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-text-faint)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "var(--color-surface-hover)" }}
                    contentStyle={{
                      background: "#1a1f2e",
                      border: "1px solid #2a3142",
                      borderRadius: 8,
                      fontFamily: "var(--font-mono)",
                      color: "#ffffff",
                    }}
                    labelStyle={{ color: "#8b95a5" }}
                    itemStyle={{ color: "#ffffff" }}
                  />
                  <Bar
                    dataKey="netPnl"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data: { payload?: { month?: string } }) => {
                      if (data?.payload?.month) selectMonth(data.payload.month);
                    }}
                  >
                    {chartData.map((d, i) => {
                      const isSelected = d.month === activeMonth;
                      const baseColor = d.netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)";
                      // Выбранный столбец — полная непрозрачность + синяя рамка.
                      // Остальные — приглушенные (0.4), чтобы выбранный выделялся.
                      return (
                        <Cell
                          key={i}
                          fill={baseColor}
                          fillOpacity={isSelected ? 1 : 0.4}
                          stroke={isSelected ? "var(--color-accent)" : "none"}
                          strokeWidth={isSelected ? 2 : 0}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="text-xs text-[var(--color-text-faint)] mt-3 flex items-center justify-between flex-wrap gap-2">
                <span>
                  {filteredTrades.length} сделок · {chartData.length} месяцев
                  {isFilterActive && " · фильтр активен"}
                </span>
                <span className="text-[var(--color-text-faint)]">
                  💡 Кликните по столбцу для статистики месяца
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Последние сделки */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
            Последние сделки
            {isFilterActive && <span className="ml-2 text-[var(--color-accent)]">(отфильтровано)</span>}
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
        ) : recentTrades.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-faint)]">
            {filteredTrades.length === 0
              ? "Нет сделок по выбранным биржам. Измените фильтр или синкните биржи."
              : "Сделок пока нет — нажмите «Синк всё», чтобы подтянуть историю."}
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
