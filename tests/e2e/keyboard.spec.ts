import { expect, test } from "./fixtures";

test.describe("keyboard", () => {
  test("the first tab stop is a skip link to the main content", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "Safari does not tab to links by default.");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });

  test("? opens the shortcuts dialog and Escape closes it", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Shift+Slash");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("/ goes to search and t cycles the theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.keyboard.press("t");
    await expect(page.locator("[data-theme-toggle]")).toHaveAttribute("aria-label", "Colour theme: Light");
    await page.keyboard.press("/");
    await expect(page).toHaveURL("/search/");
  });

  test("shortcuts don't fire while typing", async ({ page }) => {
    await page.goto("/search/");
    const input = page.getByRole("searchbox").or(page.locator(".pagefind-ui__search-input"));
    await input.first().fill("");
    await input.first().press("t");
    await expect(input.first()).toHaveValue("t");
    await expect(page.locator("[data-theme-toggle]")).toHaveAttribute("aria-label", "Colour theme: System");
  });
});
