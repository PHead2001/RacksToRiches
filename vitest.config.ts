import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __DEV_TOOLS__: false },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/game/**/*.ts"],
      exclude: ["src/game/index.ts"],
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
