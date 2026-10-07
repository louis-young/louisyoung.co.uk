import { describe, expect, it } from "vitest";

import {
  articlePath,
  byNewest,
  getAdjacent,
  getRelated,
  getTags,
  groupByYear,
  isPublished,
} from "../../src/lib/articles";

const article = (id: string, date: string, tags: string[] = [], draft = false) =>
  ({ id, data: { date: new Date(date), tags, draft } }) as never as Parameters<typeof isPublished>[0] & {
    id: string;
    data: { date: Date; tags: string[]; draft: boolean };
  };

const a = article("a", "2021-02-01", ["react", "hooks"]);
const b = article("b", "2021-03-01", ["react"]);
const c = article("c", "2022-01-01", ["javascript"]);
const d = article("d", "2023-01-01", ["react", "hooks", "state"]);
const newestFirst = [d, c, b, a];

describe("articles", () => {
  it("sorts newest first", () => {
    expect([a, c, b, d].sort(byNewest).map((item) => item.id)).toEqual(["d", "c", "b", "a"]);
  });

  it("builds trailing-slash paths matching the legacy URLs", () => {
    expect(articlePath({ id: "why-functional-state-updates-are-important" })).toBe(
      "/why-functional-state-updates-are-important/",
    );
  });

  it("hides drafts unless drafts are included", () => {
    const draft = article("e", "2024-01-01", ["react"], true);
    expect(isPublished(draft, false)).toBe(false);
    expect(isPublished(draft, true)).toBe(true);
    expect(isPublished(a, false)).toBe(true);
  });

  it("finds the older (previous) and newer (next) neighbours", () => {
    expect(getAdjacent(newestFirst, "c")).toEqual({ previous: b, next: d });
    expect(getAdjacent(newestFirst, "d")).toEqual({ previous: c, next: undefined });
    expect(getAdjacent(newestFirst, "a")).toEqual({ previous: undefined, next: b });
    expect(getAdjacent(newestFirst, "missing")).toEqual({ previous: undefined, next: undefined });
  });

  it("ranks related articles by shared tags, then recency, excluding itself", () => {
    expect(getRelated(newestFirst, a).map((item) => item.id)).toEqual(["d", "b"]);
    expect(getRelated(newestFirst, a, 1).map((item) => item.id)).toEqual(["d"]);
    expect(getRelated(newestFirst, c)).toEqual([]);
  });

  it("counts tags, most used first then alphabetically", () => {
    expect(getTags(newestFirst)).toEqual([
      { tag: "react", count: 3 },
      { tag: "hooks", count: 2 },
      { tag: "javascript", count: 1 },
      { tag: "state", count: 1 },
    ]);
  });

  it("groups by year, newest year first", () => {
    expect(groupByYear(newestFirst).map(([year, items]) => [year, items.map((item) => item.id)])).toEqual([
      [2023, ["d"]],
      [2022, ["c"]],
      [2021, ["b", "a"]],
    ]);
  });
});
