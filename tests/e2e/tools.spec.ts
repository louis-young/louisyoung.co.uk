import { expect, test } from "./fixtures";

test.describe("tools", () => {
  test("the contrast checker grades a pair and fixes a failing colour", async ({ page }) => {
    await page.goto("/tools/contrast/");
    const text = page.locator("#contrast-foreground");
    const background = page.locator("#contrast-background");
    await text.fill("#999999");
    await background.fill("#ffffff");
    await expect(page.locator("[data-ratio]")).toHaveText("2.84:1");
    await expect(page.getByRole("status").filter({ hasText: "Contrast" })).toHaveText(/Fail/u);
    await page.getByRole("button", { name: "Use this colour" }).click();
    await expect(page.locator('[data-check="aaText"] [data-badge]')).toHaveText("Pass");
  });

  test("the clamp() generator writes CSS for the inputs", async ({ page }) => {
    await page.goto("/tools/clamp/");
    await page.getByLabel("Size at the smallest viewport (px)", { exact: true }).fill("16");
    await page.getByLabel("Size at the largest viewport (px)", { exact: true }).fill("24");
    await page.getByLabel("Smallest viewport (px)", { exact: true }).fill("320");
    await page.getByLabel("Largest viewport (px)", { exact: true }).fill("1280");
    await expect(page.locator("output")).toHaveText("clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)");
  });

  test("the reading-time estimator counts as you type", async ({ page }) => {
    await page.goto("/tools/reading-time/");
    await page.getByLabel("Your text (Markdown is fine)").fill("word ".repeat(460));
    await expect(page.locator('[data-stat="words"]')).toHaveText("460");
    await expect(page.locator('[data-stat="minutes"]')).toHaveText("2");
  });

  test("stats and colophon render", async ({ page }) => {
    await page.goto("/stats/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Writing, by the numbers");
    await page.goto("/colophon/");
    await expect(page.getByRole("heading", { level: 2, name: "Accessibility" })).toBeVisible();
  });
});
