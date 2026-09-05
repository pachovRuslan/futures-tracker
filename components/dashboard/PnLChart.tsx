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

interface PnLChartProps {
  data: { month: string; netPnl: number; trades: number }[];
  activeMonth: string | null;
  onSelectMonth: (month: string) => void;
  filteredTradesCount: number;
  isFilterActive: boolean;
}

/**
 * График PnL по месяцам с кликабельными столбцами.
 * Клик по столбцу → выбирает месяц, статистика сверху пересчитывается.
 * Выбранный столбец — полная непрозрачность + синяя рамка.
 * Остальные — приглушенные (0.4).
 *
 * Tooltip — тёмный с белым текстом, не зависит от темы (хардкод).
 */
export default function PnLChart({
  data,
  activeMonth,
  onSelectMonth,
  filteredTradesCount,
  isFilterActive,
}: PnLChartProps) {
  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
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
            onClick={(data: { payload?: { month?: string } }) => {
              if (data?.payload?.month) onSelectMonth(data.payload.month);
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
        <span>
          {filteredTradesCount} сделок · {data.length} месяцев
          {isFilterActive && " · фильтр активен"}
        </span>
        <span className="text-[var(--color-text-faint)]">
          💡 Кликните по столбцу для статистики месяца
        </span>
      </div>
    </>
  );
}
