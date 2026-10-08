import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { buildAtom, buildJsonFeed, buildRss, escapeXml, type FeedItem, type FeedMeta } from "../../src/lib/feeds";

const meta: FeedMeta = {
  title: "Louis Young",
  description: "Writing & notes <about> the web",
  siteUrl: "https://louisyoung.co.uk/",
  feedUrl: "https://louisyoung.co.uk/rss.xml",
  author: { name: "Louis Young" },
  language: "en-GB",
};

const items: FeedItem[] = [
  {
    title: "Second & newest",
    description: 'Uses "quotes" and <tags>',
    url: "https://louisyoung.co.uk/second/",
    published: new Date("2021-03-01T00:00:00Z"),
    updated: new Date("2022-01-01T00:00:00Z"),
    tags: ["react", "hooks"],
  },
  {
    title: "First",
    description: "The first article",
    url: "https://louisyoung.co.uk/first/",
    published: new Date("2021-02-01T00:00:00Z"),
    tags: ["javascript"],
  },
];

const parseXml = (xml: string) => {
  const document = new new JSDOM("").window.DOMParser().parseFromString(xml, "application/xml");
  expect(document.querySelector("parsererror")).toBeNull();
  return document;
};

describe("escapeXml", () => {
  it("escapes the five XML special characters", () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;",
    );
  });
});

describe("RSS", () => {
  const document = parseXml(buildRss(meta, items));

  it("is well-formed with one item per article", () => {
    expect(document.querySelectorAll("item")).toHaveLength(2);
  });

  it("round-trips escaped text", () => {
    expect(document.querySelector("item > title")?.textContent).toBe("Second & newest");
    expect(document.querySelector("item > description")?.textContent).toBe('Uses "quotes" and <tags>');
    expect(document.querySelector("channel > description")?.textContent).toBe(meta.description);
  });

  it("uses RFC 822 dates and the latest change as lastBuildDate", () => {
    expect(document.querySelector("item > pubDate")?.textContent).toBe("Mon, 01 Mar 2021 00:00:00 GMT");
    expect(document.querySelector("lastBuildDate")?.textContent).toBe("Sat, 01 Jan 2022 00:00:00 GMT");
  });

  it("includes categories and a self link", () => {
    expect([...document.querySelectorAll("item:first-of-type > category")].map((node) => node.textContent)).toEqual([
      "react",
      "hooks",
    ]);
    expect(document.querySelector("channel > *|link[rel=self]")?.getAttribute("href")).toBe(meta.feedUrl);
  });
});

describe("Atom", () => {
  const document = parseXml(buildAtom(meta, items));

  it("is well-formed with ISO dates", () => {
    expect(document.querySelectorAll("entry")).toHaveLength(2);
    expect(document.querySelector("entry > updated")?.textContent).toBe("2022-01-01T00:00:00.000Z");
    expect(document.querySelectorAll("entry")[1]?.querySelector("updated")?.textContent).toBe(
      "2021-02-01T00:00:00.000Z",
    );
  });

  it("declares the feed language", () => {
    expect(document.documentElement.getAttribute("xml:lang")).toBe("en-GB");
  });
});

describe("JSON Feed", () => {
  const feed = JSON.parse(buildJsonFeed(meta, items)) as Record<string, unknown> & { items: Record<string, unknown>[] };

  it("follows JSON Feed 1.1", () => {
    expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]).toMatchObject({ id: items[0]!.url, date_modified: "2022-01-01T00:00:00.000Z" });
    expect(feed.items[1]).not.toHaveProperty("date_modified");
  });

  it("handles an empty feed", () => {
    expect(JSON.parse(buildJsonFeed(meta, []))).toMatchObject({ items: [] });
    parseXml(buildRss(meta, []));
  });
});
