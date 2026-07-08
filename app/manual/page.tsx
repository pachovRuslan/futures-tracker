"use client";

import { useEffect, useState, useCallback } from "react";
import type { Trade } from "@/lib/types";

const emptyForm = {
  symbol: "",
  side: "long" as "long" | "short",
  qty: "",
  entry_price: "",
  close_price: "",
  realized_pnl: "",
  fee: "",
  funding: "",
  opened_at: "",
  closed_at: "",
  notes: "",
};

export default function ManualTradesPage() {
  const [form, setForm] = useState(emptyForm);
  const [manualTrades, setManualTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/trades?exchange=manual&limit=500");
    const data = await res.json();
    setManualTrades(data.trades ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.symbol || !form.closed_at) {
      setError("Символ и дата закрытия обязательны");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: form.symbol.toUpperCase(),
          side: form.side,
          qty: form.qty ? Number(form.qty) : null,
          entry_price: form.entry_price ? Number(form.entry_price) : null,
          close_price: form.close_price ? Number(form.close_price) : null,
          realized_pnl: form.realized_pnl ? Number(form.realized_pnl) : 0,
          fee: form.fee ? Number(form.fee) : 0,
          funding: form.funding ? Number(form.funding) : 0,
          opened_at: form.opened_at ? new Date(form.opened_at).toISOString() : null,
          closed_at: new Date(form.closed_at).toISOString(),
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");

      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить эту сделку?")) return;
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-lg mb-1">Добавить сделку вручную</h1>
        <p className="text-sm text-[var(--color-text-faint)]">
          Для старых сделок, которые биржа не подтянула, или сделок вне API-синка.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      >
        <Field label="Символ *">
          <input
            value={form.symbol}
            onChange={(e) => updateField("symbol", e.target.value)}
            placeholder="BTCUSDT"
            className="input"
          />
        </Field>

        <Field label="Сторона *">
          <select
            value={form.side}
            onChange={(e) => updateField("side", e.target.value)}
            className="input"
          >
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </Field>

        <Field label="Объём">
          <input
            value={form.qty}
            onChange={(e) => updateField("qty", e.target.value)}
            className="input font-mono-tabular"
            inputMode="decimal"
          />
        </Field>

        <Field label="Цена входа">
          <input
            value={form.entry_price}
            onChange={(e) => updateField("entry_price", e.target.value)}
            className="input font-mono-tabular"
            inputMode="decimal"
          />
        </Field>

        <Field label="Цена выхода">
          <input
            value={form.close_price}
            onChange={(e) => updateField("close_price", e.target.value)}
            className="input font-mono-tabular"
            inputMode="decimal"
          />
        </Field>

        <Field label="PnL *">
          <input
            value={form.realized_pnl}
            onChange={(e) => updateField("realized_pnl", e.target.value)}
            className="input font-mono-tabular"
            inputMode="decimal"
          />
        </Field>

        <Field label="Комиссия">
          <input
            value={form.fee}
            onChange={(e) => updateField("fee", e.target.value)}
            className="input font-mono-tabular"
            inputMode="decimal"
          />
        </Field>

        <Field label="Фандинг">
          <input
            value={form.funding}
            onChange={(e) => updateField("funding", e.target.value)}
            className="input font-mono-tabular"
            inputMode="decimal"
          />
        </Field>

        <Field label="Открыта">
          <input
            type="datetime-local"
            value={form.opened_at}
            onChange={(e) => updateField("opened_at", e.target.value)}
            className="input font-mono-tabular"
          />
        </Field>

        <Field label="Закрыта *">
          <input
            type="datetime-local"
            value={form.closed_at}
            onChange={(e) => updateField("closed_at", e.target.value)}
            className="input font-mono-tabular"
          />
        </Field>

        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
            Заметка
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="ретест лоджник, поздний вход и т.д."
            rows={2}
            className="input resize-none"
          />
        </div>

        {error && <div className="col-span-2 text-sm text-[var(--color-loss)]">{error}</div>}

        <div className="col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md bg-[var(--color-accent)] text-white text-sm disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Добавить сделку"}
          </button>
        </div>
      </form>

      <div>
        <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mb-3">
          Добавленные вручную ({manualTrades.length})
        </div>
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
          {loading && (
            <div className="px-4 py-6 text-sm text-[var(--color-text-faint)]">Загрузка...</div>
          )}
          {!loading && manualTrades.length === 0 && (
            <div className="px-4 py-6 text-sm text-[var(--color-text-faint)]">
              Пока ничего не добавлено
            </div>
          )}
          {manualTrades.map((t) => {
            const positive = t.realized_pnl >= 0;
            return (
              <div
                key={t.id}
                className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] first:border-t-0"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="font-mono-tabular text-sm">
                    {t.symbol} · {t.side === "long" ? "Long" : "Short"} ·{" "}
                    {new Date(t.closed_at).toLocaleDateString("ru-RU")}
                  </div>
                  {t.notes && (
                    <div className="text-xs text-[var(--color-text-muted)]">{t.notes}</div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`font-mono-tabular text-sm ${
                      positive ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {t.realized_pnl.toFixed(2)}
                  </span>
                  <button
                    onClick={() => remove(t.id)}
                    className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-loss)]"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .input {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 14px;
          color: var(--color-text);
          width: 100%;
        }
        .input:focus {
          outline: none;
          border-color: var(--color-accent);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
        {label}
      </label>
      {children}
    </div>
  );
}
