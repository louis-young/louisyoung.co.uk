import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const { headers: rules } = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
  headers: HeaderRule[];
};

const cacheControl = (rule: HeaderRule) => rule.headers.find(({ key }) => key.toLowerCase() === "cache-control")?.value;

describe("cache headers", () => {
  it("cache hashed build assets (scripts, styles, fonts, images) for a year, immutably", () => {
    const assets = rules.find(({ source }) => source === "/_astro/(.*)");
    const value = assets && cacheControl(assets);
    expect(value).toMatch(/\bpublic\b/u);
    expect(value).toMatch(/\bimmutable\b/u);
    expect(Number(/max-age=(\d+)/u.exec(value ?? "")?.[1])).toBeGreaterThanOrEqual(31_536_000);
  });

  it("never mark unhashed files (pages, feeds, OG images) immutable", () => {
    const immutable = rules.filter((rule) => cacheControl(rule)?.includes("immutable")).map(({ source }) => source);
    expect(immutable).toEqual(["/_astro/(.*)"]);
  });
});
