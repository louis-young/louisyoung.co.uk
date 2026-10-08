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

  test("sitemap, robots, security.txt and manifest exist", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap-0.xml")).text();
    expect(sitemap).toContain("https://louisyoung.co.uk/why-functional-state-updates-are-important/");
    expect(sitemap).not.toContain("/404");
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
