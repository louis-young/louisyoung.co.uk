import { describe, expect, it } from "vitest";

import { buildContentGraph, type ContentMapInput } from "../../src/lib/content-map";
import {
  edgePath,
  hubText,
  labelBox,
  labelSizeFor,
  layoutGraph,
  nearestInDirection,
  radiusFor,
  seededRandom,
  shapePath,
} from "../../src/lib/graph-layout";

const input: ContentMapInput = {
  articles: Array.from({ length: 8 }, (_, index) => ({
    slug: `article-${index}`,
    title: `Article number ${index}`,
    tags: index % 2 ? ["react", "hooks"] : ["react", "typescript", "patterns"],
  })),
  snippets: Array.from({ length: 5 }, (_, index) => ({
    slug: `snippet-${index}`,
    title: `Snippet ${index}`,
    tags: index % 2 ? ["css", "accessibility"] : ["typescript"],
  })),
  tools: Array.from({ length: 9 }, (_, index) => ({
    slug: `tool-${index}`,
    title: `Tool ${index}`,
    category: ["colour", "css", "text"][index % 3]!,
    keywords: index === 4 ? "fluid css" : "something else",
  })),
  categories: [
    { id: "colour", label: "Colour & design" },
    { id: "css", label: "CSS & layout" },
    { id: "text", label: "Text & data" },
  ],
};

const graph = buildContentGraph(input);

describe("seededRandom", () => {
  it("repeats for a seed, differs between seeds and stays in [0, 1)", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const c = seededRandom(7);
    const first = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(first);
    expect(Array.from({ length: 50 }, () => c())).not.toEqual(first);
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("layoutGraph", () => {
  const layout = layoutGraph(graph);

  it("is deterministic: the same input always gives the same output", () => {
    expect(layoutGraph(buildContentGraph(structuredClone(input)))).toEqual(layout);
    expect(JSON.stringify(layoutGraph(graph))).toBe(JSON.stringify(layout));
  });

  it("changes with the seed", () => {
    expect(layoutGraph(graph, { seed: 1 }).nodes).not.toEqual(layout.nodes);
  });

  it("keeps every node inside the frame and apart from the others", () => {
    expect(layout).toMatchObject({ width: 1000, height: 640 });
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(layout.width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(layout.height);
    }
    for (const [index, a] of layout.nodes.entries()) {
      for (const b of layout.nodes.slice(index + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} and ${b.id}`).toBeGreaterThan(a.r + b.r);
      }
    }
  });

  it("keeps hub labels from overlapping one another", () => {
    const hubs = layout.nodes.filter((node) => node.kind === "topic" || node.kind === "category");
    const boxes = hubs.map((node) => labelBox(hubText(node), node.caption));
    let overlaps = 0;
    for (const [index, a] of boxes.entries()) {
      for (const b of boxes.slice(index + 1)) {
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps += 1;
      }
    }
    expect(overlaps).toBe(0);
  });

  it("draws one path per edge and places item labels on the roomier side", () => {
    expect(layout.edges).toHaveLength(graph.edges.length);
    for (const edge of layout.edges) expect(edge.path).toMatch(/^M[\d.-]+ [\d.-]+Q/u);
    for (const node of layout.nodes.filter((item) => item.kind === "article")) {
      expect(node.caption.anchor).toBe(node.x < layout.width * 0.62 ? "start" : "end");
    }
  });

  it("copes with an empty graph and a single node", () => {
    expect(layoutGraph({ nodes: [], edges: [] }).nodes).toEqual([]);
    const single = layoutGraph({
      nodes: [{ id: "topic:x", kind: "topic", label: "x", href: "/tags/x/", degree: 0 }],
      edges: [{ source: "topic:x", target: "topic:missing" }],
    });
    expect(single.nodes).toHaveLength(1);
    expect(single.edges).toEqual([]);
  });
});

describe("drawing helpers", () => {
  it("sizes hubs by degree and keeps items small", () => {
    expect(radiusFor("topic", 9)).toBeGreaterThan(radiusFor("topic", 1));
    expect(radiusFor("category", 4)).toBeGreaterThan(radiusFor("tool", 4));
    expect(radiusFor("article", 0)).toBe(radiusFor("article", 1));
    expect(labelSizeFor(100)).toBe(18);
  });

  it("gives every kind its own shape", () => {
    const shapes = (["topic", "article", "snippet", "tool"] as const).map((kind) => shapePath(kind, 10));
    expect(new Set(shapes).size).toBe(4);
    expect(shapePath("category", 10)).toBe(shapePath("tool", 10));
    expect(shapePath("topic", 10)).toContain("A");
  });

  it("measures label boxes for each anchor", () => {
    const label = { x: 100, y: 50, size: 10 } as const;
    const start = labelBox("abcd", { ...label, anchor: "start" });
    const end = labelBox("abcd", { ...label, anchor: "end" });
    const middle = labelBox("abcd", { ...label, anchor: "middle" });
    expect(start.left).toBeCloseTo(97);
    expect(end.right).toBeCloseTo(103);
    expect((middle.left + middle.right) / 2).toBeCloseTo(100);
  });

  it("bows edges consistently and prefixes topics with a hash", () => {
    expect(edgePath({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe("M0 0Q50 12 100 0");
    expect(hubText({ kind: "topic", label: "react" })).toBe("#react");
    expect(hubText({ kind: "category", label: "Text" })).toBe("Text");
  });
});

describe("nearestInDirection", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: -5, y: -1 },
    { x: 1, y: -20 },
  ];

  it("moves to the nearest point in each direction, preferring straight ahead", () => {
    expect(nearestInDirection(points, 0, "right")).toBe(1);
    expect(nearestInDirection(points, 0, "left")).toBe(3);
    expect(nearestInDirection(points, 0, "up")).toBe(4);
    expect(nearestInDirection(points, 1, "down")).toBe(2);
  });

  it("stays put when nothing lies that way, or the way is filtered out", () => {
    expect(nearestInDirection(points, 2, "down")).toBe(2);
    expect(nearestInDirection(points, 0, "right", (index) => index !== 1)).toBe(2);
    expect(nearestInDirection(points, 9, "right")).toBe(9);
    // Off to the side, but the only thing that way.
    expect(nearestInDirection(points, 0, "up", (index) => index === 3)).toBe(3);
  });
});
