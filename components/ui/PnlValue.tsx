/**
 * Цветной PnL — зелёный для прибыли, красный для убытка.
 * Переиспользуется на дашборде, в админке, в карточках и заголовках.
 *
 * Размеры:
 *   sm  — text-lg (в карточках админки)
 *   md  — text-xl (в карточках дашборда)
 *   lg  — text-2xl (крупные значения)
 *   xl  — text-4xl (итог на дашборде)
 */
function fmt(n: number): string {
  return n.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

const sizeClass = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-4xl",
};

export default function PnlValue({
  value,
  size = "md",
  semibold = true,
}: {
  value: number;
  size?: "sm" | "md" | "lg" | "xl";
  semibold?: boolean;
}) {
  const positive = value >= 0;
  return (
    <span
      className={`font-mono-tabular ${sizeClass[size]} ${
        semibold ? "font-semibold" : ""
      } ${positive ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}`}
    >
      {positive ? "+" : ""}
      {fmt(value)}
    </span>
  );
}
