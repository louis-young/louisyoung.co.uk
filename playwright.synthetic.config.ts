import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.CHROMIUM_PATH;

/** Smoke tests against the live site. Run on a schedule by .github/workflows/synthetics.yml. */
export default defineConfig({
  testDir: "tests/synthetic",
  retries: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: process.env.SYNTHETIC_BASE_URL ?? "https://louisyoung.co.uk",
    ...devices["Desktop Chrome"],
    ...(executablePath && { launchOptions: { executablePath } }),
  },
});
