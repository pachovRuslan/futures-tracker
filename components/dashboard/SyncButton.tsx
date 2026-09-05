"use client";

import { useState } from "react";
import { EXCHANGES, REGISTRY } from "@/lib/exchanges";

interface SyncButtonProps {
  onSyncComplete?: () => void;
}

/**
 * Кнопка «Синк всё» с прогресс-баром.
 * Последовательно синкает все 6 бирж, показывает прогресс.
 * По завершении вызывает onSyncComplete (обычно — перезагрузка данных).
 */
export default function SyncButton({ onSyncComplete }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    done: number;
    total: number;
    current: string;
  } | null>(null);

  async function syncAll() {
    setSyncing(true);
    setSyncMsg(null);
    setSyncProgress({
      done: 0,
      total: EXCHANGES.length,
      current: REGISTRY[EXCHANGES[0]].label,
    });

    let totalUpserted = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < EXCHANGES.length; i++) {
      const ex = EXCHANGES[i];
      setSyncProgress({
        done: i,
        total: EXCHANGES.length,
        current: REGISTRY[ex].label,
      });
      try {
        const res = await fetch(`/api/sync/${ex}`);
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (data.error && !data.error.includes("не подключён")) {
            errors.push(`${REGISTRY[ex].label}: ${data.error}`);
            failedCount++;
          }
        } else {
          totalUpserted += data.upserted ?? 0;
        }
      } catch (e) {
        errors.push(
          `${REGISTRY[ex].label}: ${e instanceof Error ? e.message : String(e)}`
        );
        failedCount++;
      }
    }

    setSyncProgress({
      done: EXCHANGES.length,
      total: EXCHANGES.length,
      current: "",
    });
    setSyncing(false);
    setSyncProgress(null);

    if (failedCount === 0) {
      setSyncMsg(`Готово — обновлено ${totalUpserted} записей`);
    } else if (failedCount === EXCHANGES.length) {
      setSyncMsg(`Все синки упали: ${errors.join("; ")}`);
    } else {
      setSyncMsg(
        `Обновлено ${totalUpserted} записей. Ошибки: ${errors.join("; ")}`
      );
    }

    onSyncComplete?.();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button onClick={syncAll} disabled={syncing} className="btn btn-primary">
        {syncing ? (
          <>
            <svg
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeOpacity="0.3"
              />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            Синк...
          </>
        ) : (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Синк всё
          </>
        )}
      </button>
      {syncProgress && (
        <div className="text-xs text-[var(--color-text-muted)] font-mono-tabular">
          {syncProgress.done} / {syncProgress.total} — {syncProgress.current}
        </div>
      )}
      {!syncing && !syncProgress && (
        <div className="text-xs text-[var(--color-text-faint)]">
          {EXCHANGES.length} бирж · по одной
        </div>
      )}
      {syncMsg && (
        <div className="text-xs text-[var(--color-text-muted)] font-mono-tabular max-w-xs text-right">
          {syncMsg}
        </div>
      )}
    </div>
  );
}
