/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/packages/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "json", "html"],
      exclude: ["src/**/*.test.ts"],
      // Recalibrated for vitest 4's accurate AST-based remapper. Old
      // thresholds (statements 25, branches 60, functions 60, lines 25)
      // were satisfiable only because vitest 3's v8-to-istanbul remap
      // produced false-positive coverage. Real numbers across cli.ts,
      // index.ts, root.ts, search.ts: ~24/30/32/24. Bar set just under
      // current reality so any regression fails CI; ratchet up as cli.ts
      // and index.ts gain tests.
      thresholds: {
        statements: 24,
        branches: 30,
        functions: 32,
        lines: 24,
      },
    },
  },
});
