"use client";

import { useEffect, useState, useCallback } from "react";
import { EXCHANGES, REGISTRY } from "@/lib/exchanges";

// Цветной бейдж-кружок на кнопке синка — визуальный якорь для каждой биржи,
// без использования настоящих логотипов (только цвет + инициалы).
const BADGE_COLOR: Record<string, string> = {
  bybit: "#FFC94D",
  bitunix: "#38E1C6",
  binance: "#F3BA2F",
  bitget: "#00E5FF",
  bingx: "#8C9CFF",
  mexc: "#C6A2FF",
};

function badgeInitials(exchange: string): string {
  if (exchange === "bybit") return "B";
  if (exchange === "bitunix") return "BX";
  if (exchange === "binance") return "BN";
  if (exchange === "bitget") return "BG";
  if (exchange === "bingx") return "BGX";
  if (exchange === "mexc") return "MX";
  return exchange.slice(0, 2).toUpperCase();
}

interface Connection {
  exchange: (typeof EXCHANGES)[number];
  key_preview: string;
  created_at: string;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [formExchange, setFormExchange] = useState<(typeof EXCHANGES)[number]>("bybit");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMsgs, setSyncMsgs] = useState<Record<string, string>>({});

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

  function selectExchange(ex: (typeof EXCHANGES)[number]) {
    setFormExchange(ex);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, string> = {
        exchange: formExchange,
        apiKey,
        apiSecret,
      };
      if (REGISTRY[formExchange].credentialsSchema === "key+secret+passphrase") {
        body.passphrase = passphrase;
      }

      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");

      setApiKey("");
      setApiSecret("");
      setPassphrase("");
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

  async function syncOne(exchange: (typeof EXCHANGES)[number]) {
    setSyncing(exchange);
    setSyncMsgs((prev) => ({ ...prev, [exchange]: "Синк..." }));
    try {
      const res = await fetch(`/api/sync/${exchange}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Ошибка");
      setSyncMsgs((prev) => ({
        ...prev,
        [exchange]: `✓ Обновлено ${data.upserted ?? 0} записей`,
      }));
    } catch (e) {
      setSyncMsgs((prev) => ({
        ...prev,
        [exchange]: `✗ ${e instanceof Error ? e.message : String(e)}`,
      }));
    } finally {
      setSyncing(null);
    }
  }

  const connectedSet = new Set(connections.map((c) => c.exchange));
  const currentAdapter = REGISTRY[formExchange];
  const needsPassphrase = currentAdapter.credentialsSchema === "key+secret+passphrase";

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Подключения к биржам</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Ключи хранятся зашифрованными (AES-256-GCM), используются только для чтения истории
          закрытых позиций. Перед сохранением каждый ключ проверяется реальным запросом к бирже.
        </p>
      </div>

      {/* Список бирж с статусом подключений */}
      <div className="flex flex-col gap-2">
        {loading && (
          <div className="text-sm text-[var(--color-text-faint)]">Загрузка...</div>
        )}
        {!loading &&
          EXCHANGES.map((id) => {
            const adapter = REGISTRY[id];
            const conn = connections.find((c) => c.exchange === id);
            return (
              <div key={id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="exchange-badge"
                    style={{ background: BADGE_COLOR[id] ?? "var(--color-text-faint)" }}
                  >
                    {badgeInitials(id)}
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{adapter.label}</span>
                      {adapter.credentialsSchema === "key+secret+passphrase" && (
                        <span className="text-xs text-[var(--color-text-faint)]">+ passphrase</span>
                      )}
                    </div>
                    {conn ? (
                      <span className="text-xs font-mono-tabular text-[var(--color-profit)]">
                        ✓ {conn.key_preview}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-faint)]">не подключено</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {conn && (
                    <>
                      <button
                        onClick={() => syncOne(id)}
                        disabled={syncing !== null}
                        className="btn-pill"
                      >
                        <span
                          className="exchange-badge"
                          style={{ background: BADGE_COLOR[id] ?? "var(--color-text-faint)" }}
                        >
                          {badgeInitials(id)}
                        </span>
                        {syncing === id ? "Синк..." : `Синк ${adapter.label}`}
                      </button>
                      <button
                        onClick={() => disconnect(id)}
                        className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-loss)] px-2 py-1"
                      >
                        Отключить
                      </button>
                    </>
                  )}
                </div>

                {syncMsgs[id] && (
                  <div className="w-full text-xs text-[var(--color-text-muted)] font-mono-tabular pt-1">
                    {syncMsgs[id]}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Форма добавления/обновления */}
      <form onSubmit={submit} className="card p-5 flex flex-col gap-4">
        <div className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
          {connectedSet.has(formExchange) ? "Обновить ключ" : "Добавить подключение"}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
            Биржа
          </label>
          <select
            value={formExchange}
            onChange={(e) => selectExchange(e.target.value as (typeof EXCHANGES)[number])}
            className="input"
          >
            {EXCHANGES.map((id) => (
              <option key={id} value={id}>
                {REGISTRY[id].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
            API Key <span className="normal-case text-[var(--color-loss)]">(read-only!)</span>
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

        {needsPassphrase && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
              Passphrase
            </label>
            <input
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              type="password"
              className="input font-mono-tabular"
              autoComplete="off"
            />
            <span className="text-xs text-[var(--color-text-faint)]">
              {currentAdapter.label} требует третье поле — passphrase, который вы задали при
              создании API-ключа на бирже.
            </span>
          </div>
        )}

        {error && <div className="text-sm text-[var(--color-loss)]">{error}</div>}

        <button
          type="submit"
          disabled={saving || !apiKey || !apiSecret || (needsPassphrase && !passphrase)}
          className="btn btn-primary self-start"
        >
          {saving ? "Проверка ключа..." : "Сохранить"}
        </button>
      </form>
    </div>
  );
}
