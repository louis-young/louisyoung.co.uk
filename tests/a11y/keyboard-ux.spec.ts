import type { Page } from "@playwright/test";

import { expect, pages, test, workSlugs } from "../e2e/fixtures";

/**
 * Regression tests for the accessibility audit (docs/accessibility-audit.md): the checks axe
 * can't make on its own. Each one loads a page once and inspects it in a single evaluate.
 */

test.describe("page structure", () => {
  for (const path of [...pages, "/404/"]) {
    test(`${path} has one h1, no skipped heading levels and the core landmarks`, async ({ page }) => {
      await page.goto(path);
      // The accessibility tree, as assistive tech gets it: closed dialogs and hidden content are left out.
      const snapshot = await page.locator("body").ariaSnapshot();
      const levels = [...snapshot.matchAll(/- heading .*\[level=(\d)\]/gu)].map((match) => Number(match[1]));
      expect(
        levels.filter((level) => level === 1),
        "exactly one h1",
      ).toHaveLength(1);
      expect(levels[0], "the h1 comes first").toBe(1);
      const skips = levels.flatMap((level, index) =>
        index > 0 && level > levels[index - 1]! + 1 ? [`h${levels[index - 1]} → h${level}`] : [],
      );
      expect(skips, "skipped heading levels").toEqual([]);
      for (const landmark of ["banner", "main", "contentinfo"]) {
        expect(snapshot.match(new RegExp(`^\\s*- ${landmark}\\b`, "gmu")), landmark).toHaveLength(1);
      }
    });
  }
});

/** Whether the focused element, or the wrapper that draws its ring, has a visible outline. */
const focusIndicator = (page: Page) =>
  page.evaluate(() => {
    const focused = document.activeElement;
    if (!focused || focused === document.body) return "body";
    // Rows, cards and search pills draw their child's focus ring with :has(), so look a few levels up.
    for (let element: Element | null = focused, depth = 0; element && depth < 4; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 1) return "ok";
      depth += 1;
    }
    return `no focus indicator on ${focused.outerHTML.slice(0, 100)}`;
  });

test.describe("forced colours", () => {
  const keyPages = [
    "/",
    "/writing/",
    "/hire/",
    "/why-functional-state-updates-are-important/",
    "/tools/easing/",
    "/tools/regex/",
    "/404/",
  ];
  for (const path of keyPages) {
    test(`${path} keeps a visible focus indicator on every tab stop`, async ({ page }) => {
      // Forced colours drop box-shadows and backgrounds, so only an outline survives as a focus ring.
      await page.emulateMedia({ forcedColors: "active", colorScheme: "dark" });
      await page.goto(path);
      for (let stop = 0; stop < 40; stop += 1) {
        await page.keyboard.press("Tab");
        if ((await focusIndicator(page)) === "body") break;
        await expect.poll(() => focusIndicator(page)).toBe("ok");
      }
    });
  }
});

