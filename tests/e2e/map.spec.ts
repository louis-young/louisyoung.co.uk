import { readdirSync, readFileSync } from "node:fs";

import { articleSlugs, expect, snippetSlugs, test } from "./fixtures";

const toolSlugs = readdirSync(new URL("../../src/pages/tools/", import.meta.url))
  .filter((name) => name.endsWith(".astro") && name !== "index.astro")
  .map((name) => name.replace(/\.astro$/u, ""));

/** Every tag used by an article or a snippet, read straight from the frontmatter. */
const topics = [
  ...new Set(
    [
      ...articleSlugs.map((slug) => `../../content/articles/${slug}/index.mdx`),
      ...snippetSlugs.map((slug) => `../../content/snippets/${slug}/index.mdx`),
    ].flatMap((path) => {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      return JSON.parse(/^tags:\s*(\[.*\])$/mu.exec(source)?.[1] ?? "[]") as string[];
    }),
  ),
];

test.describe("content map", () => {
  test("has a node linking to every article, snippet, tool and topic, and every link works", async ({
    page,
    request,
  }) => {
    await page.goto("/map/");
    const nodes = page.locator("[data-map-svg] a[data-node]");
    await expect(nodes).toHaveCount(articleSlugs.length + snippetSlugs.length + toolSlugs.length + topics.length + 5);
    const hrefs = await nodes.evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    for (const slug of articleSlugs) expect(hrefs).toContain(`/${slug}/`);
    for (const slug of snippetSlugs) expect(hrefs).toContain(`/snippets/${slug}/`);
    for (const slug of toolSlugs) expect(hrefs).toContain(`/tools/${slug}/`);
    for (const href of new Set(hrefs)) {
      expect((await request.get(href)).ok(), href).toBe(true);
    }
    // Every node has an accessible name with its kind and connection count.
    await expect(page.getByRole("link", { name: "react, topic, 10 connections" })).toHaveAttribute(
      "href",
      "/tags/react/",
    );
  });

  test("a node opens its page", async ({ page }) => {
    await page.goto("/map/");
    await page.locator('[data-id="tool:json"]').focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/tools/json/");
  });

  test("focusing a node highlights its neighbours, and the arrow keys move between nodes", async ({ page }) => {
    await page.goto("/map/");
    const map = page.locator("[data-map]");
    await expect(map).toHaveAttribute("data-ready", "");
    const react = page.locator('[data-id="topic:react"]');
    await react.focus();
    await expect(map).toHaveAttribute("data-highlighting", "");
    await expect(react).toHaveClass(/is-active/u);
    const near = page.locator("[data-node].is-near");
    expect(await near.count()).toBe(10);
    await expect(page.locator('[data-id="article:how-to-fetch-data-from-backend-react"]')).toHaveClass(/is-near/u);
    await expect(page.locator('[data-id="tool:json"]')).not.toHaveClass(/is-near|is-active/u);
    expect(await page.locator('[data-id="tool:json"]').evaluate((node) => getComputedStyle(node).opacity)).not.toBe(
      "1",
    );
    await expect(page.locator(".map__edge.is-lit")).toHaveCount(10);
    await expect(page.locator("[data-inspector-title]")).toHaveText("react");

    // One tab stop: the arrow keys move focus (and the highlight) to another node.
    await expect(page.locator('[data-node][tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press("ArrowRight");
    const focused = page.locator("[data-node]:focus");
    await expect(focused).toHaveCount(1);
    await expect(focused).not.toHaveAttribute("data-id", "topic:react");
    await expect(focused).toHaveClass(/is-active/u);
    await expect(focused).toHaveAttribute("tabindex", "0");

    await page.keyboard.press("Escape");
    await page.keyboard.press("Tab");
    await expect(map).not.toHaveAttribute("data-highlighting", "");
  });

  test("filters by kind and focuses a topic", async ({ page }) => {
    await page.goto("/map/");
    await expect(page.locator("[data-map]")).toHaveAttribute("data-ready", "");
    const total = await page.locator("[data-node]").count();
    const status = page.locator("[data-map-status]");
    await expect(status).toHaveText(`Showing ${total} of ${total} nodes`);

    await page.getByRole("checkbox", { name: /Articles/u }).uncheck();
    await expect(page.locator('[data-node][data-kind="article"]:visible')).toHaveCount(0);
    await expect(page.locator('[data-node][data-kind="snippet"]:visible')).toHaveCount(snippetSlugs.length);
    await expect(status).toHaveText(`Showing ${total - articleSlugs.length} of ${total} nodes`);

    await page.getByRole("checkbox", { name: /Tools/u }).uncheck();
    await expect(page.locator('[data-node][data-kind="tool"]:visible')).toHaveCount(0);
    await expect(page.locator('[data-node][data-kind="category"]:visible')).toHaveCount(0);
    await expect(page.locator('.map__edge[data-kinds~="tool"]:visible')).toHaveCount(0);

    await page.getByRole("checkbox", { name: /Articles/u }).check();
    await page.getByRole("checkbox", { name: /Tools/u }).check();
    await expect(status).toHaveText(`Showing ${total} of ${total} nodes`);

    await page.getByLabel("Focus a topic").selectOption("topic:typescript");
    await expect(page.locator("[data-map]")).toHaveAttribute("data-pinned", "");
    await expect(page.locator('[data-id="topic:typescript"]')).toHaveClass(/is-active/u);
    await expect(page.locator('[data-id="tool:json-to-ts"]')).toHaveClass(/is-near/u);

    await page.getByRole("checkbox", { name: /Topics/u }).uncheck();
    await expect(page.getByLabel("Focus a topic")).toBeDisabled();
    await expect(page.locator('[data-node][data-kind="topic"]:visible')).toHaveCount(0);
  });

  test("has no horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/map/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });

  test("has its own Open Graph image and JSON-LD", async ({ page }) => {
    await page.goto("/map/");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://louisyoung.co.uk/og/map.png",
    );
    const [list, breadcrumb] = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "[]",
    ) as Record<string, unknown>[];
    expect(list).toMatchObject({ "@type": "ItemList", numberOfItems: topics.length });
    expect(breadcrumb).toMatchObject({ "@type": "BreadcrumbList" });
  });
});

test.describe("content map without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the list holds every topic, article, snippet and tool", async ({ page }) => {
    await page.goto("/map/");
    const list = page.locator("#map-list");
    await expect(page.getByRole("link", { name: "View as list" }).first()).toHaveAttribute("href", "#map-list");
    await expect(list.getByRole("heading", { level: 2, name: "The map as a list" })).toBeVisible();

    const topicCards = list.locator('[data-map-list="topic"] > li');
    await expect(topicCards).toHaveCount(topics.length);
    for (const topic of topics) {
      await expect(list.getByRole("heading", { level: 4, name: new RegExp(`^#${topic}(?![\\w-])`, "u") })).toHaveCount(
        1,
      );
    }
    await expect(list.locator('[data-map-list="category"] > li')).toHaveCount(5);

    const listed = (kind: string) =>
      list
        .locator(`a[data-map-item^="${kind}:"]`)
        .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")))].sort());
    expect(await listed("article")).toEqual(articleSlugs.map((slug) => `/${slug}/`).sort());
    expect(await listed("snippet")).toEqual(snippetSlugs.map((slug) => `/snippets/${slug}/`).sort());
    expect(await listed("tool")).toEqual(toolSlugs.map((slug) => `/tools/${slug}/`).sort());

    // Each item appears under every topic it is tagged with.
    const tagged = articleSlugs.reduce((sum, slug) => {
      const source = readFileSync(new URL(`../../content/articles/${slug}/index.mdx`, import.meta.url), "utf8");
      return sum + (JSON.parse(/^tags:\s*(\[.*\])$/mu.exec(source)?.[1] ?? "[]") as string[]).length;
    }, 0);
    await expect(list.locator('[data-map-list="topic"] a[data-map-item^="article:"]')).toHaveCount(tagged);

    // The controls need the script, so they're hidden; the map's links still work.
    await expect(page.locator("[data-map-controls]")).toBeHidden();
    await expect(page.locator("[data-map]")).not.toHaveAttribute("data-ready", "");
  });
});
