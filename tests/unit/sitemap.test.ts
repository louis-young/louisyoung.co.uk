import { describe, expect, it } from "vitest";

import { contentPath, isListed, pageInfo, readContentIndex, withLastmod } from "../../src/lib/sitemap";

describe("pageInfo", () => {
  it("prefers updated over date and reads drafts", () => {
    expect(pageInfo('---\ntitle: "A"\ndate: "2021-02-18"\nupdated: "2026-10-07"\n---\nBody')).toEqual({
      lastmod: new Date("2026-10-07T00:00:00Z"),
      draft: false,
    });
    expect(pageInfo("---\nupdated: 2026-10-08\n# A comment\ndraft: true # until filled in\n---\n")).toEqual({
      lastmod: new Date("2026-10-08T00:00:00Z"),
      draft: true,
    });
  });

  it("copes with no frontmatter or no usable date", () => {
    expect(pageInfo("No frontmatter")).toEqual({ lastmod: undefined, draft: false });
    expect(pageInfo('---\nyear: "[YYYY]"\ndate: "[Date]"\n---')).toEqual({ lastmod: undefined, draft: false });
  });
});

describe("content index", () => {
  const index = readContentIndex(new URL("../../content/", import.meta.url));

  it("maps collections to their URLs", () => {
    expect(contentPath("articles", "a")).toBe("/a/");
    expect(contentPath("pages", "now")).toBe("/now/");
    expect(contentPath("work", "b")).toBe("/work/b/");
  });

  it("indexes articles, case studies and pages", () => {
    expect(index.get("/why-functional-state-updates-are-important/")?.lastmod).toBeInstanceOf(Date);
    expect(index.has("/now/")).toBe(true);
    expect([...index.keys()].some((path) => path.startsWith("/work/"))).toBe(true);
  });

  it("lists published pages and keeps drafts and the design page out", () => {
    const drafts = [...index].filter(([, info]) => info.draft).map(([path]) => path);
    for (const path of drafts) expect(isListed(index, `https://louisyoung.co.uk${path}`)).toBe(false);
    expect(isListed(index, "https://louisyoung.co.uk/design/")).toBe(false);
    expect(isListed(index, "https://louisyoung.co.uk/changelog/")).toBe(true);
    expect(isListed(index, "https://louisyoung.co.uk/why-functional-state-updates-are-important/")).toBe(true);
  });

  it("adds lastmod only where a date is known", () => {
    const article = withLastmod(index, { url: "https://louisyoung.co.uk/handling-protected-routes-react-router/" });
    expect(article).toEqual({
      url: "https://louisyoung.co.uk/handling-protected-routes-react-router/",
      lastmod: "2026-10-07T00:00:00.000Z",
    });
    const tools = { url: "https://louisyoung.co.uk/tools/" };
    expect(withLastmod(index, tools)).toBe(tools);
  });
});
