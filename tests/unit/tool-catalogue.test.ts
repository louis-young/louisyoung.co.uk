import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { useTranslations } from "../../src/i18n";
import { featuredTools, newestTool, toolImage, toolPageProps, toolPath, tools } from "../../src/lib/tool-catalogue";

describe("tool catalogue", () => {
  it("lists every tool page exactly once", () => {
    const pages = readdirSync(new URL("../../src/pages/tools/", import.meta.url))
      .filter((name) => name !== "index.astro")
      .map((name) => name.replace(/\.astro$/u, ""));
    expect(tools.map((tool) => tool.slug).sort()).toEqual(pages.sort());
  });

  it("dates every tool with an ISO 8601 timestamp that isn't in the future", () => {
    for (const tool of tools) {
      expect(tool.added, tool.slug).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/u);
      expect(new Date(tool.added).getTime(), tool.slug).toBeLessThanOrEqual(Date.now());
    }
  });

  // `added` is set by hand when a tool ships, not checked against git: squash merges rewrite the
  // commit that added a page, so its date in a pull request differs from its date on master.
  it("gives every tool a full ISO 8601 date with an offset", () => {
    for (const tool of tools) {
      expect(tool.added, tool.slug).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/u);
    }
  });

  it("finds the newest tool, by instant rather than by wall-clock text", () => {
    const latest = Math.max(...tools.map((tool) => new Date(tool.added).getTime()));
    const tool = newestTool();
    expect(new Date(tool.added).getTime()).toBe(latest);
    const tied = tools.filter((item) => new Date(item.added).getTime() === latest);
    expect(tool).toBe(tied.at(-1));
  });

  it("features four to six distinct tools on the home page", () => {
    const featured = featuredTools();
    expect(featured.length).toBeGreaterThanOrEqual(4);
    expect(featured.length).toBeLessThanOrEqual(6);
    expect(new Set(featured.map((tool) => tool.slug)).size).toBe(featured.length);
    for (const tool of featured) expect(tools).toContain(tool);
  });

  it("builds paths and OG images", () => {
    expect(toolPath("json")).toBe("/tools/json/");
    expect(toolImage("json")).toBe("/og/tools-json.png");
  });

  it("gives each tool page its own title, description, image and structured data", () => {
    const props = toolPageProps("json", useTranslations());
    expect(props).toMatchObject({ title: "JSON formatter", image: "/og/tools-json.png" });
    expect(props.description.length).toBeGreaterThan(40);
    expect(props.schema[0]).toMatchObject({ "@type": "WebApplication", url: "https://louisyoung.co.uk/tools/json/" });
    expect(props.schema[1].itemListElement.map((item) => item.name)).toEqual([
      "Louis Young",
      "Tools",
      "JSON formatter",
    ]);
  });
});
