import { describe, expect, it } from "vitest";

import { slugify, template } from "../../scripts/new-article";

describe("new article scaffold", () => {
  it.each([
    ["Why functional state updates are important", "why-functional-state-updates-are-important"],
    ["  React 19: the `use` hook!  ", "react-19-the-use-hook"],
    ["Crème brûlée & café", "creme-brulee-cafe"],
  ])("slugifies %j", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it("creates a draft with escaped frontmatter", () => {
    const source = template('A "quoted" title', "2026-10-07");
    expect(source).toContain('title: "A \\"quoted\\" title"');
    expect(source).toContain("draft: true");
    expect(source).toContain('date: "2026-10-07"');
  });
});
