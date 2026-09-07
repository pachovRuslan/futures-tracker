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
import ChartTooltip from "@/components/ui/ChartTooltip";

interface PnLChartProps {
  data: { month: string; netPnl: number }[];
  activeMonth: string | null;
  onSelectMonth: (month: string) => void;
  height?: number;
  // Опциональные — только для дашборда (админка не передаёт)
  filteredTradesCount?: number;
  isFilterActive?: boolean;
}

/**
 * График PnL по месяцам с кликабельными столбцами.
 * Переиспользуется на дашборде (height=300) и в админке (height=260).
 *
 * Клик по столбцу → выбирает месяц, статистика пересчитывается.
 * Выбранный столбец — полная непрозрачность + синяя рамка.
 * Остальные — приглушенные (0.4).
 *
 * Footer: показывает «N сделок · M месяцев» если передан filteredTradesCount,
 * иначе только «M месяцев».
 */
export default function PnLChart({
  data,
  activeMonth,
  onSelectMonth,
  height = 300,
  filteredTradesCount,
  isFilterActive = false,
}: PnLChartProps) {
  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
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
            content={<ChartTooltip />}
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
        <span>
          {filteredTradesCount !== undefined
            ? `${filteredTradesCount} сделок · ${data.length} месяцев${
                isFilterActive ? " · фильтр активен" : ""
              }`
            : `${data.length} месяцев`}
        </span>
        <span className="text-[var(--color-text-faint)]">
          💡 Кликните по столбцу для статистики месяца
        </span>
      </div>
    </>
  );
}
