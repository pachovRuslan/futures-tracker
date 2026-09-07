/**
 * Skeleton-карточка — заглушка при загрузке данных.
 * Показывает анимированный shimmer вместо реальных значений.
 */
export default function SkeletonCard({
  variant = "default",
}: {
  variant?: "default" | "compact";
}) {
  const padding = variant === "compact" ? "p-3" : "p-4";
  return (
    <div className={`card ${padding}`}>
      <div className="skeleton h-3 w-20 mb-2" />
      <div className="skeleton h-7 w-24" />
    </div>
  );
}
