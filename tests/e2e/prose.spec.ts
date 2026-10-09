import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

const article = "/how-to-fetch-data-from-backend-react/";
const title = "How to fetch data from a back-end in React";
const phrase = "store our data that we are about to fetch";

/** Selects `text` where it first appears in a text node inside `selector`. */
const selectText = (page: Page, selector: string, text: string) =>
  page.evaluate(
    ([selector, text]) => {
      const walker = document.createTreeWalker(document.querySelector(selector)!, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const index = (node as Text).data.indexOf(text);
        if (index === -1) continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      throw new Error(`"${text}" not found in ${selector}`);
    },
    [selector, text] as const,
  );

const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Share this quote" });

test.describe("heading links", () => {
  test("each section heading has a named link that lands clear of the sticky header", async ({ page }) => {
    await page.goto(article);
    const link = page.getByRole("link", { name: "Link to section: Tutorial" });
    await expect(link).toHaveAttribute("href", "#tutorial");
    await expect(link).toHaveText("");
    // The table of contents reads the heading's own text, not the link's glyph.
    await expect(page.locator('[data-toc-link="tutorial"]')).toHaveText("Tutorial");

    await page.goto(`${article}#state`);
    const header = await page.locator(".site-header").boundingBox();
    await expect
      .poll(async () => (await page.locator("#state").boundingBox())!.y)
      .toBeGreaterThan(header!.y + header!.height);
  });

  test("the link appears on hover or focus on wide screens", async ({ page, isMobile }) => {
    test.skip(isMobile, "On narrow screens the link is always shown after the heading.");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(article);
    const link = page.getByRole("link", { name: "Link to section: Tutorial" });
    const opacity = () => link.evaluate((node) => getComputedStyle(node).opacity);
    expect(await opacity()).toBe("0");
    await page.locator("#tutorial").hover();
    await expect.poll(opacity).toBe("1");
    await page.mouse.move(0, 0);
    await expect.poll(opacity).toBe("0");
    await link.focus();
    await expect.poll(opacity).toBe("1");
  });

  test("clicking a heading link copies its URL and announces “Link copied”", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Clipboard permissions are Chromium-only in Playwright.");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(article);
    await page.getByRole("link", { name: "Link to section: Tutorial" }).click();
    await expect(page).toHaveURL(/#tutorial$/u);
    await expect(page.locator("#tutorial")).toHaveAttribute("data-copied", "Copied");
    await expect(page.locator("[data-anchor-status]")).toHaveText("Link copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `https://louisyoung.co.uk${article}#tutorial`,
    );
  });
});

test.describe("external links", () => {
  test("say they lead off-site to assistive technology", async ({ page }) => {
    await page.goto(article);
    const link = page.locator(".prose a[data-external]").first();
    await expect(link).toHaveAccessibleName("Fetch API (opens external site)");
    await expect(link.locator(".visually-hidden")).toHaveCSS("position", "absolute");
  });
});

test.describe("share a quote", () => {
  test("the toolbar loads on the first selection in the prose", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));
    await page.goto(article);
    await page.waitForLoadState("load");
    await expect(toolbar(page)).toBeHidden();
    expect(requested.filter((url) => url.includes("quote-share"))).toEqual([]);
    await selectText(page, ".site-footer", "Louis");
    await selectText(page, ".article__lede", "fetching data");
    expect(requested.filter((url) => url.includes("quote-share"))).toEqual([]);

    await selectText(page, ".prose", phrase);
    await expect(toolbar(page)).toBeVisible();
    expect(requested.filter((url) => url.includes("quote-share"))).toHaveLength(1);
  });

  test("stays out of code blocks", async ({ page }) => {
    await page.goto(article);
    await selectText(page, ".prose", phrase);
    await expect(toolbar(page)).toBeVisible();
    await selectText(page, ".prose .expressive-code pre", "useState");
    await expect(toolbar(page)).toBeHidden();
  });

  test("copies a link that scrolls to the quote, and a Markdown quote", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Clipboard permissions are Chromium-only in Playwright.");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(article);
    await selectText(page, ".prose", phrase);
    await toolbar(page).getByRole("button", { name: "Copy quote" }).click();
    await expect(page.locator("[data-anchor-status]")).toHaveText("Quote copied");
    const quote = await page.evaluate(() => navigator.clipboard.readText());
    const [body, spacer, credit] = quote.split("\n");
    expect(body).toBe(`> ${phrase}`);
    expect(spacer).toBe(">");
    expect(credit).toMatch(
      new RegExp(`^> — Louis Young, \\[${title}\\]\\(https://louisyoung\\.co\\.uk${article}#:~:text=.+\\)$`, "u"),
    );
    // Clicking a button keeps the selection, so the reader can copy again.
    await expect.poll(() => page.evaluate(() => document.getSelection()!.toString())).toBe(phrase);

    await toolbar(page).getByRole("button", { name: "Copy link to quote" }).click();
    await expect(page.locator("[data-anchor-status]")).toHaveText("Link to quote copied");
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toBe(
      `https://louisyoung.co.uk${article}#:~:text=adding%20state%20to-,store%20our%20data%20that,are%20about%20to%20fetch,-.%20We%20are`,
    );
    expect(credit).toContain(link);

    const { pathname, hash } = new URL(link);
    await page.goto("about:blank");
    await page.goto(pathname + hash);
    const target = page.locator(".prose p", { hasText: phrase });
    await expect(target).toBeInViewport();
  });

  test("works from the keyboard: Alt+Q focuses the toolbar and Escape leaves it", async ({ page }) => {
    await page.goto(article);
    await page.keyboard.press("Shift");
    await selectText(page, ".prose", "store our data");
    await expect(toolbar(page)).toBeVisible();
    await expect(page.locator("[data-quote-hint]")).toHaveText(
      "Text selected. Press Alt+Q to copy a link to it or quote it.",
    );
    await page.keyboard.press("Alt+KeyQ");
    const linkButton = toolbar(page).getByRole("button", { name: "Copy link to quote" });
    const quoteButton = toolbar(page).getByRole("button", { name: "Copy quote" });
    await expect(linkButton).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(quoteButton).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toolbar(page)).toBeHidden();
    expect(await page.evaluate(() => document.getSelection()!.toString())).toBe("store our data");
  });

  test("never overflows a 320px screen", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Layout is browser-independent here; measure once.");
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(article);
    for (const text of ["Today", "back-end", phrase]) {
      await selectText(page, ".prose", text);
      await expect(toolbar(page)).toBeVisible();
      const box = (await toolbar(page).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    }
  });
});
