/**
 * Карточка статистики — label (сверху, мелкий) + value (крупный).
 * Переиспользуется в MonthStats, UserMonthStats, общая статистика админки.
 *
 * Размеры:
 *   default — p-4, text-2xl (дашборд)
 *   compact — p-3, text-lg (админка)
 */
export default function StatCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: React.ReactNode;
  variant?: "default" | "compact";
}) {
  const padding = variant === "compact" ? "p-3" : "p-4";
  const textSize = variant === "compact" ? "text-lg" : "text-2xl";
  return (
    <div className={`card ${padding}`}>
      <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-2">
        {label}
      </div>
      <div className={`font-mono-tabular ${textSize}`}>{value}</div>
    </div>
  );
}
