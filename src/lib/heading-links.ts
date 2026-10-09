import type { Element, ElementContent } from "hast";
import type { Options } from "rehype-autolink-headings";

import { useTranslations } from "../i18n";

/** The text a heading reads as, ignoring markup. */
export const textOf = (node: ElementContent): string => {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
};

/**
 * Options for rehype-autolink-headings: every h2–h4 gets a "#" link to itself after its text,
 * named "Link to section: …" for assistive technology. The link is empty and the "#" is drawn
 * in CSS, so the glyph stays out of the table of contents, search excerpts and copied text.
 */
export const headingLinkOptions = (t = useTranslations()): Options => ({
  behavior: "append",
  test: ["h2", "h3", "h4"],
  content: [],
  properties: (heading: Element) => ({
    className: ["heading-anchor"],
    ariaLabel: t("article.linkToSection", { heading: heading.children.map(textOf).join("").trim() }),
  }),
});
