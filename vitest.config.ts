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
      thresholds: {
        statements: 25,
        branches: 60,
        functions: 60,
        lines: 25,
      },
    },
  },
});
