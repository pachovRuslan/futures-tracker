"use client";

import { useState, useEffect, useCallback } from "react";
import { EXCHANGES } from "@/lib/exchanges";

const ALL_EXCHANGES_WITH_MANUAL = [...EXCHANGES, "manual"] as const;
export type FilterableExchange = (typeof ALL_EXCHANGES_WITH_MANUAL)[number];

export const ALL_FILTERABLE_EXCHANGES = ALL_EXCHANGES_WITH_MANUAL;

const STORAGE_KEY = "futures-tracker-exchange-filter";

function loadFromStorage(): Set<FilterableExchange> {
  if (typeof window === "undefined") return new Set(ALL_EXCHANGES_WITH_MANUAL);
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return new Set(ALL_EXCHANGES_WITH_MANUAL);
    const arr = JSON.parse(saved) as string[];
    const valid = arr.filter((e) =>
      (ALL_EXCHANGES_WITH_MANUAL as readonly string[]).includes(e)
    ) as FilterableExchange[];
    return valid.length > 0 ? new Set(valid) : new Set(ALL_EXCHANGES_WITH_MANUAL);
  } catch {
    return new Set(ALL_EXCHANGES_WITH_MANUAL);
  }
}

/**
 * Хук фильтра бирж — выбирает, какие биржи участвуют в PnL-расчётах.
 * Состояние сохраняется в localStorage.
 *
 * Возвращает:
 *   selectedExchanges — Set выбранных бирж
 *   toggleExchange(ex) — переключить биржу
 *   selectAllExchanges() — выбрать все
 *   isFilterActive — true если не все выбраны
 */
export function useExchangeFilter() {
  const [selectedExchanges, setSelectedExchanges] = useState<Set<FilterableExchange>>(
    new Set(ALL_EXCHANGES_WITH_MANUAL)
  );

  useEffect(() => {
    setSelectedExchanges(loadFromStorage());
  }, []);

  const toggleExchange = useCallback((ex: FilterableExchange) => {
    setSelectedExchanges((prev) => {
      const next = new Set(prev);
      if (next.has(ex)) {
        if (next.size > 1) next.delete(ex); // не даём снять последний
      } else {
        next.add(ex);
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const selectAllExchanges = useCallback(() => {
    setSelectedExchanges(new Set(ALL_EXCHANGES_WITH_MANUAL));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ALL_EXCHANGES_WITH_MANUAL)));
    } catch {}
  }, []);

  const isFilterActive = selectedExchanges.size < ALL_EXCHANGES_WITH_MANUAL.length;

  return { selectedExchanges, toggleExchange, selectAllExchanges, isFilterActive };
}
