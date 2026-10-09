import { articleSlugs, expect, test } from "./fixtures";

test.describe("reading aids", () => {
  test("the time-left pill appears while reading and counts down", async ({ page }) => {
    await page.goto("/how-to-fetch-data-from-backend-react/");
    const pill = page.locator("[data-time-left]");
    await expect(pill).toBeHidden();
    await page.locator("#tutorial").scrollIntoViewIfNeeded();
    await expect(pill).toBeVisible();
    const start = Number.parseInt(await pill.innerText(), 10);
    await page.locator("#react-query").scrollIntoViewIfNeeded();
    await expect.poll(async () => Number.parseInt(await pill.innerText(), 10)).toBeLessThan(start);
  });

  test("ends with an author card", async ({ page }) => {
    await page.goto("/utilising-context-api-react/");
    await expect(page.locator(".author")).toContainText("Louis Young");
    await expect(page.getByRole("list", { name: "Find me elsewhere" }).getByRole("link")).toHaveCount(3);
  });

  test("[ and ] move between articles", async ({ page }) => {
    await page.goto("/why-functional-state-updates-are-important/");
    const previous = await page.locator("a[rel=prev]").getAttribute("href");
    await page.keyboard.press("[");
    await expect(page).toHaveURL(previous!);
    // The shortcut listener is a module script, so it is ready once the document has loaded.
    await page.waitForLoadState("load");
    const next = await page.locator("a[rel=next]").getAttribute("href");
    await page.keyboard.press("]");
    await expect(page).toHaveURL(next!);
  });
});

test.describe("writing archive", () => {
  test("topic chips filter the list in place and j/k skip hidden rows", async ({ page }) => {
    await page.goto("/writing/");
    const filter = page.getByRole("navigation", { name: "Filter by topic" });
    await filter.getByRole("link", { name: /^hooks/u }).click();
    await expect(page).toHaveURL("/writing/?topic=hooks");
    await expect(page.locator(".article-row:visible")).toHaveCount(3);
    await expect(page.locator("[data-filter-status]")).toHaveText("3 articles tagged “hooks”");
    await page.keyboard.press("j");
    await expect(page.locator(".article-row:visible .article-row__link").first()).toBeFocused();
    await page.keyboard.press("j");
    await expect(page.locator(".article-row:visible .article-row__link").nth(1)).toBeFocused();
    await filter.getByRole("link", { name: /^All/u }).click();
    await expect(page.locator(".article-row:visible")).toHaveCount(articleSlugs.length);
  });
});

test.describe("writing archive without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the chips are links to topic pages", async ({ page }) => {
    await page.goto("/writing/");
    await page
      .getByRole("navigation", { name: "Filter by topic" })
      .getByRole("link", { name: /^hooks/u })
      .click();
    await expect(page).toHaveURL("/tags/hooks/");
  });
});
