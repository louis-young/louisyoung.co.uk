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

  test("the colour converter writes every format and a tonal scale", async ({ page }) => {
    await page.goto("/tools/colour/");
    await page.getByLabel("Colour", { exact: true }).fill("hsl(0 100% 50%)");
    await expect(page.locator('[data-format="hex"]')).toHaveText("#ff0000");
    await expect(page.locator('[data-format="rgb"]')).toHaveText("rgb(255 0 0)");
    await expect(page.locator('[data-format="oklch"]')).toHaveText(/^oklch\(62\.\d+% 0\.25\d* 29\.\d+\)$/u);
    await expect(page.locator("[data-step]")).toHaveCount(11);
    await page.getByLabel("Custom property name").fill("danger");
    await expect(page.locator("[data-css]")).toContainText("--danger-500: #");
    await expect(page.locator('[data-step="950"] [data-on-white]')).toHaveText(/^1\d\.\d\d:1$/u);
  });

  test("the unit converter lists every equivalent", async ({ page }) => {
    await page.goto("/tools/units/");
    await page.getByLabel("Value", { exact: true }).fill("2");
    await page.getByLabel("Unit", { exact: true }).selectOption("rem");
    await page.getByLabel("Root font size (px)").fill("10");
    await expect(page.locator('tr[data-unit="px"] [data-value]')).toHaveText("20px");
    await expect(page.locator('tr[data-unit="pt"] [data-value]')).toHaveText("15pt");
    await page.getByLabel("Viewport width (px)").fill("0");
    await expect(page.getByRole("alert")).toHaveText("Font sizes and viewport sizes need to be positive numbers.");
  });

  test("the easing editor responds to presets, inputs and the keyboard", async ({ page }) => {
    await page.goto("/tools/easing/");
    const output = page.locator("[data-output]");
    await expect(output).toHaveText("cubic-bezier(0.16, 1, 0.3, 1)");
    await page.getByRole("button", { name: "ease-in-out", exact: true }).click();
    await expect(output).toHaveText("cubic-bezier(0.42, 0, 0.58, 1)");
    await page.getByLabel("Control point 1 x (time)").fill("0.5");
    await expect(output).toHaveText("cubic-bezier(0.5, 0, 0.58, 1)");
    const handle = page.getByRole("slider", { name: "Control point 2" });
    await handle.focus();
    await page.keyboard.press("Shift+ArrowLeft");
    await expect(output).toHaveText("cubic-bezier(0.5, 0, 0.48, 1)");
    await expect(handle).toHaveAttribute("aria-valuetext", "Time 0.48, progress 1");
    await page.locator("[data-plot]").scrollIntoViewIfNeeded();
    const box = (await page.locator("[data-plot]").boundingBox())!;
    const start = (await handle.boundingBox())!;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width, box.y + box.height * (90 / 330));
    await page.mouse.up();
    await expect(output).toHaveText("cubic-bezier(0.5, 0, 1, 1)");
  });
});
