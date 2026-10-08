import { expect, test } from "@playwright/test";

/** Production smoke tests: availability, content, feeds and security headers. */
test("home page is up and lists articles", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).protocol).toBe("https:");
  await expect(page.locator(".article-row").first()).toBeVisible();
});

test("a random article renders", async ({ page, request }) => {
  const feed = (await (await request.get("/feed.json")).json()) as { items: { url: string; title: string }[] };
  const article = feed.items[Math.floor(Math.random() * feed.items.length)]!;
  await page.goto(new URL(article.url).pathname);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(article.title);
});

test("search returns results", async ({ page }) => {
  await page.goto("/search/?q=react");
  await expect(page.locator(".pagefind-ui__result-title").first()).toBeVisible({ timeout: 15_000 });
});

test("security headers are set", async ({ request }) => {
  const headers = (await request.get("/")).headers();
  expect(headers["strict-transport-security"]).toContain("max-age=63072000");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
});

test("feeds are served", async ({ request }) => {
  for (const path of ["/rss.xml", "/atom.xml", "/feed.json", "/sitemap-index.xml"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});
