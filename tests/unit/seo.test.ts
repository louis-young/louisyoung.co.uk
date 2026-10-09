import { describe, expect, it } from "vitest";

import {
  absoluteUrl,
  articleSchema,
  breadcrumbSchema,
  codeSnippetSchema,
  describeList,
  itemListSchema,
  jsonLd,
  toolSchema,
  websiteSchema,
} from "../../src/lib/seo";
import { emphasise, queryFromPath } from "../../src/lib/text";

describe("seo", () => {
  it("builds absolute URLs on the canonical origin", () => {
    expect(absoluteUrl("/og/index.png")).toBe("https://louisyoung.co.uk/og/index.png");
  });

  it("escapes < in JSON-LD so content cannot close the script element", () => {
    const serialised = jsonLd({ headline: "</script><script>alert(1)</script>" });
    expect(serialised).not.toContain("</script>");
    expect(JSON.parse(serialised)).toEqual({ headline: "</script><script>alert(1)</script>" });
  });

  it("describes the website and author", () => {
    expect(websiteSchema()).toMatchObject({ "@type": "WebSite", url: "https://louisyoung.co.uk", inLanguage: "en-GB" });
    expect(websiteSchema().author.sameAs).toContain("https://github.com/louis-young");
  });

  it("describes an article with a breadcrumb and falls back to the publish date", () => {
    const published = new Date("2021-02-15T00:00:00Z");
    const [posting, breadcrumb] = articleSchema({
      title: "Title",
      description: "Description",
      url: "https://louisyoung.co.uk/a/",
      image: "https://louisyoung.co.uk/og/a.png",
      published,
      tags: ["react", "hooks"],
    });
    expect(posting).toMatchObject({
      "@type": "BlogPosting",
      datePublished: published.toISOString(),
      dateModified: published.toISOString(),
      keywords: "react, hooks",
    });
    expect(breadcrumb.itemListElement).toHaveLength(2);
  });

  it("puts an article's section in its breadcrumb", () => {
    const [, breadcrumb] = articleSchema({
      title: "Title",
      description: "Description",
      url: "https://louisyoung.co.uk/a/",
      image: "https://louisyoung.co.uk/og/a.png",
      published: new Date("2021-02-15T00:00:00Z"),
      tags: ["react"],
      section: { name: "Writing", path: "/writing/" },
    });
    expect(breadcrumb.itemListElement.map((item) => item.item)).toEqual([
      "https://louisyoung.co.uk/",
      "https://louisyoung.co.uk/writing/",
      "https://louisyoung.co.uk/a/",
    ]);
  });

  it("builds breadcrumbs from the home page", () => {
    expect(breadcrumbSchema([{ name: "Tools", path: "/tools/" }])).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Louis Young", item: "https://louisyoung.co.uk/" },
        { "@type": "ListItem", position: 2, name: "Tools", item: "https://louisyoung.co.uk/tools/" },
      ],
    });
  });

  it("describes a tool as a free WebApplication", () => {
    const [app, breadcrumb] = toolSchema({
      name: "JSON formatter",
      description: "Validate JSON.",
      path: "/tools/json/",
      image: "/og/tools-json.png",
      section: { name: "Tools", path: "/tools/" },
    });
    expect(app).toMatchObject({
      "@type": "WebApplication",
      url: "https://louisyoung.co.uk/tools/json/",
      image: "https://louisyoung.co.uk/og/tools-json.png",
      applicationCategory: "DeveloperApplication",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0" },
    });
    expect(app).toHaveProperty("browserRequirements");
    expect(breadcrumb).toMatchObject({ "@type": "BreadcrumbList" });
    expect(JSON.stringify(breadcrumb)).toContain("https://louisyoung.co.uk/tools/json/");
  });

  it("describes a snippet as SoftwareSourceCode with a breadcrumb through its section", () => {
    const [code, breadcrumb] = codeSnippetSchema({
      title: "Exhaustive switch statements",
      description: "A never helper.",
      path: "/snippets/exhaustive-switch/",
      image: "/og/snippets-exhaustive-switch.png",
      language: "TypeScript",
      published: new Date("2026-09-14T00:00:00Z"),
      tags: ["typescript", "patterns"],
      section: { name: "Snippets", path: "/snippets/" },
    });
    expect(code).toMatchObject({
      "@type": "SoftwareSourceCode",
      url: "https://louisyoung.co.uk/snippets/exhaustive-switch/",
      image: "https://louisyoung.co.uk/og/snippets-exhaustive-switch.png",
      programmingLanguage: "TypeScript",
      datePublished: "2026-09-14T00:00:00.000Z",
      dateModified: "2026-09-14T00:00:00.000Z",
      keywords: "typescript, patterns",
    });
    expect(breadcrumb.itemListElement.map((item) => item.item)).toEqual([
      "https://louisyoung.co.uk/",
      "https://louisyoung.co.uk/snippets/",
      "https://louisyoung.co.uk/snippets/exhaustive-switch/",
    ]);
    const [updated] = codeSnippetSchema({
      title: "T",
      description: "D",
      path: "/snippets/t/",
      image: "/og/t.png",
      language: "CSS",
      published: new Date("2026-09-14T00:00:00Z"),
      updated: new Date("2026-10-01T00:00:00Z"),
      tags: [],
      section: { name: "Snippets", path: "/snippets/" },
    });
    expect(updated.dateModified).toBe("2026-10-01T00:00:00.000Z");
  });

  it("lists pages in order", () => {
    const list = itemListSchema({
      name: "Tools",
      description: "Small tools",
      path: "/tools/",
      items: [
        { name: "A", path: "/tools/a/" },
        { name: "B", path: "/tools/b/" },
      ],
    });
    expect(list).toMatchObject({ "@type": "ItemList", numberOfItems: 2, url: "https://louisyoung.co.uk/tools/" });
    expect(list.itemListElement[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "B",
      url: "https://louisyoung.co.uk/tools/b/",
    });
  });

  it("describes a list without running past the limit", () => {
    expect(describeList("2 articles tagged “react”", ["One", "Two"])).toBe("2 articles tagged “react”: One, Two.");
    expect(describeList("Lead", ["a".repeat(10), "b".repeat(10)], 25)).toBe(`Lead: ${"a".repeat(10)}…`);
    expect(describeList("Lead", ["a".repeat(30)], 25)).toBe("Lead.");
    expect(describeList("Lead", [])).toBe("Lead.");
  });
});

describe("emphasise", () => {
  it("escapes HTML and converts *markers* to <em>", () => {
    expect(emphasise("Notes on *React* & <b>")).toBe("Notes on <em>React</em> &amp; &lt;b&gt;");
  });
});

describe("queryFromPath", () => {
  it.each([
    ["/react-hooks_guide/", "react hooks guide"],
    ["/writing/old-post.html", "old post"],
    ["/caf%C3%A9-notes", "café notes"],
    ["/%E0%A4%A", "%E0%A4%A"],
    ["/404/", ""],
    ["/", ""],
  ])("%s searches for “%s”", (path, query) => {
    expect(queryFromPath(path)).toBe(query);
  });
});
