import { expect, snippetSlugs, test } from "./fixtures";

test.describe("snippets", () => {
  test("the index lists every snippet in the HTML, before any script runs", async ({ request }) => {
    const html = await (await request.get("/snippets/")).text();
    for (const slug of snippetSlugs) expect(html).toContain(`href="/snippets/${slug}/"`);
  });

  test("filters by text, language and tag, announces the count and keeps the URL in step", async ({ page }) => {
    await page.goto("/snippets/");
    const cards = page.locator("[data-snippet]:visible");
    const status = page.getByRole("status").filter({ hasText: /snippet/u });
    await expect(cards).toHaveCount(snippetSlugs.length);

    await page.getByRole("searchbox", { name: "Search snippets" }).fill("abort");
    await expect(status).toHaveText(/^\d+ snippets? match/u);
    const matches = await cards.count();
    expect(matches).toBeGreaterThan(0);
    expect(matches).toBeLessThan(snippetSlugs.length);
    await expect(page).toHaveURL(/\?q=abort$/u);

    await page.getByRole("searchbox", { name: "Search snippets" }).fill("");
    await page.getByRole("group", { name: "Language" }).getByRole("radio", { name: /CSS/u }).check();
    await page
      .getByRole("group", { name: "Tag" })
      .getByRole("radio", { name: /accessibility/u })
      .check();
    await expect(page).toHaveURL(/language=css&tag=accessibility/u);
    for (const chip of await cards.locator(".snippet-card__language").allTextContents()) expect(chip).toContain("CSS");

    await page.getByRole("searchbox", { name: "Search snippets" }).fill("zzzz nothing matches");
    await expect(status).toHaveText("No snippets match.");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(cards).toHaveCount(snippetSlugs.length);
    await expect(page).toHaveURL("/snippets/");
  });

  test("a filtered URL can be shared", async ({ page }) => {
    await page.goto("/snippets/?language=bash");
    await expect(page.locator("[data-snippet]:visible")).toHaveCount(1);
    await expect(page.getByRole("radio", { name: /Shell/u })).toBeChecked();
  });

  test("a snippet page has breadcrumbs, copyable code, JSON-LD and related snippets", async ({ page }) => {
    await page.goto("/snippets/use-event-listener/");
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Snippets" })).toHaveAttribute("href", "/snippets/");
    await expect(page.locator(".expressive-code").first().getByRole("button", { name: /copy/iu })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2, name: "Related snippets" })).toBeVisible();
    const [code, breadcrumb] = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "[]",
    ) as Record<string, unknown>[];
    expect(code).toMatchObject({ "@type": "SoftwareSourceCode", programmingLanguage: "TypeScript" });
    expect(breadcrumb).toMatchObject({ "@type": "BreadcrumbList" });
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://louisyoung.co.uk/og/snippets-use-event-listener.png",
    );
  });

  test("snippets have their own feed and are in the sitemap", async ({ request }) => {
    const rss = await (await request.get("/snippets/rss.xml")).text();
    expect((rss.match(/<item>/gu) ?? []).length).toBe(snippetSlugs.length);
    const sitemap = await (await request.get("/sitemap-0.xml")).text();
    for (const slug of snippetSlugs) expect(sitemap).toContain(`<loc>https://louisyoung.co.uk/snippets/${slug}/</loc>`);
  });

  test("the command palette finds snippets", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open command palette" }).first().click();
    await page.getByRole("combobox").fill("useEventListener");
    await expect(page.getByRole("option", { name: "A typed useEventListener hook" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/snippets/use-event-listener/");
  });
});
