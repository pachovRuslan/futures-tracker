import { TooltipProps } from "recharts";

/**
 * Тёмный tooltip для recharts — белый текст на тёмно-синем фоне.
 * Один стиль для всех графиков (PnLChart, BalanceChart, UserPnLChart).
 * Не зависит от темы — всегда тёмный, как у TradingView/Binance.
 */
export default function ChartTooltip(props: TooltipProps<number, string>) {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        background: "#1a1f2e",
        border: "1px solid #2a3142",
        borderRadius: 8,
        padding: "8px 12px",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "#ffffff",
      }}
    >
      {label && (
        <div style={{ color: "#8b95a5", marginBottom: 4 }}>{label}</div>
      )}
      {payload.map((entry, i) => (
        <div key={i} style={{ color: "#ffffff" }}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  );
}
