import { expect, test } from "./fixtures";

test.describe("article page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/how-to-fetch-data-from-backend-react/");
  });

  test("generates a table of contents whose links all resolve", async ({ page }) => {
    const links = page.locator("[data-toc-link]");
    expect(await links.count()).toBeGreaterThan(3);
    for (const id of await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-toc-link")))) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
  });

  test("headings are self-linking anchors", async ({ page }) => {
    const heading = page.locator(".prose h2").first();
    const id = await heading.getAttribute("id");
    await expect(heading.locator("a.heading-anchor")).toHaveAttribute("href", `#${id}`);
  });

  test("code blocks are highlighted at build time with a copy button", async ({ page }) => {
    const block = page.locator(".expressive-code").first();
    await expect(block).toBeVisible();
    await expect(block.locator("button.copy, button[data-code]").first()).toBeAttached();
  });

  test("the edit link points at the article source on the default branch", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Suggest an edit" })).toHaveAttribute(
      "href",
      "https://github.com/louis-young/louisyoung.co.uk/edit/master/content/articles/how-to-fetch-data-from-backend-react/index.mdx",
    );
  });

  test("external links are marked and safe", async ({ page }) => {
    const external = page.locator(".prose a[data-external]").first();
    await expect(external).toHaveAttribute("rel", "noopener noreferrer");
    await expect(external).not.toHaveAttribute("target", /.+/u);
  });

  test("the reading progress bar tracks the scroll position", async ({ page, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Scroll-driven animations are Chromium-only today; the bar is hidden elsewhere.",
    );
    const bar = page.locator(".reading-progress");
    const scale = () => bar.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).a);
    expect(await scale()).toBeLessThan(0.05);
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect.poll(scale).toBeGreaterThan(0.95);
  });

  test("sandboxes load only when asked", async ({ page }) => {
    await page.route("https://codesandbox.io/**", (route) =>
      route.fulfill({ body: "<p>sandbox</p>", contentType: "text/html" }),
    );
    const sandbox = page.locator("sandbox-embed").first();
    await expect(sandbox.locator("iframe")).toHaveCount(0);
    await sandbox.getByRole("button", { name: "Load interactive example" }).click();
    await expect(sandbox.locator("iframe")).toHaveAttribute("src", /codesandbox\.io\/embed\/fetch-api-9d09j/u);
  });
});

test.describe("live demo", () => {
  test("shows the stale-closure bug, then the fix", async ({ page }) => {
    await page.goto("/why-functional-state-updates-are-important/");
    const [stale, functional] = await page.locator(".demo").all();
    await stale!.scrollIntoViewIfNeeded();
    await stale!.getByRole("button", { name: "Increment" }).click();
    await expect(stale!.getByRole("status")).toHaveText("1");
    await functional!.scrollIntoViewIfNeeded();
    await functional!.getByRole("button", { name: "Increment" }).click();
    await expect(functional!.getByRole("status")).toHaveText("2");
    await functional!.getByRole("button", { name: "Reset" }).click();
    await expect(functional!.getByRole("status")).toHaveText("0");
  });
});

test.describe("copy link", () => {
  test("copies the canonical URL", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Clipboard permissions are Chromium-only in Playwright.");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/utilising-context-api-react/");
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeAttached();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "https://louisyoung.co.uk/utilising-context-api-react/",
    );
  });
});

test.describe("table of contents scroll-spy", () => {
  test("highlights the section being read, even mid-way through a long one", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/how-to-fetch-data-from-backend-react/");
    const toc = page.locator(".article__toc");
    await expect(toc.locator('[aria-current="location"]')).toHaveCount(0);
    await page.locator("#tutorial").scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      window.scrollBy(0, 200);
    });
    await expect(toc.locator('[aria-current="location"]')).toHaveCount(1);
  });
});

test.describe("layout", () => {
  for (const width of [320, 390, 768]) {
    test(`nothing overflows horizontally at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ["/", "/how-to-fetch-data-from-backend-react/", "/design/"]) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, path).toBeLessThanOrEqual(0);
      }
    });
  }
});
