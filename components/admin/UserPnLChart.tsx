"use client";

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

interface UserPnLChartProps {
  data: { month: string; netPnl: number }[];
  activeMonth: string | null;
  onSelectMonth: (month: string) => void;
}

/**
 * График PnL по месяцам для детальной страницы пользователя в админке.
 * Аналог дашбордного PnLChart, но с другим localStorage ключом,
 * чтобы выбор месяца у админа не пересекался с выбором на дашборде.
 *
 * Клик по столбцу → выбирает месяц, статистика сверху пересчитывается.
 * Выбранный столбец — полная непрозрачность + синяя рамка.
 */
export default function UserPnLChart({
  data,
  activeMonth,
  onSelectMonth,
}: UserPnLChartProps) {
  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="var(--color-text-faint)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--color-text-faint)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
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
            onClick={(d: { payload?: { month?: string } }) => {
              if (d?.payload?.month) onSelectMonth(d.payload.month);
            }}
          >
            {data.map((d, i) => {
              const isSelected = d.month === activeMonth;
              const baseColor =
                d.netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)";
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
        <span>{data.length} месяцев</span>
        <span>💡 Кликните по столбцу для статистики месяца</span>
      </div>
    </>
  );
}
