"use client";

import { useEffect, useState, useCallback } from "react";
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
import type { MonthlySummary, Trade } from "@/lib/types";

function fmt(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function PnlValue({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`font-mono-tabular ${
        positive ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
      }`}
    >
      {positive ? "+" : ""}
      {fmt(value)}
    </span>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<MonthlySummary[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/trades?limit=500");
    const data = await res.json();
    setSummary(
      (data.summary ?? []).map((s: any) => ({
        month: s.month,
        totalPnl: Number(s.total_pnl),
        totalFee: Number(s.total_fee),
        totalFunding: Number(s.total_funding),
        netPnl: Number(s.net_pnl),
        tradeCount: Number(s.trade_count),
        winRate: Number(s.win_rate ?? 0),
      }))
    );
    setTrades(data.trades ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runSync(exchange: "bybit" | "bitunix") {
    setSyncing(exchange);
    setSyncMsg(null);
    try {
      const res = await fetch(`/api/sync/${exchange}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Неизвестная ошибка");
      setSyncMsg(`${exchange}: обновлено ${data.upserted} записей`);
      await load();
    } catch (e) {
      setSyncMsg(`${exchange}: ошибка — ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(null);
    }
  }

  const totalNet = trades.reduce((acc, t) => acc + (t.realized_pnl - t.fee + t.funding), 0);
  const currentMonth = summary[0];

  const chartData = [...summary]
    .reverse()
    .map((s) => ({ month: s.month, netPnl: s.netPnl }));

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-1">
            Итог по всем сделкам
          </div>
          <div className="text-4xl font-mono-tabular font-semibold">
            <PnlValue value={totalNet} />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => runSync("bybit")}
            disabled={syncing !== null}
            className="px-4 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-sm disabled:opacity-50"
          >
            {syncing === "bybit" ? "Синк..." : "Синк Bybit"}
          </button>
          <button
            onClick={() => runSync("bitunix")}
            disabled={syncing !== null}
            className="px-4 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-sm disabled:opacity-50"
          >
            {syncing === "bitunix" ? "Синк..." : "Синк Bitunix"}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="text-sm text-[var(--color-text-muted)] font-mono-tabular">{syncMsg}</div>
      )}

      {currentMonth && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Текущий месяц" value={<PnlValue value={currentMonth.netPnl} />} />
          <StatCard label="Сделок" value={String(currentMonth.tradeCount)} />
          <StatCard label="Win-rate" value={`${currentMonth.winRate}%`} />
          <StatCard label="Комиссии" value={fmt(currentMonth.totalFee)} />
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-4">
          PnL по месяцам
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--color-text-faint)" fontSize={12} />
            <YAxis stroke="var(--color-text-faint)" fontSize={12} />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontFamily: "var(--font-mono)",
              }}
            />
            <Bar dataKey="netPnl" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {loading && (
        <div className="text-sm text-[var(--color-text-faint)]">Загрузка...</div>
      )}
      {!loading && trades.length === 0 && (
        <div className="text-sm text-[var(--color-text-faint)]">
          Сделок пока нет — нажми "Синк Bybit" или "Синк Bitunix", чтобы подтянуть историю.
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-1">
        {label}
      </div>
      <div className="text-xl font-mono-tabular">{value}</div>
    </div>
  );
}
