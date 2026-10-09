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
    test(`the command palette's quick answers, loading and error states are accessible (${theme})`, async ({
      page,
      consoleErrors,
    }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const analyse = async () =>
        (
          await new AxeBuilder({ page })
            .include("#palette")
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
            .analyze()
        ).violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));

      // Hold the index back to see the loading state, then fail it to see the error state.
      let fail: () => void = () => undefined;
      await page.route("**/palette.json", async (route) => {
        await new Promise<void>((resolve) => {
          fail = resolve;
        });
        await route.abort("internetdisconnected");
      });
      await page.goto("/");
      await page.getByRole("button", { name: "Open command palette" }).first().click();
      await expect(page.locator("[data-palette-loading]")).toBeVisible();
      expect(await analyse()).toEqual([]);
      fail();
      await expect(page.locator("[data-palette-error]")).toBeVisible();
      expect(await analyse()).toEqual([]);
      consoleErrors.length = 0;

      await page.unroute("**/palette.json");
      await page.getByRole("button", { name: "Try again" }).click();
      for (const query of ["#7c6cf0", "0 9 * * 1-5", "2^10"]) {
        await page.getByRole("combobox").fill(query);
        await expect(page.locator("#palette-answer")).toBeVisible();
        expect(await analyse()).toEqual([]);
      }
    });

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

  for (const theme of themes) {
    test(`the content map is accessible while highlighting and filtered (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/map/");
      await expect(page.locator("[data-map]")).toHaveAttribute("data-ready", "");
      await page.locator('[data-id="topic:react"]').focus();
      await expect(page.locator("[data-inspector-title]")).toHaveText("react");
      const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
      let results = await new AxeBuilder({ page }).include("[data-map]").withTags(tags).analyze();
      expect(results.violations).toEqual([]);
      await page.getByRole("checkbox", { name: /Articles/u }).uncheck();
      await page.getByLabel("Focus a topic").selectOption("topic:css");
      results = await new AxeBuilder({ page }).include("[data-map]").withTags(tags).analyze();
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
