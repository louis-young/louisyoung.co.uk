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

  test("⌘K opens the command palette, which filters and navigates", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole("combobox");
    await expect(input).toBeFocused();
    await input.fill("hire");
    await expect(dialog.getByRole("option", { selected: true })).toHaveText(/Hire/u);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/hire/");
  });

  test("the palette opens from the header, wraps with arrows and closes with Escape", async ({ page }) => {
    await page.goto("/writing/");
    await page.getByRole("button", { name: "Open command palette" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("ArrowUp");
    await expect(dialog.getByRole("option").last()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the palette falls back to full-text search", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("?");
    await page.getByRole("combobox").fill("createContext");
    await expect(page.getByText("Nothing matches")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/search/?q=createContext");
  });

  test("t cycles the theme and g toggles the layout grid", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.keyboard.press("t");
    await expect(page.locator("[data-theme-toggle]")).toHaveAttribute("aria-label", "Colour theme: Light");
    await page.keyboard.press("g");
    await expect(page.locator(".grid-overlay")).toBeVisible();
    await page.keyboard.press("g");
    await expect(page.locator(".grid-overlay")).toBeHidden();
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
