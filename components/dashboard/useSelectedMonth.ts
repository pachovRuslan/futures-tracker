"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "futures-tracker-selected-month";

function loadFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.length === 7) return saved; // YYYY-MM
  } catch {}
  return null;
}

/**
 * Хук выбранного месяца — для кликабельного графика PnL.
 * null = текущий (самый свежий) месяц.
 * При клике на столбец графика — устанавливается месяц.
 * Состояние сохраняется в localStorage.
 *
 * Возвращает:
 *   selectedMonth — выбранный месяц или null
 *   selectMonth(month) — выбрать месяц
 *   resetMonth() — сбросить (вернуть null = текущий)
 */
export function useSelectedMonth() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    setSelectedMonth(loadFromStorage());
  }, []);

  const selectMonth = useCallback((month: string) => {
    setSelectedMonth(month);
    try {
      localStorage.setItem(STORAGE_KEY, month);
    } catch {}
  }, []);

  const resetMonth = useCallback(() => {
    setSelectedMonth(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return { selectedMonth, selectMonth, resetMonth };
}
