import { gzipSync } from "node:zlib";

import { expect, test } from "./fixtures";

/** Gzipped JavaScript a page loads before any island hydrates. */
const budgets = { "/": 4_000, "/how-to-fetch-data-from-backend-react/": 8_000, "/tags/": 4_000 };

test.describe("JavaScript budget", () => {
  for (const [path, budget] of Object.entries(budgets)) {
    test(`${path} stays under ${budget / 1000} kB of JavaScript`, async ({ page, request, browserName }) => {
      test.skip(browserName !== "chromium", "Byte counts are browser-independent; measure once.");
      await page.goto(path);
      const inline = await page
        .locator("script:not([src]):not([type='application/ld+json'])")
        .evaluateAll((scripts) => scripts.map((script) => script.textContent).join(""));
      const external = await page
        .locator("script[src]")
        .evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).src));
      let bytes = gzipSync(inline).length;
      for (const src of external) bytes += gzipSync(await (await request.get(src)).body()).length;
      expect(bytes).toBeLessThan(budget);
    });
  }
});
