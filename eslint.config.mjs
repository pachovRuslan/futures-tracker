// @ts-check
import eslintConfigNext from "eslint-config-next";
import tseslint from "typescript-eslint";

export default [
  ...eslintConfigNext,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "prefer-const": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "import/no-anonymous-default-export": "warn",
    },
  },
  {
    files: ["app/api/**/*.ts", "lib/sync.ts", "lib/exchanges/*.ts", "lib/admin.ts"],
    rules: {
      "no-console": "off",
    },
  },
];
