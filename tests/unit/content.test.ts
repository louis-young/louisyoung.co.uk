import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { reservedSlugs } from "../../src/content.config";

const root = new URL("../../content/articles/", import.meta.url).pathname;
const slugs = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

/** Strips fenced code so code samples don't trip prose rules. */
const prose = (source: string) => source.replace(/```[\s\S]*?```/gu, "");

const legacySlugs = [
  "handling-protected-routes-react-router",
  "how-to-build-article-progress-indicator-react",
  "how-to-fetch-data-from-backend-react",
  "how-to-prevent-derived-state-react",
  "implicit-explicit-returns-javascript",
  "patterns-to-destructure-props-in-react-components",
  "utilising-context-api-react",
  "why-functional-state-updates-are-important",
];

describe("content", () => {
  it("still contains every article that has ever been published, so no URL breaks", () => {
    expect(slugs).toEqual(expect.arrayContaining(legacySlugs));
  });

  describe.each(slugs)("%s", (slug) => {
    const path = join(root, slug, "index.mdx");
    const source = existsSync(path) ? readFileSync(path, "utf8") : "";
    const body = prose(source.slice(source.indexOf("---", 3) + 3));

    it("has an index.mdx", () => {
      expect(existsSync(path)).toBe(true);
    });

    it("uses a kebab-case slug that doesn't collide with a route", () => {
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
      expect(reservedSlugs).not.toContain(slug);
    });

    it("doesn't hand-write a table of contents (it is generated)", () => {
      expect(body).not.toMatch(/^#+ Table of contents/imu);
    });

    it("starts sections at h2 and never skips a heading level", () => {
      const levels = [...body.matchAll(/^(#{1,6}) /gmu)].map(([, hashes]) => hashes!.length);
      expect(levels).not.toContain(1);
      levels.forEach((level, index) => {
        expect(level - (levels[index - 1] ?? 1), `heading ${index + 1}`).toBeLessThanOrEqual(1);
      });
    });

    it("uses Markdown links and components instead of raw HTML", () => {
      expect(body).not.toMatch(/<a\s/u);
      expect(body).not.toMatch(/<iframe/u);
      expect(body).not.toMatch(/target="_blank"/u);
      expect(body).not.toMatch(/style="/u);
    });

    it("gives every image alt text", () => {
      for (const [, alt] of body.matchAll(/!\[([^\]]*)\]\(/gu)) expect(alt?.trim()).not.toBe("");
    });

    it("links only to anchors that exist in the article", () => {
      const slugify = (text: string) =>
        text
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s-]/gu, "")
          .trim()
          .replace(/\s/gu, "-");
      const anchors = new Set([...body.matchAll(/^#{2,6} (.+)$/gmu)].map(([, text]) => slugify(text!)));
      for (const [, anchor] of body.matchAll(/\]\(#([^)]+)\)/gu)) expect(anchors, `#${anchor}`).toContain(anchor);
    });

    it("uses https for external links", () => {
      expect(body).not.toMatch(/\]\(http:\/\//u);
    });
  });
});
