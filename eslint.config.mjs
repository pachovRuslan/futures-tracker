// @ts-check
import eslintConfigNext from "eslint-config-next";

export default [
  ...eslintConfigNext,
  {
    rules: {
      // Запрещаем console.error в production-коде (кроме lib/sync.ts, lib/exchanges/*)
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Предупреждаем о неиспользуемых переменных
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // Предупреждаем о any
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Разрешаем console.error в серверных роутах и адаптерах
    files: ["app/api/**/*.ts", "lib/sync.ts", "lib/exchanges/*.ts", "lib/admin.ts"],
    rules: {
      "no-console": "off",
    },
  },
];
