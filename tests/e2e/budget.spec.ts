import { readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";

import type { Page, Response } from "@playwright/test";

import { expect, test } from "./fixtures";

const toolSlugs = readdirSync(new URL("../../src/pages/tools/", import.meta.url))
  .filter((file) => file.endsWith(".astro") && file !== "index.astro")
  .map((file) => file.replace(/\.astro$/u, ""));

/**
 * Gzipped JavaScript each kind of page loads before any island hydrates: inline scripts, every
 * module it requests and every chunk those import, statically or on load. Budgets sit about 10%
 * over the sizes measured in docs/performance-audit.md; raise one only with a reason.
 */
const budgets: { name: string; budget: number; paths: string[] }[] = [
  { name: "home", budget: 4_900, paths: ["/"] },
  { name: "article", budget: 8_400, paths: ["/how-to-fetch-data-from-backend-react/"] },
  { name: "listing", budget: 5_200, paths: ["/writing/", "/tags/", "/snippets/"] },
  { name: "tools index", budget: 5_700, paths: ["/tools/"] },
  { name: "tool", budget: 11_400, paths: toolSlugs.map((slug) => `/tools/${slug}/`) },
  { name: "map", budget: 6_700, paths: ["/map/"] },
  { name: "snippet", budget: 7_900, paths: ["/snippets/debounce-and-throttle/"] },
  // The Pagefind UI is bundled into the page; its runtime and index load only once someone searches.
  { name: "search", budget: 34_000, paths: ["/search/"] },
];

/** Loads a page and sums the gzipped size of all the JavaScript it ran. */
const measure = async (page: Page, path: string) => {
  const scripts = new Set<string>();
  const record = (response: Response) => {
    if (response.request().resourceType() === "script") scripts.add(response.url());
  };
  page.on("response", record);
  await page.goto(path, { waitUntil: "networkidle" });
  page.off("response", record);
  const inline = await page
    .locator("script:not([src]):not([type='application/ld+json'])")
    .evaluateAll((elements) => elements.map((script) => script.textContent).join(""));
  let bytes = gzipSync(inline).length;
  for (const url of scripts) bytes += gzipSync(await (await page.request.get(url)).body()).length;
  return { bytes, scripts: [...scripts] };
};

test.describe("JavaScript budget", () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== "chromium" || isMobile,
    "Byte counts are browser-independent; measure once.",
  );

  test("every tool page is budgeted", () => {
    expect(toolSlugs.length).toBeGreaterThan(0);
  });

  // One test per page: each is a single load, so none outgrows the test timeout as pages are added.
  for (const { name, budget, paths } of budgets) {
    for (const path of paths) {
      test(`${path} (${name}) stays under ${budget / 1000} kB of JavaScript`, async ({ page }) => {
        const { bytes, scripts } = await measure(page, path);
        // Recorded in the report, for re-measuring when a budget needs to move.
        test.info().annotations.push({ type: "JavaScript (gzip bytes)", description: `${bytes}` });
        expect.soft(bytes, `${path} loads ${bytes} B of JavaScript`).toBeLessThan(budget);
        // Every script must be a content-hashed build asset, or the immutable cache rule would serve stale code.
        for (const url of scripts.filter((src) => new URL(src).origin === new URL(page.url()).origin)) {
          expect.soft(new URL(url).pathname, `${path} loads an unhashed script`).toMatch(/^\/_astro\//u);
        }
      });
    }
  }
});

/** Lighthouse CI only checks four pages; scripts that fill in a tool after load can shift it. */
test.describe("Layout stability", () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== "chromium" || isMobile,
    "Layout shifts are measured once, on desktop Chromium.",
  );

  for (const path of budgets.flatMap(({ paths }) => paths)) {
    test(`${path} shifts by less than 0.01 while it loads`, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      // Layout shifts are only exposed to a buffered observer, which delivers them in a later task.
      const { shift, sources } = await page.evaluate(
        () =>
          new Promise<{ shift: number; sources: string[] }>((resolve) => {
            let sum = 0;
            const moved: string[] = [];
            const describe = (node: Node | null) =>
              node instanceof Element
                ? `${node.localName}${node.className && typeof node.className === "string" ? `.${node.className.trim().split(/\s+/u).join(".")}` : ""}`
                : (node?.nodeName ?? "?");
            const rect = ({ x, y, width, height }: DOMRectReadOnly) =>
              `${Math.round(x)},${Math.round(y)} ${Math.round(width)}×${Math.round(height)}`;
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries() as (PerformanceEntry & {
                value: number;
                hadRecentInput: boolean;
                sources: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
              })[]) {
                if (entry.hadRecentInput) continue;
                sum += entry.value;
                for (const source of entry.sources) {
                  moved.push(
                    `${describe(source.node)} ${rect(source.previousRect)} → ${rect(source.currentRect)} at ${Math.round(entry.startTime)}ms`,
                  );
                }
              }
            });
            observer.observe({ type: "layout-shift", buffered: true });
            setTimeout(() => {
              observer.disconnect();
              resolve({ shift: sum, sources: moved });
            }, 100);
          }),
      );
      // Name what moved, so a failure in CI says why without needing the trace.
      expect(shift, `${path} shifts by ${shift.toFixed(3)}:\n${sources.join("\n")}`).toBeLessThan(0.01);
    });
  }
});
