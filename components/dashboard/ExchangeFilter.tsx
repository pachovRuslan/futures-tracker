"use client";

import { EXCHANGES, REGISTRY } from "@/lib/exchanges";
import { ALL_FILTERABLE_EXCHANGES, type FilterableExchange } from "./useExchangeFilter";

interface ExchangeFilterProps {
  selectedExchanges: Set<FilterableExchange>;
  onToggle: (ex: FilterableExchange) => void;
  onReset: () => void;
  isFilterActive: boolean;
}

/**
 * Панель с чекбоксами бирж — фильтр для PnL-расчётов.
 * Влияет на: итог PnL, статистика месяца, последние сделки, график PnL.
 * Не влияет на график «Спот vs Фьючерс».
 */
export default function ExchangeFilter({
  selectedExchanges,
  onToggle,
  onReset,
  isFilterActive,
}: ExchangeFilterProps) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-widest text-[var(--color-text-faint)] mr-2">
          Биржи в PnL:
        </span>
        {ALL_FILTERABLE_EXCHANGES.map((ex) => {
          const checked = selectedExchanges.has(ex);
          const label =
            ex === "manual"
              ? "Manual"
              : REGISTRY[ex as (typeof EXCHANGES)[number]]?.label ?? ex;
          return (
            <button
              key={ex}
              onClick={() => onToggle(ex)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
                checked
                  ? "border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-text)]"
                  : "border-[var(--color-border)] text-[var(--color-text-faint)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <span
                className={`w-3 h-3 rounded-sm border flex items-center justify-center text-[10px] ${
                  checked
                    ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                    : "border-[var(--color-border)]"
                }`}
              >
                {checked ? "✓" : ""}
              </span>
              {label}
            </button>
          );
        })}
        {isFilterActive && (
          <button
            onClick={onReset}
            className="text-xs text-[var(--color-accent)] hover:underline ml-2"
          >
            Сбросить фильтр
          </button>
        )}
      </div>
    </div>
  );
}
