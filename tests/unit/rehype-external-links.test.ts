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

  it("says so to assistive technology, in visually hidden text kept out of search", () => {
    const anchor = link("https://developer.mozilla.org/", {});
    anchor.children.push({ type: "text", value: "MDN" });
    run(anchor);
    expect(anchor.children).toEqual([
      { type: "text", value: "MDN" },
      {
        type: "element",
        tagName: "span",
        properties: { className: ["visually-hidden"], dataPagefindIgnore: "" },
        children: [{ type: "text", value: " (opens external site)" }],
      },
    ]);
  });

  it("takes the label as an option", () => {
    const anchor = link("https://example.com/");
    rehypeExternalLinks({ label: "(external)" })({ type: "root", children: [anchor] });
    expect(anchor.children.at(-1)).toMatchObject({ children: [{ type: "text", value: " (external)" }] });
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
