import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { useTranslations } from "../../src/i18n";
import { toolImage, toolPageProps, toolPath, tools } from "../../src/lib/tool-catalogue";

describe("tool catalogue", () => {
  it("lists every tool page exactly once", () => {
    const pages = readdirSync(new URL("../../src/pages/tools/", import.meta.url))
      .filter((name) => name !== "index.astro")
      .map((name) => name.replace(/\.astro$/u, ""));
    expect(tools.map((tool) => tool.slug).sort()).toEqual(pages.sort());
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
