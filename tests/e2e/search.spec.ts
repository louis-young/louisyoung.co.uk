import { expect, test } from "./fixtures";

test.describe("search", () => {
  test("finds articles by their content", async ({ page }) => {
    await page.goto("/search/");
    const input = page.locator(".pagefind-ui__search-input");
    await input.fill("createContext");
    const results = page.locator(".pagefind-ui__result-title");
    await expect(results.first()).toBeVisible();
    await expect(results.filter({ hasText: "Context API" })).not.toHaveCount(0);
  });

  test("supports ?q= deep links", async ({ page }) => {
    await page.goto("/search/?q=fetch");
    await expect(page.locator(".pagefind-ui__result-title").filter({ hasText: "fetch data" })).toBeVisible();
  });

  test("shows an empty state for nonsense", async ({ page }) => {
    await page.goto("/search/");
    await page.locator(".pagefind-ui__search-input").fill("zzqxjv");
    await expect(page.locator(".pagefind-ui__message")).toContainText(/No results/iu);
  });
});
