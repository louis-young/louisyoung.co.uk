import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";

import Footer from "../../src/components/Footer.astro";
import Header from "../../src/components/Header.astro";
import Callout from "../../src/components/mdx/Callout.astro";
import Demo from "../../src/components/mdx/Demo.astro";
import Sandbox from "../../src/components/mdx/Sandbox.astro";
import ShortcutsDialog from "../../src/components/ShortcutsDialog.astro";
import ThemeToggle from "../../src/components/ThemeToggle.astro";
import Toc from "../../src/components/Toc.astro";

/**
 * Renders UI chrome with the pseudo-locale. Any visible or announced string that is not
 * wrapped in ⟦…⟧ was hard-coded rather than translated.
 */
const allowed = new Set(["Louis Young", "LY", "RSS", "Atom", "JSON Feed", "GitHub", "LinkedIn", "X", "?", "/", "t"]);

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

const untranslated = (html: string) => {
  const { document, NodeFilter } = new JSDOM(`<body>${html}</body>`).window;
  for (const element of document.querySelectorAll("script, style")) element.remove();
  const strings: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) strings.push(walker.currentNode.textContent ?? "");
  for (const element of document.querySelectorAll("[aria-label], [title], [data-label-light], [placeholder]")) {
    for (const attribute of [
      "aria-label",
      "title",
      "placeholder",
      "data-label-light",
      "data-label-dark",
      "data-label-system",
    ]) {
      const value = element.getAttribute(attribute);
      if (value) strings.push(value);
    }
  }
  return strings
    .map((value) => value.trim())
    .filter((value) => /\p{L}/u.test(value))
    .filter((value) => !allowed.has(value) && !value.includes("⟦"))
    .filter((value) => !/^(?:Louis Young, )?⟦/u.test(value));
};

const cases = [
  ["Header", Header, {}],
  ["Footer", Footer, {}],
  ["ShortcutsDialog", ShortcutsDialog, {}],
  ["ThemeToggle", ThemeToggle, {}],
  ["Callout", Callout, {}],
  ["Demo", Demo, { props: { title: "⟦Demo⟧" } }],
  ["Sandbox", Sandbox, { props: { id: "abc", title: "⟦Sandbox⟧" } }],
  [
    "Toc",
    Toc,
    {
      props: {
        items: [
          { depth: 2, slug: "a", text: "⟦A⟧", children: [] },
          { depth: 2, slug: "b", text: "⟦B⟧", children: [] },
        ],
      },
    },
  ],
] as const;

describe("UI strings are translatable", () => {
  it.each(cases)("%s has no hard-coded strings", async (_name, component, options) => {
    const html = await container.renderToString(component, { ...options, locals: { locale: "en-XA" } });
    expect(untranslated(html)).toEqual([]);
  });
});
