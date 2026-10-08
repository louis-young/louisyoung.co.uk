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

  test("the home page's shortcut card lights the caps of the key just pressed", async ({ page }) => {
    await page.goto("/");
    // Caps stay lit for a moment only, so check in the same task as the keypress.
    const lit = await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "K", bubbles: true }));
      return [...document.querySelectorAll<HTMLElement>("kbd[data-lit]")].map((cap) => cap.dataset["key"]);
    });
    expect(lit).toEqual(["k", "k"]);
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
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("combobox").fill("createContext");
    await expect(page.getByText("Nothing matches")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/search/?q=createContext");
  });

  test("t cycles the theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.keyboard.press("t");
    await expect(page.locator("[data-theme-toggle]")).toHaveAttribute("aria-label", "Colour theme: Light");
  });

  test("j and k step through the writing list", async ({ page }) => {
    await page.goto("/writing/");
    const links = page.locator(".article-row__link");
    await page.keyboard.press("j");
    await expect(links.first()).toBeFocused();
    await page.keyboard.press("j");
    await expect(links.nth(1)).toBeFocused();
    await page.keyboard.press("k");
    await expect(links.first()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/[a-z-]+\/$/u);
  });

  test("shortcuts don't fire while typing", async ({ page }) => {
    await page.goto("/search/");
    const input = page.getByRole("searchbox").or(page.locator(".pagefind-ui__search-input"));
    await input.first().fill("");
    await input.first().press("t");
    await expect(input.first()).toHaveValue("t");
    await expect(page.locator("[data-theme-toggle]")).toHaveAttribute("aria-label", "Colour theme: System");
  });

  test("the terminal opens with ` and runs commands", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("`");
    const terminal = page.getByRole("dialog", { name: "Terminal" });
    await expect(terminal).toBeVisible();
    const prompt = terminal.getByRole("textbox", { name: "Command" });
    await expect(prompt).toBeFocused();
    await prompt.fill("ls writing");
    await prompt.press("Enter");
    await expect(terminal.getByRole("log")).toContainText("1  ");
    await prompt.fill("open 1");
    await prompt.press("Enter");
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/[a-z0-9-]+\/$/u);
  });

  test("? opens the keyboard shortcuts, which close with Escape and hand focus back", async ({ page }) => {
    await page.goto("/writing/");
    const opener = page.locator(".site-nav__link").first();
    await opener.focus();
    await page.keyboard.press("?");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close keyboard shortcuts" })).toBeFocused();
    await expect(dialog.getByRole("term")).toContainText(["⌘K", "/", "?", "J", "K", "[", "]", "T", "`"]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("? types a question mark in a field instead of opening the shortcuts", async ({ page }) => {
    await page.goto("/hire/");
    const field = page.getByLabel("About the project");
    await field.fill("");
    await field.press("?");
    await expect(field).toHaveValue("?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeHidden();
  });

  test("the shortcuts open from the palette and from the footer", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("combobox").fill("keyboard");
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close keyboard shortcuts" }).click();
    await expect(dialog).toBeHidden();
    const footerButton = page.getByRole("contentinfo").getByRole("button", { name: "Keyboard shortcuts" });
    await footerButton.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(footerButton).toBeFocused();
  });
});
