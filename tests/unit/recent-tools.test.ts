import { describe, expect, it } from "vitest";

import { addRecent, parseRecent, RECENT_LIMIT } from "../../src/lib/recent-tools";

describe("recent tools", () => {
  it("moves a visited tool to the front, once, keeping the newest few", () => {
    expect(addRecent([], "json")).toEqual(["json"]);
    expect(addRecent(["regex", "json"], "json")).toEqual(["json", "regex"]);
    expect(addRecent(["a", "b", "c", "d"], "e")).toEqual(["e", "a", "b", "c"]);
    expect(addRecent(["a", "b"], "c", 2)).toEqual(["c", "a"]);
    expect(RECENT_LIMIT).toBe(4);
  });

  it("reads a stored list, dropping duplicates, unknown slugs and junk", () => {
    expect(parseRecent(JSON.stringify(["json", "regex", "json"]))).toEqual(["json", "regex"]);
    expect(parseRecent(JSON.stringify(["json", "gone", "regex"]), ["json", "regex"])).toEqual(["json", "regex"]);
    expect(parseRecent(JSON.stringify(["json", 4, null, "<b>", "Bad Slug"]))).toEqual(["json"]);
    expect(parseRecent(JSON.stringify(["a", "b", "c", "d", "e"]))).toEqual(["a", "b", "c", "d"]);
  });

  it("treats missing or malformed storage as empty", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("")).toEqual([]);
    expect(parseRecent("{not json")).toEqual([]);
    expect(parseRecent('{"json":true}')).toEqual([]);
  });
});
