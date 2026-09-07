"use client";

import StatCard from "@/components/ui/StatCard";
import PnlValue from "@/components/ui/PnlValue";
import SkeletonCard from "@/components/ui/SkeletonCard";
import { fmt, fmtPnl } from "@/lib/trade-model";

interface MonthStatsProps {
  month: string;
  tradesCount: number;
  winCount: number;
  lossCount: number;
  winRate: string;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  fee: number;
  funding: number;
  // Опциональные — только для дашборда (админка не передаёт)
  totalWinRate?: string;
  isFilterActive?: boolean;
  isSelected: boolean;
  onResetMonth?: () => void;
  // variant: default — дашборд (9 карточек 3×3), compact — админка (8 карточек 4×2)
  variant?: "default" | "compact";
}

/**
 * Блок статистики выбранного месяца.
 * Переиспользуется на дашборде (variant="default") и в админке (variant="compact").
 *
 * variant="default" (дашборд):
 *   - 9 карточек в сетке 3×3
 *   - Есть «Win-rate за всё время»
 *   - Бейдж «(отфильтровано)» при активном фильтре бирж
 *   - StatCard p-4, text-2xl
 *
 * variant="compact" (админка):
 *   - 8 карточек в сетке 2×4 (без «Win-rate за всё время»)
 *   - Без бейджа «(отфильтровано)» (в админке нет фильтра бирж)
 *   - StatCard p-3, text-lg
 */
export default function MonthStats({
  month,
  tradesCount,
  winCount,
  lossCount,
  winRate,
  netPnl,
  grossProfit,
  grossLoss,
  fee,
  funding,
  totalWinRate,
  isFilterActive = false,
  isSelected,
  onResetMonth,
  variant = "default",
}: MonthStatsProps) {
  const isCompact = variant === "compact";
  const gridClass = isCompact
    ? "grid grid-cols-2 md:grid-cols-4 gap-2"
    : "grid grid-cols-2 md:grid-cols-3 gap-3";
  const skeletonCount = isCompact ? 8 : 9;
  const isLoading = tradesCount === 0 && netPnl === 0;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
          Статистика {month}
          {isSelected ? (
            <span className="ml-2 text-[var(--color-accent)]">(выбран)</span>
          ) : (
            <span className="ml-2 text-[var(--color-text-faint)]">(текущий)</span>
          )}
          {!isCompact && isFilterActive && (
            <span className="ml-2 text-[var(--color-accent)]">(отфильтровано)</span>
          )}
        </div>
        {isSelected && onResetMonth && (
          <button
            onClick={onResetMonth}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Сбросить месяц
          </button>
        )}
      </div>
      <div className={gridClass}>
        {isLoading ? (
          Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonCard key={i} variant={variant} />
          ))
        ) : isCompact ? (
          <>
            <StatCard label="Сделок" value={String(tradesCount)} variant="compact" />
            <StatCard
              label="Приб / Убыт"
              value={
                <span>
                  <span className="text-[var(--color-profit)]">{winCount}</span>
                  {" / "}
                  <span className="text-[var(--color-loss)]">{lossCount}</span>
                </span>
              }
              variant="compact"
            />
            <StatCard label="Win-rate" value={`${winRate}%`} variant="compact" />
            <StatCard
              label="Итог месяца"
              value={
                <span className={netPnl >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}>
                  {fmtPnl(netPnl)}
                </span>
              }
              variant="compact"
            />
            <StatCard
              label="Общая прибыль"
              value={<span className="text-[var(--color-profit)]">{fmtPnl(grossProfit)}</span>}
              variant="compact"
            />
            <StatCard
              label="Общий убыток"
              value={<span className="text-[var(--color-loss)]">{fmtPnl(grossLoss)}</span>}
              variant="compact"
            />
            <StatCard label="Комиссии" value={fmt(fee)} variant="compact" />
            <StatCard
              label="Фандинг"
              value={
                <span className={funding >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}>
                  {fmtPnl(funding)}
                </span>
              }
              variant="compact"
            />
          </>
        ) : (
          <>
            <StatCard label="Сделок" value={String(tradesCount)} />
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
            <StatCard label="Win-rate" value={`${winRate}%`} />
            <StatCard label="Итог месяца" value={<PnlValue value={netPnl} />} />
            <StatCard label="Общая прибыль" value={<PnlValue value={grossProfit} />} />
            <StatCard label="Общий убыток" value={<PnlValue value={grossLoss} />} />
            <StatCard label="Комиссии" value={fmt(fee)} />
            <StatCard
              label="Фандинг"
              value={
                <span className={funding >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}>
                  {funding >= 0 ? "+" : ""}
                  {fmt(funding)}
                </span>
              }
            />
            <StatCard
              label="Win-rate за всё время"
              value={`${totalWinRate ?? "0"}%`}
            />
          </>
        )}
      </div>
    </div>
  );
}
