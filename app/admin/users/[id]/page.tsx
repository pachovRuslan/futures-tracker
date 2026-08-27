"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
import { EXCHANGES, REGISTRY } from "@/lib/exchanges";

interface Profile {
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

interface Connection {
  exchange: string;
  key_preview: string;
  created_at: string;
}

interface Trade {
  id: string;
  exchange: string;
  symbol: string;
  side: "long" | "short";
  qty: number | null;
  entry_price: number | null;
  close_price: number | null;
  realized_pnl: number;
  fee: number;
  funding: number;
  opened_at: string | null;
  closed_at: string;
}

interface TradesStats {
  total_trades: number;
  total_net_pnl: number;
  profitable: number;
  losing: number;
  by_exchange: Record<string, { count: number; pnl: number }>;
  by_side: { long: number; short: number };
  first_trade_at: string | null;
  last_trade_at: string | null;
  total_fee: number;
  total_funding: number;
}

interface MonthlyItem {
  month: string;
  total_pnl: number;
  total_fee: number;
  total_funding: number;
  net_pnl: number;
  trade_count: number;
  win_rate: number;
}

function fmt(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function fmtUsd(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return sign + n.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtFee(fee: number, exchange: string): string {
  if (exchange === "bybit" && fee === 0) return "—";
  return fee.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
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

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<TradesStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      setProfile(data.profile);
      setConnections(data.connections ?? []);
      setRecentTrades(data.recentTrades ?? []);
      setStats(data.tradesStats);
      setMonthly(data.monthlySummary ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const chartData = [...monthly].reverse().map((m) => ({
    month: m.month,
    netPnl: Number(m.net_pnl),
  }));

  const winRate = stats && stats.total_trades > 0
    ? ((stats.profitable / stats.total_trades) * 100).toFixed(1)
    : "0";

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Шапка с кнопкой "назад" */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={() => router.push("/admin")}
          className="btn text-xs py-1.5"
        >
          ← Назад к списку
        </button>
        {profile && (
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">{profile.email}</h1>
            <div className="text-xs text-[var(--color-text-faint)] mt-0.5">
              Рега: {fmtDate(profile.created_at)}
              {profile.last_sign_in_at && ` · Последний вход: ${fmtDate(profile.last_sign_in_at)}`}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="card p-4 text-sm text-[var(--color-loss)] bg-[var(--color-loss-dim)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-sm text-[var(--color-text-faint)]">
          Загрузка...
        </div>
      ) : profile ? (
        <>
          {/* Карточки статистики */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Всего сделок"
              value={stats?.total_trades ?? 0}
            />
            <StatCard
              label="Приб / Убыт"
              value={
                <span>
                  <span className="text-[var(--color-profit)]">{stats?.profitable ?? 0}</span>
                  {" / "}
                  <span className="text-[var(--color-loss)]">{stats?.losing ?? 0}</span>
                </span>
              }
            />
            <StatCard label="Win-rate" value={`${winRate}%`} />
            <StatCard
              label="Итог PnL"
              value={
                <span className={(stats?.total_net_pnl ?? 0) >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}>
                  {fmtUsd(stats?.total_net_pnl ?? 0)}
                </span>
              }
            />
            <StatCard label="Комиссии" value={fmt(stats?.total_fee ?? 0)} />
            <StatCard
              label="Фандинг"
              value={
                <span className={(stats?.total_funding ?? 0) >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}>
                  {fmtUsd(stats?.total_funding ?? 0)}
                </span>
              }
            />
            <StatCard
              label="Long / Short"
              value={
                <span>
                  <span className="text-[var(--color-profit)]">{stats?.by_side?.long ?? 0}</span>
                  {" / "}
                  <span className="text-[var(--color-loss)]">{stats?.by_side?.short ?? 0}</span>
                </span>
              }
            />
            <StatCard
              label="Период"
              value={
                <span className="text-sm">
                  {stats?.first_trade_at
                    ? `${new Date(stats.first_trade_at).toLocaleDateString("ru-RU")} — ${
                        stats?.last_trade_at
                          ? new Date(stats.last_trade_at).toLocaleDateString("ru-RU")
                          : "—"
                      }`
                    : "нет сделок"}
                </span>
              }
            />
          </div>

          {/* Подключения бирж */}
          <div className="card">
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <span className="text-sm font-medium">
                Подключения ({connections.length})
              </span>
            </div>
            {connections.length === 0 ? (
              <div className="p-5 text-sm text-[var(--color-text-faint)]">
                Биржи не подключены
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {connections.map((c) => (
                  <div
                    key={c.exchange}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm">
                        {c.exchange === "manual"
                          ? "manual"
                          : REGISTRY[c.exchange as (typeof EXCHANGES)[number]]?.label ?? c.exchange}
                      </span>
                      <span className="text-xs font-mono-tabular text-[var(--color-profit)]">
                        {c.key_preview}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-text-faint)]">
                      {fmtDate(c.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PnL по биржам */}
          {stats?.by_exchange && Object.keys(stats.by_exchange).length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-[var(--color-border)]">
                <span className="text-sm font-medium">PnL по биржам</span>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {Object.entries(stats.by_exchange).map(([ex, data]) => (
                  <div
                    key={ex}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm">
                        {ex === "manual"
                          ? "manual"
                          : REGISTRY[ex as (typeof EXCHANGES)[number]]?.label ?? ex}
                      </span>
                      <span className="text-xs text-[var(--color-text-faint)]">
                        {data.count} сделок
                      </span>
                    </div>
                    <span
                      className={`font-mono-tabular text-sm ${
                        data.pnl >= 0
                          ? "text-[var(--color-profit)]"
                          : "text-[var(--color-loss)]"
                      }`}
                    >
                      {fmtUsd(Number(data.pnl))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* График PnL по месяцам */}
          {chartData.length > 0 && (
            <div className="card p-5">
              <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-4">
                PnL по месяцам
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
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
                  <Bar dataKey="netPnl" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Последние сделки */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <span className="text-sm font-medium">
                Последние сделки ({recentTrades.length})
              </span>
            </div>
            {recentTrades.length === 0 ? (
              <div className="p-5 text-sm text-[var(--color-text-faint)]">
                Сделок нет
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-surface)] text-[var(--color-text-faint)] text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-normal">Закрыта</th>
                      <th className="text-left px-4 py-3 font-normal">Биржа</th>
                      <th className="text-left px-4 py-3 font-normal">Символ</th>
                      <th className="text-left px-4 py-3 font-normal">Сторона</th>
                      <th className="text-right px-4 py-3 font-normal">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((t) => {
                      const net = t.realized_pnl - t.fee + t.funding;
                      const positive = net >= 0;
                      return (
                        <tr
                          key={t.id}
                          className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                        >
                          <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)] whitespace-nowrap font-mono-tabular">
                            {fmtDate(t.closed_at)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
                            {t.exchange === "manual"
                              ? "manual"
                              : REGISTRY[t.exchange as (typeof EXCHANGES)[number]]?.label ?? t.exchange}
                          </td>
                          <td className="px-4 py-2.5 font-mono-tabular text-xs">{t.symbol}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={
                                t.side === "long"
                                  ? "text-[var(--color-profit)] text-xs"
                                  : "text-[var(--color-loss)] text-xs"
                              }
                            >
                              {t.side === "long" ? "Long" : "Short"}
                            </span>
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono-tabular text-xs ${
                              positive ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
                            }`}
                          >
                            {fmtUsd(net)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Управление пользователем */}
          <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-[var(--color-text-faint)]">
              User ID: <code className="font-mono-tabular">{userId}</code>
            </div>
            <Link
              href="/admin"
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              ← Все пользователи
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
