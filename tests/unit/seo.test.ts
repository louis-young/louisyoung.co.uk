import { describe, expect, it } from "vitest";

import { absoluteUrl, articleSchema, jsonLd, websiteSchema } from "../../src/lib/seo";
import { emphasise } from "../../src/lib/text";

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
    expect(breadcrumb?.itemListElement).toHaveLength(2);
  });
});

describe("emphasise", () => {
  it("escapes HTML and converts *markers* to <em>", () => {
    expect(emphasise("Notes on *React* & <b>")).toBe("Notes on <em>React</em> &amp; &lt;b&gt;");
  });
});
