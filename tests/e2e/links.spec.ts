import { expect, pages, test } from "./fixtures";

test.describe("internal links", () => {
  test("every internal link and fragment on every page resolves", async ({ page, request }) => {
    test.slow();
    const checked = new Map<string, number>();
    for (const path of pages) {
      await page.goto(path);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((links) =>
          links.map((link) => (link as HTMLAnchorElement).href).filter((href) => href.startsWith(location.origin)),
        );
      for (const href of new Set(hrefs)) {
        const url = new URL(href);
        if (url.hash) {
          const target = decodeURIComponent(url.hash.slice(1));
          if (url.pathname === path && target !== "main") {
            await expect(page.locator(`[id="${target}"]`), `${path} → ${url.hash}`).toHaveCount(1);
          }
        }
        if (!checked.has(url.pathname)) checked.set(url.pathname, (await request.get(url.pathname)).status());
        expect(checked.get(url.pathname), `${path} → ${url.pathname}`).toBe(200);
      }
    }
  });
});
