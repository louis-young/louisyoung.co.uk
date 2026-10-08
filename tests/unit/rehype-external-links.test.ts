import type { Element, Root } from "hast";
import { describe, expect, it } from "vitest";

import { rehypeExternalLinks } from "../../src/lib/rehype-external-links";

const link = (href: string, extra: Element["properties"] = {}): Element => ({
  type: "element",
  tagName: "a",
  properties: { href, ...extra },
  children: [],
});

const run = (...nodes: Element[]) => {
  const tree: Root = { type: "root", children: nodes };
  rehypeExternalLinks()(tree);
  return nodes.map((node) => node.properties);
};

describe("rehypeExternalLinks", () => {
  it("marks off-site links and strips target", () => {
    const [properties] = run(link("https://developer.mozilla.org/", { target: "_blank" }));
    expect(properties).toMatchObject({ rel: ["noopener", "noreferrer"], dataExternal: "" });
    expect(properties).not.toHaveProperty("target");
  });

  it("leaves internal, relative and anchor links alone", () => {
    for (const properties of run(link("https://louisyoung.co.uk/a/"), link("/tags/"), link("#intro"))) {
      expect(properties).not.toHaveProperty("dataExternal");
    }
  });

  it("ignores non-anchor elements", () => {
    const image: Element = { type: "element", tagName: "img", properties: { src: "https://x.y/z.png" }, children: [] };
    run(image);
    expect(image.properties).toEqual({ src: "https://x.y/z.png" });
  });
});
