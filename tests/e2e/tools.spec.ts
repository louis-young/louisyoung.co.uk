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

  test("the JSON formatter formats, sorts and points at mistakes", async ({ page }) => {
    await page.goto("/tools/json/");
    const input = page.getByLabel("JSON to format");
    const output = page.getByLabel("Result", { exact: true });
    await input.fill('{"b":1,"a":[true]}');
    await expect(output).toHaveValue('{\n  "b": 1,\n  "a": [\n    true\n  ]\n}');
    await page.getByLabel("Sort keys A to Z").check();
    await page.getByLabel("Indent").selectOption({ label: "None (minified)" });
    await expect(output).toHaveValue('{"a":[true],"b":1}');
    await input.fill('{\n  "a": 1,\n}');
    await expect(page.locator("#json-status")).toHaveText("Line 3, column 1: unexpected “}”.");
    await expect(input).toHaveAttribute("aria-invalid", "true");
  });

  test("the regex tester highlights matches and lists groups", async ({ page }) => {
    await page.goto("/tools/regex/");
    await page.getByLabel("Pattern").fill(String.raw`(?<word>\w+)@(\w+)`);
    await page.getByLabel("Test text").fill("ada@example and <b>bob@site</b>");
    await expect(page.locator("#regex-status")).toHaveText("2 matches");
    await expect(page.locator("[data-highlight] mark")).toHaveText(["ada@example", "bob@site"]);
    await expect(page.locator("[data-highlight] b")).toHaveCount(0);
    await expect(page.locator("[data-matches] li").first()).toContainText("Group 1 · word");
    await page.getByLabel("global").uncheck();
    await expect(page.locator("#regex-status")).toHaveText("1 match");
    await page.getByLabel("Pattern").fill("(");
    await expect(page.locator("#regex-status")).toContainText("That pattern isn’t valid");
  });

  test("the encoder round-trips Base64 and decodes a JWT", async ({ page }) => {
    await page.goto("/tools/encode/");
    const input = page.getByLabel("Input", { exact: true });
    await input.fill("Café ✓");
    await expect(page.locator("[data-output]")).toHaveText("Q2Fmw6kg4pyT");
    await page.getByRole("radio", { name: "Decode" }).check();
    await input.fill("Q2Fmw6kg4pyT");
    await expect(page.locator("[data-output]")).toHaveText("Café ✓");
    await page.getByRole("radio", { name: "JWT" }).check();
    await input.fill(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMzYwMH0.c2ln",
    );
    await expect(page.locator("[data-jwt-header]")).toContainText('"alg": "HS256"');
    await expect(page.locator("[data-jwt-payload]")).toContainText('"sub": "123"');
    await expect(page.locator("[data-jwt-times]")).toContainText("14 Nov 2023, 23:13:20 · expired");
    await expect(page.getByText("The signature is not verified.", { exact: false })).toBeVisible();
  });
});
