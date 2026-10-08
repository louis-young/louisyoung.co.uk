import { describe, expect, it } from "vitest";

import { buildToc } from "../../src/lib/toc";

const heading = (depth: number, slug: string) => ({ depth, slug, text: slug });

describe("buildToc", () => {
  it("nests h3s under the preceding h2", () => {
    const toc = buildToc([heading(2, "a"), heading(3, "a1"), heading(3, "a2"), heading(2, "b")]);
    expect(toc.map((item) => item.slug)).toEqual(["a", "b"]);
    expect(toc[0]?.children.map((item) => item.slug)).toEqual(["a1", "a2"]);
    expect(toc[1]?.children).toEqual([]);
  });

  it("ignores headings outside the depth range", () => {
    expect(buildToc([heading(1, "title"), heading(2, "a"), heading(4, "deep")]).map((item) => item.slug)).toEqual([
      "a",
    ]);
  });

  it("promotes an h3 that has no parent instead of dropping it", () => {
    expect(buildToc([heading(3, "orphan"), heading(2, "a")]).map((item) => item.slug)).toEqual(["orphan", "a"]);
  });

  it("supports a custom depth range", () => {
    const toc = buildToc([heading(2, "a"), heading(3, "b"), heading(4, "c")], { minDepth: 3, maxDepth: 4 });
    expect(toc.map((item) => item.slug)).toEqual(["b"]);
    expect(toc[0]?.children.map((item) => item.slug)).toEqual(["c"]);
  });

  it("returns an empty list for no headings", () => {
    expect(buildToc([])).toEqual([]);
  });
});
