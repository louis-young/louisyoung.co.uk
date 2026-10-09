import { describe, expect, it } from "vitest";

import { newest, newestFirst } from "../../src/lib/latest";

const at = (iso: string) => new Date(iso);

describe("newest", () => {
  it("picks the item with the latest date", () => {
    const items = [
      { id: "a", on: "2026-01-02" },
      { id: "b", on: "2026-03-01" },
      { id: "c", on: "2025-12-31" },
    ];
    expect(newest(items, (item) => at(item.on))?.id).toBe("b");
  });

  it("lets the one listed last win a tie", () => {
    const items = [
      { id: "a", on: "2026-01-02" },
      { id: "b", on: "2026-01-02" },
    ];
    expect(newest(items, (item) => at(item.on))?.id).toBe("b");
  });

  it("compares instants, not wall-clock text", () => {
    const items = [
      { id: "bst", on: "2026-10-09T02:43:47+01:00" },
      { id: "utc", on: "2026-10-09T02:41:45+00:00" },
    ];
    expect(newest(items, (item) => at(item.on))?.id).toBe("utc");
  });

  it("returns undefined for an empty list", () => {
    expect(newest<{ on: string }>([], (item) => at(item.on))).toBeUndefined();
  });
});

describe("newestFirst", () => {
  it("drops missing entries and sorts newest first, stable on ties", () => {
    const items = [
      { id: "old", date: at("2021-02-19") },
      undefined,
      { id: "new", date: at("2026-10-09") },
      { id: "tie", date: at("2021-02-19") },
    ];
    expect(newestFirst(items).map((item) => item.id)).toEqual(["new", "old", "tie"]);
  });
});
