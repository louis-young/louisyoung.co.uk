import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

const isExternal = (href: string, siteHost: string) => {
  if (!/^https?:\/\//u.test(href)) return false;
  return new URL(href).host !== siteHost;
};

/**
 * Marks absolute links to other hosts as external so they get safe `rel` values and the
 * ↗ affordance in CSS. Links open in the same tab; readers decide where links go.
 */
export const rehypeExternalLinks =
  (options: { siteHost?: string } = {}) =>
  (tree: Root) => {
    const siteHost = options.siteHost ?? "louisyoung.co.uk";
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      const href = node.properties.href;
      if (typeof href !== "string" || !isExternal(href, siteHost)) return;
      delete node.properties.target;
      node.properties.rel = ["noopener", "noreferrer"];
      node.properties.dataExternal = "";
    });
  };
