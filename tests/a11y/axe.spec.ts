import AxeBuilder from "@axe-core/playwright";

import { expect, pages, test } from "../e2e/fixtures";

const themes = ["light", "dark"] as const;

test.describe("WCAG 2.2 AA", () => {
  for (const theme of themes) {
    for (const path of [...pages, "/404/"]) {
      test(`${path} (${theme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        // Expressive Code makes overflowing code blocks focusable once the browser is idle.
        await page.waitForFunction(() =>
          [...document.querySelectorAll(".expressive-code pre")].every(
            (pre) => pre.scrollWidth <= pre.clientWidth || pre.hasAttribute("aria-label"),
          ),
        );
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
          .analyze();
        expect(
          results.violations.map(({ id, impact, nodes }) => ({
            id,
            impact,
            targets: nodes.map((node) => node.target),
          })),
        ).toEqual([]);
      });
    }
  }
});

test.describe("interactive states", () => {
  test("the command palette is accessible when open and filtered", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open command palette" }).first().click();
    let results = await new AxeBuilder({ page }).include("#palette").analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole("combobox").fill("react");
    results = await new AxeBuilder({ page }).include("#palette").analyze();
    expect(results.violations).toEqual([]);
  });

  for (const theme of themes) {
    test(`the quote toolbar and heading links are accessible when shown (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/how-to-fetch-data-from-backend-react/");
      await page.keyboard.press("Shift");
      await page.evaluate(() => {
        const paragraph = document.querySelector(".prose > p")!;
        const range = document.createRange();
        range.selectNodeContents(paragraph.firstChild!);
        document.getSelection()!.addRange(range);
      });
      const toolbar = page.getByRole("toolbar", { name: "Share this quote" });
      await expect(toolbar).toBeVisible();
      await page.keyboard.press("Alt+KeyQ");
      await expect(toolbar.getByRole("button").first()).toBeFocused();
      let results = await new AxeBuilder({ page })
        .include("[data-quote-toolbar]")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      expect(results.violations).toEqual([]);

      await page.keyboard.press("Escape");
      await page.getByRole("link", { name: "Link to section: Tutorial" }).focus();
      results = await new AxeBuilder({ page })
        .include("#tutorial")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("focus is always visible", async ({ page }) => {
    await page.goto("/why-functional-state-updates-are-important/");
    for (let index = 0; index < 15; index += 1) {
      await page.keyboard.press("Tab");
      const outline = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return "none";
        const style = getComputedStyle(element);
        return style.outlineStyle === "none" && style.boxShadow === "none"
          ? `none on ${element.outerHTML.slice(0, 80)}`
          : "ok";
      });
      expect(outline).toBe("ok");
    }
  });

  test("respects reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    for (const selector of [".reveal", ".hero__actions"]) {
      const duration = await page
        .locator(selector)
        .first()
        .evaluate((node) => getComputedStyle(node).animationDuration);
      expect(Number.parseFloat(duration), selector).toBeLessThan(0.001);
    }
  });
});
