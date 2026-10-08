import { expect, pages, test } from "./fixtures";

test.describe("metadata", () => {
  for (const path of pages) {
    test(`${path} has complete metadata`, async ({ page, request }) => {
      await page.goto(path);
      expect(await page.title()).toMatch(/Louis Young/u);
      await expect(page.locator("html")).toHaveAttribute("lang", "en-GB");
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(description?.length).toBeGreaterThan(40);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://louisyoung.co.uk${path}`);
      await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);

      const image = await page.locator('meta[property="og:image"]').getAttribute("content");
      const response = await request.get(new URL(image!).pathname);
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-type"]).toBe("image/png");

      for (const script of await page.locator('script[type="application/ld+json"]').allTextContents()) {
        expect(() => JSON.parse(script) as unknown).not.toThrow();
      }
    });
  }
});

test.describe("machine-readable endpoints", () => {
  test("feeds list every article", async ({ request }) => {
    const rss = await (await request.get("/rss.xml")).text();
    const atom = await (await request.get("/atom.xml")).text();
    const json = (await (await request.get("/feed.json")).json()) as { items: unknown[] };
    const count = (rss.match(/<item>/gu) ?? []).length;
    expect(count).toBe(8);
    expect((atom.match(/<entry>/gu) ?? []).length).toBe(count);
    expect(json.items).toHaveLength(count);
  });

  test("the changelog has an Atom feed of user-facing changes", async ({ request }) => {
    const response = await request.get("/changelog.xml");
    expect(response.ok()).toBe(true);
    const atom = await response.text();
    expect(atom).toContain('<feed xmlns="http://www.w3.org/2005/Atom"');
    expect(atom).toContain('<link href="https://louisyoung.co.uk/changelog.xml" rel="self"/>');
    expect(atom).not.toMatch(/<title>(?:chore|test|ci|build|docs|style)\b/u);
  });

  test("every page in the sitemap has a unique title and description", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap-0.xml")).text();
    const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => new URL(match[1]!).pathname);
    expect(paths.length).toBeGreaterThan(30);
    const titles = new Map<string, string>();
    const descriptions = new Map<string, string>();
    for (const path of paths) {
      const html = await (await request.get(path)).text();
      const title = /<title>([^<]+)<\/title>/u.exec(html)?.[1];
      const description = /<meta name="description" content="([^"]+)"/u.exec(html)?.[1];
      expect(title, `${path} has a title`).toBeTruthy();
      expect(description, `${path} has a description`).toBeTruthy();
      expect(titles.get(title!), `${path} repeats the title "${title!}"`).toBeUndefined();
      expect(descriptions.get(description!), `${path} repeats its description`).toBeUndefined();
      titles.set(title!, path);
      descriptions.set(description!, path);
    }
  });

  test("tool pages describe themselves as free web applications", async ({ page }) => {
    await page.goto("/tools/json/");
    const [app, breadcrumb] = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "[]",
    ) as Record<string, unknown>[];
    expect(app).toMatchObject({
      "@type": "WebApplication",
      applicationCategory: "DeveloperApplication",
      isAccessibleForFree: true,
      offers: { price: "0" },
    });
    expect(breadcrumb).toMatchObject({ "@type": "BreadcrumbList" });
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://louisyoung.co.uk/og/tools-json.png",
    );
    await page.goto("/tools/");
    expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('"@type":"ItemList"');
  });

  test("sitemap, robots, security.txt and manifest exist", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap-0.xml")).text();
    expect(sitemap).toContain("https://louisyoung.co.uk/why-functional-state-updates-are-important/");
    expect(sitemap).not.toContain("/404");
    for (const path of ["/changelog/", "/tools/json/", "/tags/react/"]) {
      expect(sitemap).toContain(`<loc>https://louisyoung.co.uk${path}</loc>`);
    }
    expect(sitemap).not.toContain("/design/");
    expect(sitemap).toMatch(/<lastmod>2026-10-07T00:00:00\.000Z<\/lastmod>/u);
    expect(await (await request.get("/robots.txt")).text()).toContain(
      "Sitemap: https://louisyoung.co.uk/sitemap-index.xml",
    );
    const security = await (await request.get("/.well-known/security.txt")).text();
    expect(security).toMatch(/^Contact: mailto:/mu);
    const expires = new Date(/^Expires: (.+)$/mu.exec(security)![1]!);
    expect(expires.getTime()).toBeGreaterThan(Date.now());
    const manifest = (await (await request.get("/manifest.webmanifest")).json()) as { icons: { src: string }[] };
    for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  });
});
