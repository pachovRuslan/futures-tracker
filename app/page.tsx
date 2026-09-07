"use client";

import { useEffect, useState, useCallback } from "react";
import type { Trade } from "@/lib/types";
import BalanceChart from "@/components/BalanceChart";
import ExchangeFilter from "@/components/dashboard/ExchangeFilter";
import SyncButton from "@/components/dashboard/SyncButton";
import MonthStats from "@/components/dashboard/MonthStats";
import GraphTabs from "@/components/dashboard/GraphTabs";
import RecentTrades from "@/components/dashboard/RecentTrades";
import PnlValue from "@/components/ui/PnlValue";
import { useExchangeFilter } from "@/components/dashboard/useExchangeFilter";
import { useSelectedMonth } from "@/components/dashboard/useSelectedMonth";
import {
  filterTradesByExchanges,
  calculateTotalNetPnl,
  groupTradesByMonth,
  calculateMonthStats,
  calculateAllTimeWinRate,
  getActiveMonth,
} from "@/lib/trade-model";

const GRAPH_TAB_STORAGE_KEY = "futures-tracker-graph-tab";
const ALL_EXCHANGES_COUNT = 7; // 6 бирж + manual

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

  const { selectedExchanges, toggleExchange, selectAllExchanges, isFilterActive } =
    useExchangeFilter();

  const { selectedMonth, selectMonth, resetMonth } = useSelectedMonth();

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

  // === БИЗНЕС-ЛОГИКА (вся в lib/trade-model.ts) ===
  const filteredTrades = filterTradesByExchanges(trades, selectedExchanges);
  const totalNet = calculateTotalNetPnl(filteredTrades);
  const chartData = groupTradesByMonth(filteredTrades);
  const activeMonth = getActiveMonth(selectedMonth, chartData);
  const monthStats = activeMonth ? calculateMonthStats(filteredTrades, activeMonth) : null;
  const totalWinRate = calculateAllTimeWinRate(filteredTrades);

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
            {selectedExchanges.size === ALL_EXCHANGES_COUNT
              ? "Все биржи"
              : `${selectedExchanges.size} из ${ALL_EXCHANGES_COUNT} бирж`}
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
      {activeMonth && monthStats && (
        <MonthStats
          month={activeMonth}
          tradesCount={loading ? 0 : monthStats.tradesCount}
          winCount={monthStats.winCount}
          lossCount={monthStats.lossCount}
          winRate={monthStats.winRate}
          netPnl={monthStats.netPnl}
          grossProfit={monthStats.grossProfit}
          grossLoss={monthStats.grossLoss}
          fee={monthStats.fee}
          funding={monthStats.funding}
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
