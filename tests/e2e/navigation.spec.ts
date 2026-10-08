import { articleSlugs, expect, test, workSlugs } from "./fixtures";

test.describe("navigation", () => {
  test("home introduces Louis and links to every section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Louis\s*Young/iu);
    for (const name of ["Selected work", "Writing", "Work with me", "Curriculum vitae", "Now"]) {
      await expect(page.getByRole("heading", { level: 2, name: new RegExp(name, "iu") })).toBeVisible();
    }
    await expect(page.locator(".work-row")).toHaveCount(workSlugs.length);
  });

  test("the writing page lists every article, newest first", async ({ page }) => {
    await page.goto("/writing/");
    await expect(page.locator(".article-row__link")).toHaveCount(articleSlugs.length);
    const dates = await page
      .locator(".article-row time")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("datetime") ?? ""));
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test("a row is clickable anywhere, not just on the title", async ({ page }) => {
    await page.goto("/writing/");
    const row = page.locator(".article-row").first();
    const href = await row.locator("a").getAttribute("href");
    await row.scrollIntoViewIfNeeded();
    const box = (await row.locator(".article-row__description").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(href!);
  });

  test("case studies open from the work table and link onwards", async ({ page }) => {
    await page.goto("/work/");
    const first = page.locator(".work-row__link").first();
    const title = await first.innerText();
    await first.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await page.getByRole("navigation", { name: "Next case study" }).locator(".case__next").click();
    await expect(page).toHaveURL(/\/work\/[a-z-]+\/$/u);
  });

  test("primary navigation marks the current section", async ({ page }) => {
    await page.goto("/tags/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: /Writing/u })).toHaveAttribute("aria-current", "true");
    await nav.getByRole("link", { name: /Hire/u }).click();
    await expect(page).toHaveURL("/hire/");
    await expect(nav.getByRole("link", { name: /Hire/u })).toHaveAttribute("aria-current", "page");
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
