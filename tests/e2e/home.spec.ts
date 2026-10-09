import { readdirSync } from "node:fs";

import { articleSlugs, expect, snippetSlugs, test } from "./fixtures";

const toolSlugs = readdirSync(new URL("../../src/pages/tools/", import.meta.url))
  .filter((name) => name !== "index.astro")
  .map((name) => name.replace(/\.astro$/u, ""));

test.describe("home page", () => {
  test("the stats strip counts the real articles, tools and snippets", async ({ page }) => {
    await page.goto("/");
    const stats = page.locator(".stats");
    const value = (label: RegExp) =>
      stats.locator(".stats__item").filter({ hasText: label }).locator(".stats__value .visually-hidden");
    await expect(value(/Articles published/u)).toHaveText(String(articleSlugs.length));
    await expect(value(/Browser tools/u)).toHaveText(String(toolSlugs.length));
    await expect(value(/Code snippets/u)).toHaveText(String(snippetSlugs.length));
  });

  test("shows the latest article, snippet, tool and change, newest first", async ({ page }) => {
    // A shallow clone can leave the build with no changes to show; then the feed skips that item.
    await page.goto("/changelog/");
    const hasChanges = (await page.locator(".change").count()) > 0;
    await page.goto("/");
    const section = page.getByRole("region", { name: "Latest across the site" });
    const items = section.getByRole("listitem");
    await expect(items).toHaveCount(hasChanges ? 4 : 3);
    expect(await items.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-kind")).sort())).toEqual(
      hasChanges ? ["article", "change", "snippet", "tool"] : ["article", "snippet", "tool"],
    );
    const dates = await section
      .locator("time")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("datetime") ?? ""));
    expect(dates.every((date) => /^\d{4}-\d{2}-\d{2}$/u.test(date))).toBe(true);
    expect(dates).toEqual([...dates].sort().reverse());

    const href = (kind: string) => section.locator(`[data-kind="${kind}"] a`).getAttribute("href");
    expect(articleSlugs.map((slug) => `/${slug}/`)).toContain(await href("article"));
    expect(snippetSlugs.map((slug) => `/snippets/${slug}/`)).toContain(await href("snippet"));
    expect(toolSlugs.map((slug) => `/tools/${slug}/`)).toContain(await href("tool"));
    if (hasChanges) expect(await href("change")).toBe("/changelog/");
    await expect(section.getByRole("link", { name: /Full changelog/u })).toHaveAttribute("href", "/changelog/");
  });

  test("the latest article is the newest one on the writing page", async ({ page }) => {
    await page.goto("/writing/");
    const newest = await page.locator(".article-row a").first().getAttribute("href");
    await page.goto("/");
    const link = page.locator('.latest [data-kind="article"] a');
    await expect(link).toHaveAttribute("href", newest!);
    await link.click();
    await expect(page).toHaveURL(newest!);
  });

  test("the toolbox teaser counts tools and snippets and links to both", async ({ page }) => {
    await page.goto("/");
    const section = page.getByRole("region", { name: "Tools and snippets for everyday front-end work" });
    await expect(section).toContainText(`${toolSlugs.length} tools`);
    await expect(section).toContainText(`${snippetSlugs.length} snippets`);
    const tiles = section.getByRole("list", { name: "Featured tools" }).getByRole("link");
    expect(await tiles.count()).toBeGreaterThanOrEqual(4);
    expect(await tiles.count()).toBeLessThanOrEqual(6);
    for (const href of await tiles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")))) {
      expect(toolSlugs.map((slug) => `/tools/${slug}/`)).toContain(href);
    }
    await expect(section.getByRole("link", { name: /Browse all tools/u })).toHaveAttribute("href", "/tools/");
    await expect(section.getByRole("link", { name: "All snippets" })).toHaveAttribute("href", "/snippets/");
    await tiles.first().click();
    await expect(page).toHaveURL(/\/tools\/[a-z-]+\/$/u);
  });

  test("no placeholder text, and no horizontal scroll at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    for (const selector of [".latest", ".teaser", ".stats"]) {
      await expect(page.locator(selector)).not.toContainText(/\[[A-Z][^\]]*\]/u);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
