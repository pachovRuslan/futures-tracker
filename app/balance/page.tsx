"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Snapshot {
  id: string;
  type: "spot" | "futures";
  value_usd: number;
  snapshot_date: string;
  note: string | null;
}

const emptyForm = {
  type: "spot" as "spot" | "futures",
  value_usd: "",
  snapshot_date: new Date().toISOString().slice(0, 10),
  note: "",
  is_delta: false as boolean,
};

export default function BalancePage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAppliedDelta, setLastAppliedDelta] = useState<{ delta: number; previous: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/balance");
    const data = await res.json();
    setSnapshots(data.snapshots ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateField<T extends keyof typeof emptyForm>(field: T, value: (typeof emptyForm)[T]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLastAppliedDelta(null);

    if (!form.value_usd || !form.snapshot_date) {
      setError("Сумма и дата обязательны");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          value_usd: Number(form.value_usd),
          snapshot_date: form.snapshot_date,
          note: form.note || null,
          is_delta: form.is_delta,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");

      // Если был режим дельты — показываем юзеру, что прибавили
      if (form.is_delta && data.applied_delta !== undefined) {
        setLastAppliedDelta({
          delta: data.applied_delta,
          previous: data.previous_value,
          total: data.snapshot.value_usd,
        });
      }

      setForm({ ...emptyForm, type: form.type, is_delta: form.is_delta }); // сохраняем выбор типа и режима
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить эту запись?")) return;
    await fetch(`/api/balance/${id}`, { method: "DELETE" });
    await load();
  }

  // Группируем по типу для отображения
  const spotSnapshots = snapshots.filter((s) => s.type === "spot");
  const futuresSnapshots = snapshots.filter((s) => s.type === "futures");

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Баланс и цели</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Ручной учёт спот-баланса и фьючерсного депозита. График на дашборде строится из этих
          точек. Спот — только ручной ввод. Фьючерс — по умолчанию считается из PnL, но можно
          переопределить вручную на любую дату.
        </p>
      </div>

      {/* Форма добавления */}
      <form onSubmit={submit} className="card p-5 flex flex-col gap-4">
        <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
          Добавить запись
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">Тип</label>
            <select
              value={form.type}
              onChange={(e) => updateField("type", e.target.value as "spot" | "futures")}
              className="input"
            >
              <option value="spot">Спот</option>
              <option value="futures">Фьючерс</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
              Режим суммы
            </label>
            <select
              value={form.is_delta ? "delta" : "total"}
              onChange={(e) => updateField("is_delta", e.target.value === "delta")}
              className="input"
            >
              <option value="total">Итог (абсолют)</option>
              <option value="delta">Дельта (± изменение)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
              {form.is_delta ? "Изменение, $" : "Сумма, $"}
            </label>
            <input
              value={form.value_usd}
              onChange={(e) => updateField("value_usd", e.target.value)}
              type="number"
              step="0.01"
              placeholder={form.is_delta ? "+200 или -50" : "1000.00"}
              className="input font-mono-tabular"
              inputMode="decimal"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">Дата</label>
            <input
              type="date"
              value={form.snapshot_date}
              onChange={(e) => updateField("snapshot_date", e.target.value)}
              className="input font-mono-tabular"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">Заметка</label>
          <input
            value={form.note}
            onChange={(e) => updateField("note", e.target.value)}
            placeholder="необязательно"
            className="input"
          />
        </div>

        {/* Подсказка по режиму */}
        <div className="text-xs text-[var(--color-text-faint)]">
          {form.is_delta ? (
            <>
              <strong>Дельта:</strong> введите изменение от предыдущего баланса.
              Например, <code className="font-mono-tabular">+200</code> = пополнили на $200,
              итог = предыдущий + 200. Первая точка должна быть в режиме «Итог».
            </>
          ) : (
            <>
              <strong>Итог:</strong> введите полную текущую сумму.
              Например, <code className="font-mono-tabular">1500</code> = у вас сейчас $1500 на споте.
            </>
          )}
        </div>

        {/* Подтверждение после сохранения в режиме дельты */}
        {lastAppliedDelta && (
          <div className="text-xs font-mono-tabular text-[var(--color-profit)] bg-[var(--color-profit-dim)] px-3 py-2 rounded">
            ✓ Применено: ${lastAppliedDelta.previous.toLocaleString("ru-RU")} + ${lastAppliedDelta.delta.toLocaleString("ru-RU")} = ${lastAppliedDelta.total.toLocaleString("ru-RU")}
          </div>
        )}

        {error && <div className="text-sm text-[var(--color-loss)]">{error}</div>}

        <button type="submit" disabled={saving || !form.value_usd} className="btn btn-primary self-start">
          {saving ? "Сохранение..." : "Добавить запись"}
        </button>
      </form>

      {/* Список снапшотов — две колонки */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SnapshotList
          title="Спот-баланс"
          snapshots={spotSnapshots}
          loading={loading}
          onRemove={remove}
          accentColor="var(--color-profit)"
        />
        <SnapshotList
          title="Фьючерсный депозит"
          snapshots={futuresSnapshots}
          loading={loading}
          onRemove={remove}
          accentColor="var(--color-accent)"
          hint="Переопределяет авто-расчёт из PnL"
        />
      </div>

      <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-[var(--color-text-muted)]">
          Цель и стартовый капитал настраиваются на дашборде.
        </div>
        <Link href="/" className="text-sm text-[var(--color-accent)] hover:underline">
          ← На дашборд
        </Link>
      </div>
    </div>
  );
}

function SnapshotList({
  title,
  snapshots,
  loading,
  onRemove,
  accentColor,
  hint,
}: {
  title: string;
  snapshots: Snapshot[];
  loading: boolean;
  onRemove: (id: string) => void;
  accentColor: string;
  hint?: string;
}) {
  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-[var(--color-text-faint)]">({snapshots.length})</span>
        </div>
        {hint && <div className="text-xs text-[var(--color-text-faint)] mt-1">{hint}</div>}
      </div>

      {loading ? (
        <div className="p-5 text-sm text-[var(--color-text-faint)]">Загрузка...</div>
      ) : snapshots.length === 0 ? (
        <div className="p-5 text-sm text-[var(--color-text-faint)]">Пока ничего не добавлено</div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {snapshots.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-[var(--color-surface-hover)] transition-colors">
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono-tabular text-sm">
                    ${Number(s.value_usd).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-[var(--color-text-faint)] font-mono-tabular">
                    {s.snapshot_date}
                  </span>
                </div>
                {s.note && <div className="text-xs text-[var(--color-text-muted)] truncate">{s.note}</div>}
              </div>
              <button
                onClick={() => onRemove(s.id)}
                className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-loss)] px-2"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
