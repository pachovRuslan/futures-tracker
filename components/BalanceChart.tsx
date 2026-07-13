"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import Link from "next/link";
import type { BalanceChartPoint, UserSettings } from "@/lib/types";

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return "$" + n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

interface ChartData {
  points: BalanceChartPoint[];
  settings: UserSettings;
  startDate: string | null;
  endDate: string;
}

export default function BalanceChart() {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [startInput, setStartInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/balance/chart");
    const json = await res.json();
    setData(json);
    setGoalInput(json.settings.goal_usd?.toString() ?? "");
    setStartInput(json.settings.futures_start_usd?.toString() ?? "0");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettings() {
    setSavingSettings(true);
    try {
      await fetch("/api/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal_usd: goalInput === "" ? null : Number(goalInput),
          futures_start_usd: Number(startInput) || 0,
        }),
      });
      setEditingGoal(false);
      await load();
    } finally {
      setSavingSettings(false);
    }
  }

  // Преобразуем данные для графика:
  // - futures показываем со ЗНАКОМ МИНУС, чтобы он был зеркально внизу.
  //   Но в tooltip вернём обратно положительное значение.
  // - spot остаётся положительным, рисуется сверху.
  // - spread = |spot - futures| — рисуется пунктиром.
  const chartData = (data?.points ?? []).map((p) => ({
    date: p.date,
    spot: p.spot,
    // Зеркальный futures для отрисовки (визуально вниз)
    futuresMirror: p.futures !== null ? -p.futures : null,
    // Реальные значения для тултипа
    futuresReal: p.futures,
    spread: p.spread,
  }));

  // Текущие значения (последняя точка с данными)
  const lastSpot = [...(data?.points ?? [])].reverse().find((p) => p.spot !== null);
  const lastFutures = data?.points?.[data.points.length - 1];
  const goal = data?.settings.goal_usd ?? null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
            Спот vs Фьючерс
          </div>
          <div className="text-xs text-[var(--color-text-faint)] mt-0.5">
            {data?.startDate
              ? `С ${new Date(data.startDate).toLocaleDateString("ru-RU")} по сегодня`
              : "Нет данных — синкните сделки"}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Легенда */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-[var(--color-profit)]" />
              <span className="text-[var(--color-text-muted)]">Спот</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-[var(--color-accent)]" />
              <span className="text-[var(--color-text-muted)]">Фьючерс</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 border-t border-dashed border-[#f59e0b]" />
              <span className="text-[var(--color-text-muted)]">Спред</span>
            </div>
          </div>

          <button
            onClick={() => setEditingGoal((v) => !v)}
            className="btn text-xs py-1.5 px-3"
          >
            {editingGoal ? "Закрыть" : "Цель ⚙"}
          </button>
        </div>
      </div>

      {/* Форма настройки цели */}
      {editingGoal && (
        <div className="mb-4 p-4 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
              Цель, $
            </label>
            <input
              type="number"
              step="100"
              min="0"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder="10000"
              className="input font-mono-tabular"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
              Стартовый фьючерс, $
            </label>
            <input
              type="number"
              step="10"
              min="0"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              placeholder="0"
              className="input font-mono-tabular"
            />
          </div>
          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="btn btn-primary text-xs py-1.5"
          >
            {savingSettings ? "..." : "Сохранить"}
          </button>
        </div>
      )}

      {/* Текущие значения */}
      {!loading && (lastSpot || lastFutures) && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <div className="text-xs text-[var(--color-text-faint)] mb-0.5">Спот сейчас</div>
            <div className="font-mono-tabular text-lg text-[var(--color-profit)]">
              {fmtUsd(lastSpot?.spot ?? null)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--color-text-faint)] mb-0.5">Фьючерс сейчас</div>
            <div className="font-mono-tabular text-lg text-[var(--color-accent)]">
              {fmtUsd(lastFutures?.futures ?? null)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--color-text-faint)] mb-0.5">Цель</div>
            <div className="font-mono-tabular text-lg text-[var(--color-text)]">
              {fmtUsd(goal)}
            </div>
          </div>
        </div>
      )}

      {/* График */}
      {loading ? (
        <div className="h-[320px] flex items-center justify-center">
          <div className="skeleton h-3 w-32" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-[320px] flex items-center justify-center text-sm text-[var(--color-text-faint)]">
          Нет данных. Закройте несколько сделок или{" "}
          <Link href="/balance" className="text-[var(--color-accent)] hover:underline ml-1">
            добавьте точку вручную
          </Link>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              stroke="var(--color-text-faint)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => {
                // Форматируем дату: "ММ.ГГ" вместо "YYYY-MM-DD"
                const d = new Date(v);
                return d.toLocaleDateString("ru-RU", { month: "2-digit", year: "2-digit" });
              }}
              minTickGap={40}
            />
            <YAxis
              stroke="var(--color-text-faint)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => fmtUsd(Math.abs(v))}
              width={50}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text)",
                fontSize: 12,
              }}
              labelFormatter={(v: string) => new Date(v).toLocaleDateString("ru-RU")}
              formatter={(value: unknown, name: string) => {
                const n = typeof value === "number" ? value : null;
                if (n === null) return ["—", name];
                // futuresMirror показываем как положительное число
                if (name === "futuresMirror") return [fmtUsd(-n), "Фьючерс"];
                if (name === "spot") return [fmtUsd(n), "Спот"];
                if (name === "spread") return [fmtUsd(n), "Спред"];
                return [fmtUsd(n), name];
              }}
            />

            {/* Горизонтальная линия цели */}
            {goal && (
              <ReferenceLine
                y={goal}
                stroke="var(--color-text-faint)"
                strokeDasharray="2 4"
                label={{
                  value: `Цель ${fmtUsd(goal)}`,
                  position: "insideTopRight",
                  fill: "var(--color-text-faint)",
                  fontSize: 10,
                }}
              />
            )}
            {/* Ось X — горизонтальная линия на 0, separates spot (top) and futures (bottom) */}
            <ReferenceLine y={0} stroke="var(--color-border)" />

            {/* Спот — сплошная зелёная, smooth */}
            <Line
              type="monotone"
              dataKey="spot"
              stroke="var(--color-profit)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "var(--color-profit)" }}
              connectNulls
              // Smooth curve — recharts type="monotone" уже сглаживает.
            />

            {/* Фьючерс — сплошная синяя, зеркально вниз (значения отрицательные) */}
            <Line
              type="monotone"
              dataKey="futuresMirror"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "var(--color-accent)" }}
              connectNulls
            />

            {/* Спред — пунктирная оранжевая */}
            <Line
              type="monotone"
              dataKey="spread"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-[var(--color-text-faint)]">
          Спот — только ручной ввод. Фьючерс — авто из PnL + ручные override.
        </div>
        <Link
          href="/balance"
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          Управление точками →
        </Link>
      </div>
    </div>
  );
}
