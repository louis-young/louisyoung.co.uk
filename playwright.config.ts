import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["PW_PORT"] ?? 4321);
const ci = Boolean(process.env.CI);
/** Lets local runs reuse a preinstalled Chromium (e.g. in cloud sandboxes) instead of downloading one. */
const executablePath = process.env.CHROMIUM_PATH;
const chromium = { ...devices["Desktop Chrome"], ...(executablePath && { launchOptions: { executablePath } }) };

export default defineConfig({
  forbidOnly: ci,
  retries: 0,
  ...(ci && { workers: 2 }),
  reporter: ci ? [["github"], ["html", { open: "never" }]] : [["list"]],
  snapshotPathTemplate: "tests/visual/__screenshots__/{projectName}/{arg}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide" } },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `pnpm preview --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !ci,
    timeout: 30_000,
  },
  projects: [
    { name: "chromium", testDir: "tests/e2e", use: chromium },
    { name: "firefox", testDir: "tests/e2e", use: devices["Desktop Firefox"] },
    {
      name: "webkit",
      testDir: "tests/e2e",
      // Playwright's Linux WebKit stalls mid cross-document view transition on CI (page.url() reads
      // "" and links lose their layout box), failing random click-to-navigate tests. Reduced motion
      // turns the transitions off via the site's own media query; Chromium and mobile still cover them.
      use: { ...devices["Desktop Safari"], contextOptions: { reducedMotion: "reduce" } },
    },
    {
      name: "mobile",
      testDir: "tests/e2e",
      use: { ...devices["Pixel 7"], ...(executablePath && { launchOptions: { executablePath } }) },
    },
    { name: "a11y", testDir: "tests/a11y", use: chromium },
    { name: "visual", testDir: "tests/visual", use: chromium },
  ],
});
