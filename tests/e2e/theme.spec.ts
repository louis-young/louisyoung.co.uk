import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

const theme = (page: Page) => page.locator("html").getAttribute("data-theme");

test.describe("colour theme", () => {
  test("follows the system preference by default", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    expect(await theme(page)).toBe("dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => theme(page)).toBe("light");
  });

  test("cycles system → light → dark and persists across navigation", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const toggle = page.locator("[data-theme-toggle]");
    await expect(toggle).toHaveAttribute("aria-label", "Colour theme: System");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", "Colour theme: Light");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", "Colour theme: Dark");
    expect(await theme(page)).toBe("dark");
    await page.goto("/tags/");
    expect(await theme(page)).toBe("dark");
    await page.locator("[data-theme-toggle]").click();
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
  });

  test("applies the stored theme before first paint (no flash)", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("theme", "dark");
    });
    await page.emulateMedia({ colorScheme: "light" });
    let themeAtFirstScript: string | null = null;
    await page.exposeFunction("reportTheme", (value: string | null) => {
      themeAtFirstScript ??= value;
    });
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { reportTheme: (v: string | null) => void }).reportTheme(
          document.documentElement.getAttribute("data-theme"),
        );
      });
    });
    await page.goto("/");
    await expect.poll(() => themeAtFirstScript).toBe("dark");
  });

  test("still works when storage is blocked", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      });
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    expect(await theme(page)).toBe("dark");
    await page.locator("[data-theme-toggle]").click();
    expect(await theme(page)).toBe("light");
  });
});
