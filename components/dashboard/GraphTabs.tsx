"use client";

import BalanceChart from "@/components/BalanceChart";
import PnLChart from "./PnLChart";

interface GraphTabsProps {
  activeTab: "balance" | "pnl";
  onTabChange: (tab: "balance" | "pnl") => void;
  isFilterActive: boolean;
  // Props для PnLChart
  pnlData: { month: string; netPnl: number; trades: number }[];
  activeMonth: string | null;
  onSelectMonth: (month: string) => void;
  filteredTradesCount: number;
}

/**
 * Табы графиков на дашборде — «Спот vs Фьючерс» / «PnL по месяцам».
 * Активный график показывается на всю ширину внутри одной карточки.
 *
 * Точка ● рядом с табом «PnL по месяцам» — индикатор активного фильтра бирж.
 */
export default function GraphTabs({
  activeTab,
  onTabChange,
  isFilterActive,
  pnlData,
  activeMonth,
  onSelectMonth,
  filteredTradesCount,
}: GraphTabsProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div className="flex gap-1">
          <button
            onClick={() => onTabChange("balance")}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "balance"
                ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            Спот vs Фьючерс
          </button>
          <button
            onClick={() => onTabChange("pnl")}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "pnl"
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
      <div className="p-5">
        {activeTab === "balance" ? (
          <BalanceChart />
        ) : (
          <PnLChart
            data={pnlData}
            activeMonth={activeMonth}
            onSelectMonth={onSelectMonth}
            filteredTradesCount={filteredTradesCount}
            isFilterActive={isFilterActive}
          />
        )}
      </div>
    </div>
  );
}
