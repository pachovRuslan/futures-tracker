"use client";

import { useEffect, useState, useCallback } from "react";

interface AllowlistEntry {
  email: string;
  added_at: string | null;
  added_by: string | null;
  note: string | null;
  source: "db" | "env";
}

interface UserOverview {
  email: string;
  user_id: string;
  registered_at: string;
  last_sign_in_at: string | null;
  bybit: number;
  bitunix: number;
  binance: number;
  bitget: number;
  bingx: number;
  mexc: number;
  total_connections: number;
  last_connection_at: string | null;
  trades_count: number;
  last_trade_at: string | null;
  total_net_pnl: number;
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

function fmtPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return (
    sign +
    n.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<"allowlist" | "users">("allowlist");
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [users, setUsers] = useState<UserOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadAllowlist = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/allowlist");
    const data = await res.json();
    setAllowlist(data.allowlist ?? []);
    setLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "allowlist") loadAllowlist();
    else loadUsers();
  }, [tab, loadAllowlist, loadUsers]);

  async function addEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (!newEmail || !newEmail.includes("@")) {
      setError("Некорректный email");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, note: newNote || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        // data.error может быть строкой или объектом (например, от Supabase).
        // Если объект — stringify, чтобы не получить [object Object] в UI.
        const errMsg =
          typeof data.error === "string"
            ? data.error
            : data.error
            ? JSON.stringify(data.error)
            : `HTTP ${res.status}`;
        throw new Error(errMsg);
      }
      setMsg(`✓ ${newEmail} добавлен в allowlist`);
      setNewEmail("");
      setNewNote("");
      await loadAllowlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeEmail(email: string) {
    if (!confirm(`Удалить ${email} из allowlist? Пользователь потеряет доступ.`)) return;
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/admin/allowlist/${encodeURIComponent(email)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      const errMsg =
        typeof data.error === "string"
          ? data.error
          : data.error
          ? JSON.stringify(data.error)
          : `HTTP ${res.status}`;
      setError(errMsg);
    } else {
      setMsg(`✓ ${email} удалён из allowlist`);
      await loadAllowlist();
    }
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Админка</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Управление allowlist и просмотр статистики пользователей.
        </p>
      </div>

      {/* Табы */}
      <div className="flex gap-2 border-b border-[var(--color-border)]">
        <button
          onClick={() => setTab("allowlist")}
          className={`px-4 py-2 text-sm border-b-2 transition-colors ${
            tab === "allowlist"
              ? "border-[var(--color-accent)] text-[var(--color-accent)]"
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          Allowlist ({allowlist.length})
        </button>
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 text-sm border-b-2 transition-colors ${
            tab === "users"
              ? "border-[var(--color-accent)] text-[var(--color-accent)]"
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          Пользователи ({users.length})
        </button>
      </div>

      {msg && (
        <div className="text-sm text-[var(--color-profit)] bg-[var(--color-profit-dim)] px-3 py-2 rounded">
          {msg}
        </div>
      )}
      {error && (
        <div className="text-sm text-[var(--color-loss)] bg-[var(--color-loss-dim)] px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Таб: Allowlist */}
      {tab === "allowlist" && (
        <div className="flex flex-col gap-6">
          {/* Форма добавления */}
          <form onSubmit={addEmail} className="card p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
                Email
              </label>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                type="email"
                placeholder="user@gmail.com"
                className="input"
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs uppercase tracking-widest text-[var(--color-text-faint)]">
                Заметка
              </label>
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="необязательно"
                className="input"
              />
            </div>
            <button type="submit" disabled={saving || !newEmail} className="btn btn-primary">
              {saving ? "..." : "Добавить"}
            </button>
          </form>

          {/* Список allowlist */}
          <div className="card">
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <span className="text-sm font-medium">Разрешённые email-ы</span>
            </div>
            {loading ? (
              <div className="p-5 text-sm text-[var(--color-text-faint)]">Загрузка...</div>
            ) : allowlist.length === 0 ? (
              <div className="p-5 text-sm text-[var(--color-text-faint)]">
                Allowlist пуст. Добавьте email-ы выше или заполните ALLOWED_EMAILS в env.
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {allowlist.map((entry) => (
                  <div
                    key={entry.email}
                    className="flex items-center justify-between px-5 py-3 hover:bg-[var(--color-surface-hover)] transition-colors gap-3"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono-tabular text-sm">{entry.email}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            entry.source === "db"
                              ? "bg-[var(--color-profit-dim)] text-[var(--color-profit)]"
                              : "bg-[var(--color-surface-hover)] text-[var(--color-text-faint)]"
                          }`}
                        >
                          {entry.source === "db" ? "БД" : "env"}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-faint)]">
                        {entry.added_at ? `Добавлен ${fmtDate(entry.added_at)}` : ""}
                        {entry.note ? ` · ${entry.note}` : ""}
                      </div>
                    </div>
                    {entry.source === "db" && (
                      <button
                        onClick={() => removeEmail(entry.email)}
                        className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-loss)] px-2 shrink-0"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Таб: Пользователи */}
      {tab === "users" && (
        <div className="card overflow-x-auto">
          {loading ? (
            <div className="p-5 text-sm text-[var(--color-text-faint)]">Загрузка...</div>
          ) : users.length === 0 ? (
            <div className="p-5 text-sm text-[var(--color-text-faint)]">
              Пока никто не зарегистрировался.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface)] text-[var(--color-text-faint)] text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-normal">Email</th>
                  <th className="text-left px-4 py-3 font-normal">Рега</th>
                  <th className="text-left px-4 py-3 font-normal">Вход</th>
                  <th className="text-center px-4 py-3 font-normal">Bybit</th>
                  <th className="text-center px-4 py-3 font-normal">Bitunix</th>
                  <th className="text-center px-4 py-3 font-normal">Binance</th>
                  <th className="text-center px-4 py-3 font-normal">Bitget</th>
                  <th className="text-center px-4 py-3 font-normal">BingX</th>
                  <th className="text-center px-4 py-3 font-normal">MEXC</th>
                  <th className="text-right px-4 py-3 font-normal">Сделок</th>
                  <th className="text-right px-4 py-3 font-normal">PnL</th>
                  <th className="text-left px-4 py-3 font-normal">Посл. сделка</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.user_id}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono-tabular text-xs">{u.email}</td>
                    <td className="px-4 py-2.5 text-xs text-[var(--color-text-faint)] whitespace-nowrap">
                      {fmtDate(u.registered_at)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--color-text-faint)] whitespace-nowrap">
                      {fmtDate(u.last_sign_in_at)}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      {u.bybit ? <span className="text-[var(--color-profit)]">✓</span> : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      {u.bitunix ? <span className="text-[var(--color-profit)]">✓</span> : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      {u.binance ? <span className="text-[var(--color-profit)]">✓</span> : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      {u.bitget ? <span className="text-[var(--color-profit)]">✓</span> : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      {u.bingx ? <span className="text-[var(--color-profit)]">✓</span> : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      {u.mexc ? <span className="text-[var(--color-profit)]">✓</span> : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-tabular text-xs">
                      {u.trades_count}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono-tabular text-xs ${
                        u.total_net_pnl >= 0
                          ? "text-[var(--color-profit)]"
                          : "text-[var(--color-loss)]"
                      }`}
                    >
                      {fmtPnl(Number(u.total_net_pnl))}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--color-text-faint)] whitespace-nowrap">
                      {fmtDate(u.last_trade_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
