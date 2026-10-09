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

  test("the cron explainer describes a schedule and flags bad fields", async ({ page }) => {
    await page.goto("/tools/cron/");
    const input = page.getByLabel("Cron expression");
    await input.fill("*/15 9-17 * * mon-fri");
    await expect(page.locator("#cron-status")).toHaveText("Every 15 minutes during 09:00–17:59 on weekdays");
    await expect(page.locator('[data-field="dayOfWeek"] [data-detail]')).toHaveText("Monday–Friday");
    await expect(page.locator("[data-runs] tr")).toHaveCount(5);
    await page.getByRole("button", { name: "@hourly" }).click();
    await expect(page.locator("#cron-status")).toHaveText("At minute 0");
    await input.fill("61 * * * *");
    await expect(page.locator('[data-field="minute"] [data-detail]')).toHaveText("“61” is outside 0 to 59.");
    await expect(input).toHaveAttribute("aria-invalid", "true");
  });

  test("the timestamp converter reads every format", async ({ page }) => {
    await page.goto("/tools/timestamp/");
    const input = page.getByLabel("Timestamp or date");
    await expect(input).toHaveValue(/^\d{10}$/u);
    await input.fill("1791450000");
    await expect(page.locator('[data-format="iso"] [data-value]')).toHaveText("2026-10-08T09:00:00.000Z");
    await expect(page.locator('[data-format="rfc2822"] [data-value]')).toHaveText("Thu, 08 Oct 2026 09:00:00 +0000");
    await expect(page.locator('[data-zone="Asia/Tokyo"] [data-value]')).toContainText("18:00:00");
    await input.fill("Thu, 08 Oct 2026 10:00:00 +0100");
    await expect(page.locator('[data-format="milliseconds"] [data-value]')).toHaveText("1791450000000");
    await page.getByRole("button", { name: "Now" }).click();
    await expect(page.locator("[data-relative]")).toHaveText(/now|seconds? ago/u);
  });

  test("the text diff counts and marks changes in both views", async ({ page }) => {
    await page.goto("/tools/diff/");
    await page.getByLabel("Original").fill("one\ntwo\nthree");
    await page.getByLabel("Changed").fill("one\n2\nthree\nfour");
    await expect(page.locator("[data-status]")).toHaveText("2 added, 1 removed, 2 unchanged");
    // Phones start on the unified view, so pick side by side explicitly.
    await page.getByRole("radio", { name: "Side by side" }).check();
    await expect(page.locator('[data-output] td.diff__sign[data-type="remove"]')).toHaveText("−Removed");
    await page.getByRole("radio", { name: "Unified" }).check();
    await expect(page.locator('[data-output] tr[data-type="add"] .diff__text')).toHaveText(["2", "four"]);
  });

  test("the hash generator hashes text and makes UUIDs", async ({ page }) => {
    await page.goto("/tools/hash/");
    await page.getByLabel("Text to hash").fill("abc");
    await expect(page.locator('[data-algorithm="SHA-256"] [data-value="hex"]')).toHaveText(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    await expect(page.locator('[data-algorithm="SHA-1"] [data-value="base64"]')).toHaveText(
      "qZk+NkcGgWq6PiVxeFDCbJzQ2J0=",
    );
    await page.getByLabel("How many (1 to 20)").fill("3");
    await page.getByRole("button", { name: "Generate" }).click();
    const uuids = page.locator("[data-uuids] code");
    await expect(uuids).toHaveCount(3);
    await expect(uuids.first()).toHaveText(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });

  test("the HTTP status reference filters codes as you search", async ({ page }) => {
    await page.goto("/tools/http-status/");
    const status = page.locator("[data-status]");
    await expect(status).toHaveText("Showing 62 codes");
    await page.getByLabel("Search codes").fill("40");
    await expect(status).toHaveText("Showing 10 codes");
    await expect(page.locator('[data-group="2"]')).toBeHidden();
    await page.getByLabel("Search codes").fill("teapot");
    await expect(page.locator("[data-code]:visible")).toHaveText([/418/u]);
    await page.getByLabel("Search codes").fill("");
    await page.getByRole("radio", { name: "5xx" }).check();
    await expect(status).toHaveText("Showing 11 codes");
    await page.getByRole("link", { name: "Link to 503 Service Unavailable" }).click();
    await expect(page).toHaveURL(/#status-503$/u);
  });

  test("the semver checker explains a range and marks each version", async ({ page }) => {
    await page.goto("/tools/semver/");
    await page.getByLabel("Range").fill("~1.2 || ^2.1.0");
    await page.getByLabel("Versions, one per line").fill("1.2.9\n1.3.0\n2.4.1\n2.5.0-beta\nnope");
    await expect(page.locator("#semver-status")).toHaveText(
      "Matches at least 1.2.0 and below 1.3.0, or at least 2.1.0 and below 3.0.0.",
    );
    await expect(page.locator("[data-expanded]")).toHaveText(">=1.2.0 <1.3.0 || >=2.1.0 <3.0.0");
    await expect(page.locator("[data-highest]")).toHaveText("2.4.1");
    await expect(page.locator("[data-count-status]")).toHaveText("2 of 5 match");
    await expect(page.locator('[data-results] [data-result="prerelease"] code')).toHaveText("2.5.0-beta");
    await page.getByLabel("Range").fill("^1 || banana");
    await expect(page.getByLabel("Range")).toHaveAttribute("aria-invalid", "true");
  });

  test("the chmod calculator keeps the boxes, octal and symbolic forms in step", async ({ page }) => {
    await page.goto("/tools/chmod/");
    await expect(page.locator("[data-command]")).toHaveText("chmod 755 deploy.sh");
    await page
      .getByRole("group", { name: /Others/u })
      .getByLabel("Execute")
      .uncheck();
    await expect(page.getByLabel("Octal")).toHaveValue("754");
    await expect(page.getByLabel("Symbolic")).toHaveValue("rwxr-xr--");
    await page.getByLabel("Octal").fill("4711");
    await expect(page.getByLabel("Symbolic")).toHaveValue("rws--x--x");
    await expect(page.getByLabel("Setuid")).toBeChecked();
    await page.getByLabel("Symbolic").fill("rw-r--r--");
    await expect(page.getByLabel("Octal")).toHaveValue("644");
    await page.getByLabel("File or directory").fill("notes.txt");
    await expect(page.locator("[data-command]")).toHaveText("chmod 644 notes.txt");
    await expect(page.locator("[data-status]")).toHaveText(
      "Owner can read and write. Group can read. Others can read.",
    );
  });

  test("the shadow and gradient generator writes CSS for its layers and stops", async ({ page }) => {
    await page.goto("/tools/css-generator/");
    const output = page.locator("[data-output]");
    await expect(output).toContainText("linear-gradient(135deg, #7c6cf0 0%, #22d3ee 100%)");
    await page.getByRole("button", { name: "Add layer" }).click();
    const layer = page.getByRole("group", { name: "Layer 3" });
    await expect(layer.getByRole("slider", { name: "X offset (px)" })).toBeFocused();
    const y = layer.getByRole("spinbutton", { name: "Y offset (px)" });
    await y.fill("20");
    await y.press("Tab");
    await expect(layer.getByRole("slider", { name: "Y offset (px)" })).toHaveValue("20");
    await expect(output).toContainText("0 20px 12px 0 rgb(0 0 0 / 0.2)");
    await page
      .getByRole("group", { name: "Layer 1" })
      .getByRole("button", { name: /Remove/u })
      .click();
    await expect(page.locator("[data-layers] fieldset")).toHaveCount(2);
    await page.getByRole("radio", { name: "Radial" }).check();
    await expect(output).toContainText("radial-gradient(circle, #7c6cf0 0%, #22d3ee 100%)");
    await expect(page.getByRole("slider", { name: "Angle (degrees)" })).toBeHidden();
  });

  test("the JSON to TypeScript generator names, merges and options its types", async ({ page }) => {
    await page.goto("/tools/json-to-ts/");
    const input = page.getByLabel("JSON", { exact: true });
    const output = page.getByLabel("TypeScript", { exact: true });
    await input.fill('{"user-id": 1, "tags": [{"a": 1}, {"b": null}]}');
    await page.getByLabel("Root type name").fill("payload");
    await expect(output).toHaveValue(
      'export interface Payload {\n  "user-id": number;\n  tags: Tag[];\n}\n\nexport interface Tag {\n  a?: number;\n  b?: null;\n}\n',
    );
    await page.getByRole("radio", { name: "type" }).check();
    await page.getByLabel("Readonly properties").check();
    await page.getByLabel("Export each type").uncheck();
    await expect(output).toHaveValue(/^type Payload = \{\n {2}readonly "user-id": number;/u);
    await input.fill('{\n  "a": 1,\n}');
    await expect(page.locator("#jsonts-status")).toHaveText("Line 3, column 1: unexpected “}”.");
    await expect(input).toHaveAttribute("aria-invalid", "true");
  });

  test("the case converter writes every case, line by line", async ({ page }) => {
    await page.goto("/tools/case/");
    await page.getByLabel("Text to convert").fill("parseHTTPResponse\nCrème brûlée");
    await expect(page.locator('[data-value="camel"]')).toHaveText("parseHttpResponse\ncrèmeBrûlée");
    await expect(page.locator('[data-value="title"]')).toHaveText("Parse HTTP Response\nCrème Brûlée");
    await expect(page.locator('[data-value="slug"]')).toHaveText("parse-http-response\ncreme-brulee");
    await expect(page.locator("#case-status")).toHaveText("2 lines converted");
    await expect(page.getByRole("button", { name: "Copy SCREAMING_SNAKE_CASE" })).toBeVisible();
  });

  test("the aspect ratio calculator reduces, solves and previews a ratio", async ({ page }) => {
    await page.goto("/tools/aspect-ratio/");
    await page.getByRole("button", { name: /Laptop/u }).click();
    await expect(page.locator("#aspect-status")).toHaveText("1440 × 900 is 8:5: exactly 16:10.");
    await page.getByLabel("Lock the ratio").check();
    await page.getByLabel("Width", { exact: true }).fill("1920");
    await expect(page.getByLabel("Height", { exact: true })).toHaveValue("1200");
    await page.getByLabel("Ratio", { exact: true }).fill("21:9");
    await expect(page.getByLabel("Height", { exact: true })).toHaveValue("822.86");
    await expect(page.locator("[data-css]")).toHaveText("aspect-ratio: 7 / 3;");
    const box = await page.locator("[data-box]").boundingBox();
    expect(box!.width / box!.height).toBeCloseTo(7 / 3, 1);
  });

  test("the SQL formatter lays out a query without touching its strings", async ({ page, context, browserName }) => {
    await page.goto("/tools/sql/");
    const output = page.getByLabel("Formatted SQL");
    await page.getByLabel("SQL to format").fill("select a, 'x  from  y' as b from t where c = 1 and d = 2");
    await expect(output).toHaveValue("SELECT\n  a,\n  'x  from  y' AS b\nFROM\n  t\nWHERE\n  c = 1\n  AND d = 2");
    await page.getByRole("radio", { name: "lower" }).check();
    await page.getByLabel("Indent").selectOption({ label: "4 spaces" });
    await expect(output).toHaveValue(/^select\n {4}a,/u);
    await page.getByLabel("Minify").check();
    await expect(output).toHaveValue("select a,'x  from  y' as b from t where c=1 and d=2");
    await expect(page.locator("#sql-status")).toHaveText("1 statement minified");
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", { name: "Copy Formatted SQL" }).click();
      await expect(page.getByRole("button", { name: "Copied Formatted SQL" })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        "select a,'x  from  y' as b from t where c=1 and d=2",
      );
    }
  });

  test("the specificity calculator ranks selectors and explains the winner", async ({ page }) => {
    await page.goto("/tools/specificity/");
    await page.getByLabel("Selectors, one per line").fill(".nav a\n#main :where(.x) p\n:is(.a, #b) li::before");
    await expect(page.locator("#spec-status")).toHaveText(
      "3 selectors ranked. :is(.a, #b) li::before wins with (1, 0, 2).",
    );
    const winner = page.locator("[data-list] > li").first();
    await expect(winner.getByText("Wins")).toBeVisible();
    await expect(winner.locator('[data-kind="ignored"]')).toHaveText(".a");
    await expect(winner.locator('.spec__breakdown [data-weight="id"] [data-items]')).toHaveText("#b (inside :is())");
    await page.getByLabel("Selectors, one per line").fill("a >\n.b");
    await expect(page.getByText("Line 1, column 3: Nothing follows the combinator “>”.")).toBeVisible();
  });

  test("the URL parser takes a URL apart and rebuilds it from its parts", async ({ page }) => {
    await page.goto("/tools/url/");
    const input = page.getByLabel("URL", { exact: true });
    await input.fill("example.com/search?colour=#fff&size=2");
    await expect(page.getByText("There’s no protocol, so this assumes https://.")).toBeVisible();
    await expect(page.getByText(/A # in the query ends it early/u)).toBeVisible();
    await input.fill("https://example.com/search?q=flat+white");
    await expect(page.getByLabel("Value of parameter 1")).toHaveValue("flat white");
    await page.getByLabel("Hostname").fill("shop.example.org");
    await page.getByRole("button", { name: "Add parameter" }).click();
    await page.getByLabel("Name of parameter 2").fill("page");
    await page.getByLabel("Value of parameter 2").fill("2");
    await expect(input).toHaveValue("https://shop.example.org/search?q=flat+white&page=2");
    await expect(page.locator("[data-origin]")).toHaveText("https://shop.example.org");
    await page.getByLabel("Port").fill("http");
    await expect(page.getByText("The URL can’t take this value, so it hasn’t changed.")).toBeVisible();
    await page.getByRole("button", { name: "Remove parameter 1" }).click();
    await expect(input).toHaveValue("https://shop.example.org/search?page=2");
  });

  test("the base converter keeps every base, the bits and the bytes in step", async ({ page }) => {
    await page.goto("/tools/base/");
    await page.getByLabel("Hexadecimal").fill("0xdead_beef");
    await expect(page.getByLabel("Decimal base 10")).toHaveValue("3735928559");
    await expect(page.getByLabel("Binary")).toHaveValue("11011110101011011011111011101111");
    await expect(page.locator("[data-little]")).toHaveText("ef be ad de");
    await page.getByLabel("Decimal base 10").fill("-1");
    await expect(page.getByLabel("Signed (two’s complement)")).toBeChecked();
    await expect(page.locator('[data-row="16"] [data-hex]')).toHaveText("0xffff");
    await page.getByRole("radio", { name: "8-bit" }).check();
    await page.getByRole("button", { name: "Bit 7", exact: true }).click();
    await expect(page.getByLabel("Decimal base 10")).toHaveValue("127");
    await expect(page.getByRole("button", { name: "Bit 7", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.getByLabel("Decimal base 10").fill("18446744073709551615");
    await expect(page.getByLabel("Hexadecimal")).toHaveValue("ffffffffffffffff");
  });

  test("the Markdown table generator edits, imports and copies a table", async ({ page, context, browserName }) => {
    await page.goto("/tools/markdown-table/");
    const output = page.getByLabel("Markdown", { exact: true });
    await expect(output).toHaveValue(/^\| Operator \|/u);
    await page.getByLabel("Paste CSV, TSV or a Markdown table").fill("Name,Role\nAnn,Lead | Dev");
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.locator("#mdt-import-status")).toHaveText("Imported 1 rows and 2 columns from CSV.");
    await expect(output).toHaveValue("| Name | Role        |\n| :--- | :---------- |\n| Ann  | Lead \\| Dev |");
    await page.getByLabel("Alignment of column 2").selectOption({ label: "Right" });
    await page.getByLabel("Row 1, column 1").click();
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByLabel("Row 1, column 2")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByLabel("Header, column 2")).toBeFocused();
    await page.getByRole("button", { name: "Add row" }).click();
    await page.keyboard.type("Bo");
    await page.getByLabel("Compact").check();
    await expect(output).toHaveValue("|Name|Role|\n|:-|-:|\n|Ann|Lead \\| Dev|\n|Bo||");
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", { name: "Copy Markdown" }).click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        "|Name|Role|\n|:-|-:|\n|Ann|Lead \\| Dev|\n|Bo||",
      );
    }
  });

  test("the QR code generator encodes text, warns about contrast and downloads files", async ({ page }) => {
    await page.goto("/tools/qr/");
    await page.getByLabel("Text or URL").fill("HELLO WORLD");
    await expect(page.getByRole("img", { name: "QR code for “HELLO WORLD”" })).toBeVisible();
    await expect(page.locator("#qr-status")).toHaveText("Version 1, 21 × 21 modules, level M. 11 of 14 bytes used.");
    await expect(page.locator('[data-stat="modules"]')).toHaveText("21 × 21");
    await page.getByRole("radio", { name: "H · 30%" }).check();
    await expect(page.locator("#qr-status")).toHaveText("Version 2, 25 × 25 modules, level H. 11 of 14 bytes used.");
    await page.getByLabel("Foreground").fill("#bbbbbb");
    await expect(page.getByText(/Contrast is only 1\.\d+:1/u)).toBeVisible();
    await expect(page.locator("[data-preview] path")).toHaveAttribute("fill", "#bbbbbb");
    const svg = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download SVG" }).click();
    expect((await svg).suggestedFilename()).toBe("qr-code.svg");
    const png = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PNG" }).click();
    expect((await png).suggestedFilename()).toBe("qr-code.png");
    await page.getByLabel("Text or URL").fill("x".repeat(1300));
    await expect(page.locator("#qr-status")).toHaveText(
      "That’s 1300 bytes, but level H holds 1273 at most. Shorten the text or pick a lower level.",
    );
    await expect(page.getByRole("button", { name: "Download SVG" })).toBeDisabled();
  });

  test("the password generator makes passwords and passphrases, and keeps them out of the URL", async ({ page }) => {
    await page.goto("/tools/password/");
    const values = page.locator("[data-list] code");
    await expect(values).toHaveCount(5);
    await expect(page.getByRole("button", { name: "Copy share link" })).toHaveCount(0);
    await page.getByLabel("Length").fill("32");
    await expect(values.first()).toHaveText(/^.{32}$/u);
    await page.getByLabel("Symbols (!@#$…)").uncheck();
    await expect(page.locator("#pw-status")).toHaveText("Generated 5 passwords with 190 bits of entropy each.");
    await expect(page.locator("[data-rating]")).toHaveText(/^Very strong/u);
    await page.getByRole("radio", { name: "Passphrases" }).check();
    await page.getByLabel("Separator").selectOption({ label: "Full stop (.)" });
    await expect(values.first()).toHaveText(/^[a-z-]+(?:\.[a-z-]+){4}$/u);
    await expect(page.locator("#pw-status")).toHaveText("Generated 5 passphrases with 51 bits of entropy each.");
    await page.getByLabel("How many").fill("2");
    await page.getByLabel("How many").press("Enter");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(values).toHaveCount(2);
    const passphrase = (await values.first().textContent()) ?? "";
    expect(new URL(page.url()).hash).toBe("");
    const stored = await page.evaluate(() =>
      JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
    );
    expect(stored).not.toContain(passphrase);
  });

  test("the glob tester matches paths and explains the pattern", async ({ page }) => {
    await page.goto("/tools/glob/");
    await page.getByLabel("Glob pattern").fill("**/*.test.{ts,tsx}");
    await page.getByLabel("Paths, one per line").fill("src/a.test.ts\nsrc/b.ts\n.hidden/c.test.tsx");
    await expect(page.locator("#glob-status")).toHaveText("1 of 3 paths match.");
    await expect(page.locator("[data-list] li[data-matched] code")).toHaveText(["src/a.test.ts"]);
    await page.getByLabel("Match dotfiles (dot)").check();
    await expect(page.locator("#glob-status")).toHaveText("2 of 3 paths match.");
    await expect(page.locator("[data-regex]")).toContainText("/^(?:");
    await expect(page.getByText("Braces expand to 2 patterns, joined with |.")).toBeVisible();
    await expect(page.locator("[data-segments] li").first()).toContainText("Any number of folders, including none");
    await page.getByLabel("Glob pattern").fill("!*.md");
    await expect(page.getByText("The pattern is negated, so a path matches when this doesn’t.")).toBeVisible();
  });

  test("the Unicode inspector breaks text into graphemes and flags hidden characters", async ({ page }) => {
    await page.goto("/tools/unicode/");
    await page.getByLabel("Text to inspect").fill("p\u0430ypal\u200b");
    await expect(page.locator("#uni-status")).toHaveText("7 graphemes, 7 code points. 2 characters flagged.");
    await expect(page.getByText("Words that mix scripts: p\u0430ypal")).toBeVisible();
    await expect(page.locator('[data-count="utf8"]')).toHaveText("10");
    const table = page.getByRole("region", { name: "Characters", exact: true });
    await expect(table.getByText("Looks like Latin “a”")).toBeVisible();
    await expect(table.getByText("Invisible (ZWSP)")).toBeVisible();
    // The table's region only takes focus when it has to scroll sideways, as on a phone.
    if (await table.evaluate((element) => element.scrollWidth > element.clientWidth)) {
      await table.focus();
      await expect(table).toBeFocused();
    } else await expect(table).not.toHaveAttribute("tabindex");
    await page.getByLabel("Text to inspect").fill("e\u0301");
    await expect(page.locator('[data-form="NFC"] [data-verdict]')).toHaveText("Differs");
    await expect(page.locator('[data-form="NFD"] [data-verdict]')).toHaveText("Same as the input");
    await expect(page.locator('[data-count="graphemes"]')).toHaveText("1");
  });
});

test.describe("tools index", () => {
  test("groups tools by category and filters them by search and category", async ({ page }) => {
    await page.goto("/tools/");
    const status = page.locator("[data-tools-status]");
    const colour = page.getByRole("heading", { level: 2, name: /^Colour & design/u });
    await expect(status).toHaveText("All 29 tools");
    await expect(colour).toBeVisible();
    await expect(page.locator("[data-tool]")).toHaveCount(29);

    // `/` focuses this page's search rather than opening the palette.
    await page.keyboard.press("/");
    const search = page.getByLabel("Search tools");
    await expect(search).toBeFocused();
    await expect(page.locator("#palette")).not.toHaveAttribute("open");

    // Keywords that live only in the catalogue match too.
    await page.keyboard.type("crontab");
    await expect(status).toHaveText("1 tool matches.");
    await expect(page.locator("[data-tool]:visible")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Cron expression explainer" })).toBeVisible();
    await expect(colour).toBeHidden();

    await search.fill("");
    await page.locator(".tools__chip").filter({ hasText: "CSS & layout" }).click();
    await expect(status).toHaveText("4 tools match.");
    await search.fill("json");
    await expect(status).toHaveText("No tools match.");
    await expect(page.getByText("Nothing matches that.")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(status).toHaveText("All 29 tools");
    await expect(search).toBeFocused();
    await expect(page.locator("[data-tool]:visible")).toHaveCount(29);
  });

  test("shows recently used tools, newest first", async ({ page }) => {
    await page.goto("/tools/");
    await expect(page.getByRole("heading", { name: "Recently used" })).toBeHidden();
    await page.goto("/tools/regex/");
    await page.goto("/tools/json/");
    await page.goto("/tools/");
    const recent = page.getByRole("region", { name: "Recently used" });
    await expect(recent.getByRole("link")).toHaveText(["{ }JSON formatter", ".*Regex tester"]);
  });

  test("lists every tool without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/tools/");
    await expect(page.locator("[data-tool]:visible")).toHaveCount(29);
    await expect(page.getByLabel("Search tools")).toBeHidden();
    await context.close();
  });
});

test.describe("related tools", () => {
  test("each tool page links to three tools from its category and back to the index", async ({ page }) => {
    await page.goto("/tools/regex/");
    const related = page.getByRole("complementary", { name: "Related tools" });
    await expect(related.getByText("Text & data")).toBeVisible();
    await expect(related.getByRole("heading", { level: 3 })).toHaveText([
      "Text diff",
      "JSON to TypeScript",
      "SQL formatter",
    ]);
    await related.getByRole("link", { name: "Text diff" }).click();
    await expect(page).toHaveURL(/\/tools\/diff\/$/u);
    await page
      .getByRole("complementary", { name: "Related tools" })
      .getByRole("link", { name: "All 29 tools" })
      .click();
    await expect(page).toHaveURL(/\/tools\/$/u);
  });
});

test.describe("share links", () => {
  test("copies the inputs into the fragment and restores them from it", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Only Chromium lets tests read the clipboard.");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/tools/regex/");
    await page.getByLabel("Pattern").fill(String.raw`\d+`);
    await page.getByLabel("Test text").fill("<b>1</b> and 22");
    await page.getByLabel("global").uncheck();
    await page.getByRole("button", { name: "Copy share link" }).click();
    await expect(page.getByText("Link copied.")).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/tools\/regex\/#s=[\w-]+$/u);
    expect(link).not.toContain("?");
    expect(page.url()).toBe(link);

    const shared = await context.newPage();
    await shared.goto(link);
    await expect(shared.getByLabel("Pattern")).toHaveValue(String.raw`\d+`);
    await expect(shared.getByLabel("Test text")).toHaveValue("<b>1</b> and 22");
    await expect(shared.getByLabel("global")).not.toBeChecked();
    await expect(shared.locator("#regex-status")).toHaveText("1 match");
    await expect(shared.locator("[data-highlight] b")).toHaveCount(0);
    await expect(shared.getByText("Inputs restored from a shared link.")).toBeVisible();
  });

  test("restores checkboxes on the SQL formatter from a link", async ({ page }) => {
    await page.goto("/tools/sql/");
    await page.getByLabel("SQL to format").fill("select 1");
    await page.getByLabel("Minify", { exact: true }).check();
    await page.getByRole("button", { name: "Copy share link" }).click();
    await expect(page).toHaveURL(/#s=/u);
    const { hash } = new URL(page.url());
    await page.goto("/tools/");
    await page.goto(`/tools/sql/${hash}`);
    await expect(page.getByLabel("SQL to format")).toHaveValue("select 1");
    await expect(page.getByLabel("Minify", { exact: true })).toBeChecked();
  });

  test("explains when the inputs are too long for a link", async ({ page }) => {
    await page.goto("/tools/diff/");
    await page.getByLabel("Original").fill("x".repeat(5000));
    await page.getByRole("button", { name: "Copy share link" }).click();
    await expect(page.getByText("Too much to fit in a link.")).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
  });
});
