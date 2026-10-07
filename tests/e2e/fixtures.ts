import { readdirSync } from "node:fs";

import { test as base, expect } from "@playwright/test";

export const articleSlugs = readdirSync(new URL("../../content/articles/", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

export const pages = [
  "/",
  "/tags/",
  "/tags/react/",
  "/search/",
  "/design/",
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
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (event) => {
          console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
        });
      });
      await use(errors);
      expect(errors, "console errors / CSP violations").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
