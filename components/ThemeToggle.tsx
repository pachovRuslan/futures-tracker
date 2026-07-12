"use client";

import { useTheme } from "./ThemeProvider";

/**
 * Переключатель темы (light / dark / system).
 * Цикл по клику: light → dark → system → light.
 * Иконка: солнце (light), луна (dark), монитор (system).
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const icon =
    theme === "light" ? (
      // Солнце
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    ) : theme === "dark" ? (
      // Луна
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ) : (
      // Монитор (system)
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    );

  const label = theme === "light" ? "Светлая" : theme === "dark" ? "Тёмная" : "Системная";

  return (
    <button
      onClick={toggleTheme}
      title={`Тема: ${label} (клик для переключения)`}
      aria-label={`Переключить тему, сейчас ${label}`}
      className="flex items-center justify-center w-8 h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
    >
      {icon}
    </button>
  );
}
