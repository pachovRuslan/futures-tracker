"use client";

interface UserMonthStatsProps {
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
  isSelected: boolean;
  onResetMonth?: () => void;
}

function fmt(n: number): string {
  return n.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function fmtPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return sign + n.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-1">
        {label}
      </div>
      <div className="font-mono-tabular text-lg">{value}</div>
    </div>
  );
}

/**
 * Блок статистики выбранного месяца для детальной страницы пользователя в админке.
 * Компактнее дашбордного (8 карточек вместо 8, но меньше padding/text).
 */
export default function UserMonthStats({
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
  isSelected,
  onResetMonth,
}: UserMonthStatsProps) {
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
        <StatCard
          label="Итог месяца"
          value={
            <span
              className={
                netPnl >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
              }
            >
              {fmtPnl(netPnl)}
            </span>
          }
        />
        <StatCard
          label="Общая прибыль"
          value={
            <span className="text-[var(--color-profit)]">{fmtPnl(grossProfit)}</span>
          }
        />
        <StatCard
          label="Общий убыток"
          value={<span className="text-[var(--color-loss)]">{fmtPnl(grossLoss)}</span>}
        />
        <StatCard label="Комиссии" value={fmt(fee)} />
        <StatCard
          label="Фандинг"
          value={
            <span
              className={
                funding >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
              }
            >
              {fmtPnl(funding)}
            </span>
          }
        />
      </div>
    </div>
  );
}