test.describe("target size (WCAG 2.5.8)", () => {
  const keyPages = [
    "/",
    "/writing/",
    "/hire/",
    "/cv/",
    "/tags/react/",
    "/stats/",
    "/changelog/",
    "/tools/regex/",
    "/tools/json/",
    "/why-functional-state-updates-are-important/",
    `/work/${workSlugs[0] ?? ""}/`,
    "/accessibility/",
    "/404/",
  ];
  for (const width of [1280, 360]) {
    for (const path of keyPages) {
      test(`${path} at ${width}px: targets are 24×24 or spaced apart`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const failures = await page.evaluate(() => {
          const minimum = 24;
          const shown = (element: Element) => {
            if (element.closest("dialog:not([open]), [hidden], .visually-hidden, [inert]")) return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
          };
          // Links in a sentence are exempt (the "inline" exception).
          const inline = (element: Element) => {
            if (element.tagName !== "A" || getComputedStyle(element).display !== "inline") return false;
            const block = element.parentElement?.closest("p, li, dd, td, th, figcaption, blockquote, h2, h3, h4");
            return Boolean(block && block.textContent.trim() !== element.textContent.trim());
          };
          // A checkbox or radio's label is part of its target.
          const box = (element: Element) => {
            let { left, top, right, bottom } = element.getBoundingClientRect();
            const labels = element instanceof HTMLInputElement ? [...(element.labels ?? [])] : [];
            for (const label of labels.filter(shown)) {
              const rect = label.getBoundingClientRect();
              left = Math.min(left, rect.left);
              top = Math.min(top, rect.top);
              right = Math.max(right, rect.right);
              bottom = Math.max(bottom, rect.bottom);
            }
            return { left, top, right, bottom };
          };
          const targets = [
            ...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, summary"),
          ]
            .filter((element) => shown(element) && !(element as HTMLButtonElement).disabled)
            .map((element) => ({ element, rect: box(element), inline: inline(element) }));
          const small = (rect: { left: number; top: number; right: number; bottom: number }) =>
            rect.right - rect.left < minimum - 0.5 || rect.bottom - rect.top < minimum - 0.5;
          // The spacing exception: a 24px circle centred on an undersized target must not touch
          // another target, or another undersized target's circle.
          return targets.flatMap((target) => {
            if (target.inline || !small(target.rect)) return [];
            const x = (target.rect.left + target.rect.right) / 2;
            const y = (target.rect.top + target.rect.bottom) / 2;
            const clash = targets.find(({ element, rect, inline: other }) => {
              if (element === target.element || element.contains(target.element) || target.element.contains(element))
                return false;
              const dx = Math.max(rect.left - x, 0, x - rect.right);
              const dy = Math.max(rect.top - y, 0, y - rect.bottom);
              if (Math.hypot(dx, dy) < minimum / 2) return true;
              return (
                !other &&
                small(rect) &&
                Math.hypot((rect.left + rect.right) / 2 - x, (rect.top + rect.bottom) / 2 - y) < minimum
              );
            });
            return clash
              ? [`${target.element.outerHTML.slice(0, 80)} is crowded by ${clash.element.outerHTML.slice(0, 60)}`]
              : [];
          });
        });
        expect(failures).toEqual([]);
      });
    }
  }
});

test.describe("dialogs", () => {
  /** Tabs round a modal dialog and checks focus never lands outside it or on something invisible. */
  const expectTrapped = async (page: Page, id: string) => {
    for (let stop = 0; stop < 6; stop += 1) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate((dialogId) => {
        const focused = document.activeElement;
        // Leaving for the browser's own toolbar (focus on body) is how native modal dialogs cycle.
        if (!focused || focused === document.body) return "ok";
        if (focused.closest("dialog")?.id !== dialogId) return `escaped to ${focused.outerHTML.slice(0, 80)}`;
        const rect = focused.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1 ? "ok" : `focused hidden ${focused.outerHTML.slice(0, 80)}`;
      }, id);
      expect(where).toBe("ok");
    }
  };

  const cases = [
    { name: "Command palette", id: "palette", opener: "header [data-palette-open]" },
    { name: "Terminal", id: "terminal", opener: "footer [data-terminal-open]" },
    { name: "Keyboard shortcuts", id: "shortcuts-help", opener: "footer [data-shortcuts-open]" },
  ];
  for (const { name, id, opener } of cases) {
    test(`the ${name.toLowerCase()} traps focus and returns it to its opener`, async ({ page }) => {
      await page.goto("/");
      const button = page.locator(opener);
      await button.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name });
      await expect(dialog).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.activeElement?.closest("dialog")?.id)).toBe(id);
      await expectTrapped(page, id);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(button).toBeFocused();
    });
  }

  test("a dialog opened from the palette hands focus back to the palette's opener", async ({ page }) => {
    await page.goto("/");
    const button = page.locator("header [data-palette-open]");
    await button.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("combobox").fill("terminal");
    await page.keyboard.press("Enter");
    const terminal = page.getByRole("dialog", { name: "Terminal" });
    await expect(terminal.getByRole("textbox", { name: "Command" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(terminal).toBeHidden();
    await expect(button).toBeFocused();
  });
});
