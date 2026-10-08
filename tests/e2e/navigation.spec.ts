import { articleSlugs, expect, test } from "./fixtures";

test.describe("navigation", () => {
  test("home lists every article, newest first", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("React");
    const links = page.locator(".featured__title a, .article-row__link");
    await expect(links).toHaveCount(articleSlugs.length);
    const dates = await page
      .locator("main time")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("datetime") ?? ""));
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test("the featured article opens", async ({ page }) => {
    await page.goto("/");
    const title = await page.locator(".featured__title a").innerText();
    await page.locator(".featured__title a").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });

  test("an archive row is clickable anywhere, not just on the title", async ({ page }) => {
    await page.goto("/");
    const row = page.locator(".article-row").first();
    const href = await row.locator("a").getAttribute("href");
    // The title link stretches over the row, so click where the description is drawn.
    await row.scrollIntoViewIfNeeded();
    const box = (await row.locator(".article-row__description").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(href!);
  });

  test("primary navigation marks the current page", async ({ page }) => {
    await page.goto("/tags/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Topics" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Writing" }).click();
    await expect(page).toHaveURL("/");
  });

  test("topics link to filtered lists", async ({ page }) => {
    await page.goto("/tags/");
    await page.getByRole("link", { name: /react/u }).first().click();
    await expect(page).toHaveURL("/tags/react/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Writing tagged “react”");
    expect(await page.locator(".article-row").count()).toBeGreaterThan(1);
  });

  test("articles link to their neighbours and related reading", async ({ page }) => {
    await page.goto("/why-functional-state-updates-are-important/");
    const pager = page.getByRole("navigation", { name: /Previous/u });
    await expect(pager.locator("a[rel=prev]")).toBeVisible();
    await expect(pager.locator("a[rel=next]")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keep reading" })).toBeVisible();
  });

  test("unknown URLs get a helpful 404", async ({ page, consoleErrors }) => {
    const response = await page.goto("/this-page-does-not-exist/");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
    await expect(page.locator(".article-row")).toHaveCount(3);
    consoleErrors.length = 0; // The browser logs the 404 response itself.
  });
});

test.describe("legacy URLs", () => {
  for (const slug of articleSlugs) {
    test(`/${slug}/ still resolves`, async ({ page }) => {
      const response = await page.goto(`/${slug}/`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", `https://louisyoung.co.uk/${slug}/`);
    });
  }
});
