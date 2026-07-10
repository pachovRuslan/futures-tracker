"use client";

import { useEffect, useState, useCallback } from "react";

interface Connection {
  exchange: "bybit" | "bitunix";
  key_preview: string;
  created_at: string;
}

const EXCHANGES: { id: "bybit" | "bitunix"; label: string }[] = [
  { id: "bybit", label: "Bybit" },
  { id: "bitunix", label: "Bitunix" },
];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [formExchange, setFormExchange] = useState<"bybit" | "bitunix">("bybit");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/connections");
    const data = await res.json();
    setConnections(data.connections ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchange: formExchange, apiKey, apiSecret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");

      setApiKey("");
      setApiSecret("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function disconnect(exchange: string) {
    if (!confirm(`Отключить ${exchange}? Уже синканные сделки останутся в истории.`)) return;
    await fetch(`/api/connections/${exchange}`, { method: "DELETE" });
    await load();
  }

  const connectedExchanges = new Set(connections.map((c) => c.exchange));

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-lg mb-1">Подключения к биржам</h1>
        <p className="text-sm text-[var(--color-text-faint)]">
          Ключи хранятся в зашифрованном виде и используются только для чтения истории закрытых
          позиций (read-only). Проверяем ключ реальным запросом перед сохранением.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {loading && (
          <div className="text-sm text-[var(--color-text-faint)]">Загрузка...</div>
        )}
        {!loading &&
          EXCHANGES.map(({ id, label }) => {
            const conn = connections.find((c) => c.exchange === id);
            return (
              <div
                key={id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm">{label}</span>
                  {conn ? (
                    <span className="text-xs font-mono-tabular text-[var(--color-profit)]">
                      подключено · {conn.key_preview}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-text-faint)]">не подключено</span>
                  )}
                </div>
                {conn && (
                  <button
                    onClick={() => disconnect(id)}
                    className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-loss)]"
                  >
                    Отключить
                  </button>
                )}
              </div>
            );
          })}
      </div>

      <form
        onSubmit={submit}
        className="flex flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      >
        <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
          {connectedExchanges.has(formExchange) ? "Обновить ключ" : "Добавить подключение"}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
            Биржа
          </label>
          <select
            value={formExchange}
            onChange={(e) => setFormExchange(e.target.value as "bybit" | "bitunix")}
            className="input"
          >
            {EXCHANGES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
            API Key (read-only!)
          </label>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="input font-mono-tabular"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
            API Secret
          </label>
          <input
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            type="password"
            className="input font-mono-tabular"
            autoComplete="off"
          />
        </div>

        {error && <div className="text-sm text-[var(--color-loss)]">{error}</div>}

        <button
          type="submit"
          disabled={saving || !apiKey || !apiSecret}
          className="px-4 py-2 rounded-md bg-[var(--color-accent)] text-white text-sm disabled:opacity-50 self-start"
        >
          {saving ? "Проверка ключа..." : "Сохранить"}
        </button>
      </form>

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
