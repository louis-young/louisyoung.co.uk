import type { Page } from "@playwright/test";

import { decodeShareState } from "../../src/lib/share-state";
import { expect, test } from "./fixtures";

const openPalette = async (page: Page) => {
  await page.getByRole("button", { name: "Open command palette" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();
  return dialog;
};

test.describe("command palette index", () => {
  test("loads its options on demand instead of shipping them in every page", async ({ page }) => {
    const html = await (await page.request.get("/")).text();
    const shell = /<dialog[^>]*id="palette"[\s\S]*?<\/dialog>/u.exec(html)?.[0] ?? "";
    // The shell is there, with its groups, but no options: not a page, tool, article or action.
    expect(shell).toContain('role="listbox"');
    expect(shell).toContain('role="group"');
    expect(html).not.toContain('role="option"');
    for (const title of ["Contrast checker", "Copy email address", "Accessibility", "/changelog"]) {
      expect(shell).not.toContain(title);
    }

    const requests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/palette.json") requests.push(request.url());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(requests).toEqual([]);

    // Focus (or a pointer) reaching the opener warms the palette: the index is fetched then.
    const index = page.waitForResponse((response) => new URL(response.url()).pathname === "/palette.json");
    await page.getByRole("button", { name: "Open command palette" }).first().focus();
    expect((await index).ok()).toBe(true);

    const dialog = await openPalette(page);
    await expect(dialog.getByRole("option", { name: "Contrast checker" })).toBeAttached();
    expect(await dialog.getByRole("option").count()).toBeGreaterThan(30);
    expect(requests).toHaveLength(1);
  });

  test("shows an error with a retry when the index can't load", async ({ page, consoleErrors }) => {
    await page.route("**/palette.json", (route) => route.abort("internetdisconnected"));
    await page.goto("/");
    const dialog = await openPalette(page);
    await expect(dialog.locator("[data-palette-error]")).toContainText("Couldn’t load the pages.");
    await expect(dialog.getByRole("status")).toHaveText(/Couldn’t load the pages/u);
    await expect(dialog.getByRole("option")).toHaveCount(0);
    await expect(dialog.getByRole("combobox")).toBeFocused();

    await page.unroute("**/palette.json");
    await dialog.getByRole("button", { name: "Try again" }).click();
    await expect(dialog.getByRole("option", { name: "Home" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Try again" })).toBeHidden();
    await expect(dialog.getByRole("combobox")).toBeFocused();
    // The browser logs the failed request itself; that one, expected, error is all there is.
    expect(consoleErrors.every((error) => /palette\.json|Failed to load resource/u.test(error))).toBe(true);
    consoleErrors.length = 0;
  });
});

test.describe("quick answers", () => {
  const cases = [
    { type: "Unix timestamp", query: "1700000000", value: /14 Nov 2023, 22:13:20 GMT/u, tool: "Timestamp converter" },
    {
      type: "ISO date",
      query: "2026-10-09T09:30:00Z",
      value: /9 Oct 2026, 09:30:00 GMT/u,
      tool: "Timestamp converter",
    },
    { type: "hex colour", query: "#7c6cf0", value: /^oklch\(/u, tool: "Contrast checker" },
    { type: "functional colour", query: "hsl(240 100% 50%)", value: /^#0000ff$/u, tool: "Contrast checker" },
    {
      type: "UUID",
      query: "uuid",
      value: /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u,
      tool: "Hash and UUID generator",
    },
    {
      type: "cron expression",
      query: "0 9 * * 1-5",
      value: /^At 09:00 on weekdays$/u,
      tool: "Cron expression explainer",
    },
    { type: "hex number", query: "0xff", value: /^255$/u, tool: "Number base converter" },
    { type: "binary number", query: "0b1010", value: /^10$/u, tool: "Number base converter" },
    { type: "arithmetic", query: "2^10", value: /^1,024$/u, tool: undefined },
    {
      type: "CSS selector",
      query: "#main .card > a:hover",
      value: /^\(1, 2, 1\)$/u,
      tool: "CSS specificity calculator",
    },
  ];

  for (const { type, query, value, tool } of cases) {
    test(`answers a ${type}`, async ({ page }) => {
      await page.goto("/");
      const dialog = await openPalette(page);
      await dialog.getByRole("combobox").fill(query);
      const answer = dialog.getByRole("option", { name: /^Answer: .+\. Press Enter to copy\.$/u });
      await expect(answer).toBeVisible();
      // The answer comes first and is the one Enter acts on.
      await expect(dialog.getByRole("option").first()).toHaveAttribute("id", "palette-answer");
      await expect(answer).toHaveAttribute("aria-selected", "true");
      await expect(answer.locator(".palette__answer-value")).toHaveText(value);
      const label = await answer.getAttribute("aria-label");
      expect(label).toBe(
        `Answer: ${await answer.locator(".palette__answer-value").textContent()}. Press Enter to copy.`,
      );
      await expect(dialog.getByRole("status")).toContainText(label ?? "");
      if (tool) await expect(dialog.getByRole("option", { name: `Open in ${tool}` })).toBeVisible();
      else await expect(dialog.locator("#palette-answer-tool")).toHaveCount(0);
    });
  }

  test("a colour answer has a swatch with a text alternative, and contrast against white and black", async ({
    page,
  }) => {
    await page.goto("/");
    const dialog = await openPalette(page);
    await dialog.getByRole("combobox").fill("#7c6cf0");
    const answer = dialog.locator("#palette-answer");
    await expect(answer.locator(".palette__swatch")).toHaveAttribute("aria-label", "Colour swatch of #7c6cf0");
    await expect(answer.locator(".palette__swatch")).toHaveCSS("background-color", "rgb(124, 108, 240)");
    await expect(answer).toHaveAccessibleDescription(/Colour swatch of #7c6cf0\..*On white: \d+\.\d\d:1\..*On black/u);
  });

  test("Enter copies the answer and announces it", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Only Chromium lets tests read the clipboard.");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    const dialog = await openPalette(page);
    await dialog.getByRole("combobox").fill("1024/16");
    await expect(dialog.getByRole("option", { name: "Answer: 64. Press Enter to copy." })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("status")).toHaveText("Copied 64");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("64");
    // Copying keeps the palette open, so the announcement is heard.
    await expect(dialog).toBeVisible();
  });

  test("opens the cron tool with the expression prefilled", async ({ page }) => {
    await page.goto("/");
    const dialog = await openPalette(page);
    await dialog.getByRole("combobox").fill("*/15 9-17 * * 1-5");
    await expect(dialog.locator("#palette-answer")).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(dialog.getByRole("option", { name: "Open in Cron expression explainer" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/tools\/cron\/#s=/u);
    expect(decodeShareState(new URL(page.url()).hash)).toEqual({ expression: "*/15 9-17 * * 1-5" });
    await expect(page.getByLabel("Cron expression", { exact: true })).toHaveValue("*/15 9-17 * * 1-5");
  });

  test("opens the specificity calculator prefilled, with ⌘/Ctrl+Enter, even from that tool", async ({ page }) => {
    await page.goto("/tools/specificity/");
    const dialog = await openPalette(page);
    await dialog.getByRole("combobox").fill(".nav > a:hover");
    await expect(dialog.locator("#palette-answer")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page).toHaveURL(/\/tools\/specificity\/#s=/u);
    await expect(page.locator("#spec-input")).toHaveValue(".nav > a:hover");
  });

  test("opens the contrast checker with a colour prefilled", async ({ page }) => {
    await page.goto("/");
    const dialog = await openPalette(page);
    await dialog.getByRole("combobox").fill("#7c6cf0");
    await dialog.getByRole("option", { name: "Open in Contrast checker" }).click();
    await expect(page).toHaveURL(/\/tools\/contrast\/#s=/u);
    await expect(page.locator("#contrast-foreground")).toHaveValue("#7c6cf0");
    await expect(page.locator("#contrast-background")).toHaveValue("#000000");
  });

  test("plain words get no answer, and don't load the answer code", async ({ page }) => {
    const answerCode: string[] = [];
    page.on("request", (request) => {
      if (/\/palette-answer\.[\w-]+\.js$/u.test(request.url())) answerCode.push(request.url());
    });
    await page.goto("/");
    const dialog = await openPalette(page);
    for (const word of ["hire", "contrast", "cron", "dark mode", "createContext"]) {
      await dialog.getByRole("combobox").fill(word);
      await expect(dialog.getByRole("status")).toHaveText(/^\d+ results?$/u);
      await expect(dialog.locator("#palette-answer")).toHaveCount(0);
    }
    expect(answerCode).toEqual([]);
    // Near misses load the answer code but still get no answer.
    for (const query of ["uuid generator", "node.js", "#react"]) {
      await dialog.getByRole("combobox").fill(query);
      await expect(dialog.getByRole("status")).toHaveText(/^\d+ results?$/u);
      await expect(dialog.locator("#palette-answer")).toHaveCount(0);
    }
    await dialog.getByRole("combobox").fill("hire");
    await expect(dialog.getByRole("option", { selected: true })).toHaveText(/Hire/u);
  });
});
