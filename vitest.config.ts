/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}", "tests/types/**/*.test.ts"],
    environment: "node",
    // Plain tsc cannot resolve `.astro` imports (only `astro check` can), so type tests get their own scope.
    typecheck: { enabled: true, include: ["tests/types/**/*.test.ts"], tsconfig: "./tsconfig.typecheck.json" },
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/i18n/**", "src/scripts/**"],
      exclude: ["src/lib/og.ts", "src/lib/feed-items.ts"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
      reporter: ["text", "html", "lcov"],
    },
  },
});
