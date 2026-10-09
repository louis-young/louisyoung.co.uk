import { readdirSync } from "node:fs";

import { test as base, expect } from "@playwright/test";

export const articleSlugs = readdirSync(new URL("../../content/articles/", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

export const workSlugs = readdirSync(new URL("../../content/work/", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

export const snippetSlugs = readdirSync(new URL("../../content/snippets/", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

export const pages = [
  "/",
  "/work/",
  ...workSlugs.map((slug) => `/work/${slug}/`),
  "/writing/",
  "/snippets/",
  ...snippetSlugs.map((slug) => `/snippets/${slug}/`),
  "/hire/",
  "/cv/",
  "/now/",
  "/uses/",
  "/tags/",
  "/tags/react/",
  "/search/",
  "/design/",
  "/tools/",
  "/tools/contrast/",
  "/tools/clamp/",
  "/tools/reading-time/",
  "/tools/json/",
  "/tools/regex/",
  "/tools/encode/",
  "/tools/colour/",
  "/tools/units/",
  "/tools/easing/",
  "/tools/cron/",
  "/tools/timestamp/",
  "/tools/diff/",
  "/tools/hash/",
  "/tools/http-status/",
  "/tools/semver/",
  "/tools/chmod/",
  "/tools/css-generator/",
  "/tools/json-to-ts/",
  "/tools/case/",
  "/tools/aspect-ratio/",
  "/tools/sql/",
  "/tools/specificity/",
  "/tools/url/",
  "/tools/base/",
  "/tools/markdown-table/",
  "/tools/qr/",
  "/tools/password/",
  "/tools/glob/",
  "/tools/unicode/",
  "/stats/",
  "/map/",
  "/changelog/",
  "/colophon/",
  "/accessibility/",
  ...articleSlugs.map((slug) => `/${slug}/`),
];

/**
 * Fails any test whose page logs an error or violates the Content Security Policy, so a
 * broken script or a CSP regression can't slip through quietly.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      // Chromium rejects a cross-document view transition's promises when a test ends (and the
      // page is torn down) mid-transition. That is teardown noise, not a page error.
      // WebKit also logs a same-origin hover prefetch as an "access control" failure when a click
      // navigates before the prefetch finishes. The navigation itself is unaffected.
      const isTeardownNoise = (text: string) =>
        text.startsWith("Transition was aborted because of invalid state") ||
        /\/\/localhost:\d+\/\S* due to access control checks\.$/u.test(text);
      page.on("console", (message) => {
        if (message.type() === "error" && !isTeardownNoise(message.text())) errors.push(message.text());
      });
      page.on("pageerror", (error) => {
        if (!isTeardownNoise(error.message)) errors.push(error.message);
      });
      await page.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (event) => {
          const source = event.sourceFile ? ` at ${event.sourceFile}:${event.lineNumber}` : "";
          const sample = event.sample ? ` (${event.sample.slice(0, 60)})` : "";
          console.error(
            `CSP violation: ${event.violatedDirective} ${event.blockedURI} on ${location.pathname}${source}${sample}`,
          );
        });
      });
      await use(errors);
      expect(errors, "console errors / CSP violations").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
