"use client";

import { useEffect, useState, useCallback } from "react";
import type { MonthlySummary, Trade } from "@/lib/types";
import { EXCHANGES, REGISTRY } from "@/lib/exchanges";
import BalanceChart from "@/components/BalanceChart";
import ExchangeFilter from "@/components/dashboard/ExchangeFilter";
import SyncButton from "@/components/dashboard/SyncButton";
import MonthStats from "@/components/dashboard/MonthStats";
import GraphTabs from "@/components/dashboard/GraphTabs";
import RecentTrades from "@/components/dashboard/RecentTrades";
import { useExchangeFilter } from "@/components/dashboard/useExchangeFilter";
import { useSelectedMonth } from "@/components/dashboard/useSelectedMonth";

const GRAPH_TAB_STORAGE_KEY = "futures-tracker-graph-tab";

function fmt(n: number): string {
  return n.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function PnlValue({ value, size = "md" }: { value: number; size?: "md" | "lg" | "xl" }) {
  const positive = value >= 0;
  const sizeClass = size === "xl" ? "text-4xl" : size === "lg" ? "text-2xl" : "text-xl";
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

function loadGraphTab(): "balance" | "pnl" {
  if (typeof window === "undefined") return "balance";
  try {
    const saved = localStorage.getItem(GRAPH_TAB_STORAGE_KEY);
    if (saved === "pnl" || saved === "balance") return saved;
  } catch {}
  return "balance";
}

export default function DashboardPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  // Хук фильтра бирж (вынесен в компонент)
  const { selectedExchanges, toggleExchange, selectAllExchanges, isFilterActive } =
    useExchangeFilter();

  // Хук выбранного месяца (вынесен в компонент)
  const { selectedMonth, selectMonth, resetMonth } = useSelectedMonth();

  // Активный график
  const [graphTab, setGraphTab] = useState<"balance" | "pnl">("balance");

  useEffect(() => {
    setGraphTab(loadGraphTab());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/trades?limit=500");
    const data = await res.json();
    setTrades(data.trades ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function changeGraphTab(tab: "balance" | "pnl") {
    setGraphTab(tab);
    try {
      localStorage.setItem(GRAPH_TAB_STORAGE_KEY, tab);
    } catch {}
  }

  // === ФИЛЬТРАЦИЯ СДЕЛОК ПО ВЫБРАННЫМ БИРЖАМ ===
  const filteredTrades = trades.filter((t) =>
    selectedExchanges.has(t.exchange as (typeof EXCHANGES)[number] | "manual")
  );

  // Итог PnL по выбранным биржам
  const totalNet = filteredTrades.reduce(
    (acc, t) => acc + (t.realized_pnl - t.fee + t.funding),
    0
  );

  // === ГРАФИК PnL ПО МЕСЯЦАМ ===
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
  const activeMonth =
    selectedMonth ?? chartData[chartData.length - 1]?.month ?? null;

  const activeMonthTrades = activeMonth
    ? filteredTrades.filter((t) => t.closed_at.slice(0, 7) === activeMonth)
    : [];

  const activeMonthNetPnls = activeMonthTrades.map(
    (t) => t.realized_pnl - t.fee + t.funding
  );
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

  // Win-rate за всё время — по всем отфильтрованным сделкам (а не только за месяц).
  // Считаем сделки с net PnL > 0 как прибыльные, <= 0 как убыточные.
  const allTimeNetPnls = filteredTrades.map((t) => t.realized_pnl - t.fee + t.funding);
  const allTimeWinCount = allTimeNetPnls.filter((p) => p > 0).length;
  const totalWinRate =
    allTimeNetPnls.length > 0
      ? ((allTimeWinCount / allTimeNetPnls.length) * 100).toFixed(1)
      : "0";

  // Последние 5 сделок с учётом фильтра
  const recentTrades = filteredTrades.slice(0, 5);

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
            {selectedExchanges.size === 7
              ? "Все биржи"
              : `${selectedExchanges.size} из 7 бирж`}
            {" · "}
            {filteredTrades.length} сделок
          </div>
        </div>
        <SyncButton onSyncComplete={load} />
      </div>

      {/* Фильтр бирж */}
      <ExchangeFilter
        selectedExchanges={selectedExchanges}
        onToggle={toggleExchange}
        onReset={selectAllExchanges}
        isFilterActive={isFilterActive}
      />

      {/* Статистика выбранного месяца */}
      {activeMonth && (
        <MonthStats
          month={activeMonth}
          tradesCount={loading ? 0 : activeMonthTrades.length}
          winCount={winCount}
          lossCount={lossCount}
          winRate={activeMonthWinRate}
          netPnl={activeMonthNetPnl}
          grossProfit={grossProfit}
          grossLoss={grossLoss}
          fee={activeMonthFee}
          funding={activeMonthFunding}
          totalWinRate={totalWinRate}
          isSelected={!!selectedMonth}
          isFilterActive={isFilterActive}
          onResetMonth={resetMonth}
        />
      )}

      {/* Табы графиков */}
      <GraphTabs
        activeTab={graphTab}
        onTabChange={changeGraphTab}
        isFilterActive={isFilterActive}
        pnlData={chartData}
        activeMonth={activeMonth}
        onSelectMonth={selectMonth}
        filteredTradesCount={filteredTrades.length}
      />

      {/* Последние сделки */}
      <RecentTrades trades={recentTrades} isFilterActive={isFilterActive} loading={loading} />
    </div>
  );
}
