"use client";

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
  totalWinRate: string; // win-rate за всё время (по всем сделкам)
  isSelected: boolean; // месяц выбран кликом, не текущий
  isFilterActive: boolean; // активен фильтр бирж
  onResetMonth?: () => void;
}

function fmt(n: number): string {
  return n.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function PnlValue({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`font-mono-tabular text-2xl font-semibold ${
        positive ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
      }`}
    >
      {positive ? "+" : ""}
      {fmt(value)}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-2">
        {label}
      </div>
      <div className="font-mono-tabular text-2xl">{value}</div>
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
 * Блок статистики выбранного месяца — 9 карточек в сетке 3×3.
 * Заголовок показывает: Статистика {month} (выбран|текущий) (отфильтровано).
 * Кнопка «Сбросить месяц» — только если месяц выбран кликом.
 *
 * 9 карточек:
 * 1. Сделок (за месяц)
 * 2. Приб / Убыт (за месяц)
 * 3. Win-rate (за месяц)
 * 4. Итог месяца
 * 5. Общая прибыль
 * 6. Общий убыток
 * 7. Комиссии
 * 8. Фандинг
 * 9. Win-rate за всё время
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
  isSelected,
  isFilterActive,
  onResetMonth,
}: MonthStatsProps) {
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
          {isFilterActive && (
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {tradesCount === 0 && netPnl === 0 ? (
          // Скелетоны при загрузке (loading=true передаётся через 0/0)
          <>
            <SkeletonCard />
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
                <span
                  className={
                    funding >= 0
                      ? "text-[var(--color-profit)]"
                      : "text-[var(--color-loss)]"
                  }
                >
                  {funding >= 0 ? "+" : ""}
                  {fmt(funding)}
                </span>
              }
            />
            <StatCard
              label="Win-rate за всё время"
              value={`${totalWinRate}%`}
            />
          </>
        )}
      </div>
    </div>
  );
}
