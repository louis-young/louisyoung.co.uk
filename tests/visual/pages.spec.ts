import { expect, test } from "@playwright/test";

const routes = {
  home: "/",
  article: "/why-functional-state-updates-are-important/",
  "article-callouts": "/handling-protected-routes-react-router/",
  topics: "/tags/",
  topic: "/tags/react/",
  search: "/search/",
  "not-found": "/404/",
};
const viewports = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
};
const themes = ["light", "dark"] as const;

for (const [name, path] of Object.entries(routes)) {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    for (const theme of themes) {
      test(`${name} · ${viewportName} · ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        await page
          .locator("img")
          .evaluateAll((images) =>
            Promise.all(images.map((image) => (image as HTMLImageElement).decode().catch(() => undefined))),
          );
        await expect(page).toHaveScreenshot(`${name}-${viewportName}-${theme}.png`, { fullPage: true });
      });
    }
  }
}
