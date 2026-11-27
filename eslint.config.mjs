// Monorepo ESLint config (flat). Run from the repo root: `npm run lint`.
// eslint-config-next 15.x ships legacy (eslintrc) configs, so they're loaded via FlatCompat.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    ignores: [
      "**/node_modules/**",
      // Local agent tooling folders (untracked, not part of the app).
      ".agent/**",
      ".agents/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "**/*.d.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    settings: {
      next: { rootDir: ["apps/*/"] },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    // The Prisma-compatible adapter evaluates arbitrary Prisma-style args by design.
    files: ["packages/shared/src/db-adapter/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    // Shared package has no pages/ or app/ dir of its own.
    files: ["packages/**/*.{ts,tsx}"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
];

export default config;
