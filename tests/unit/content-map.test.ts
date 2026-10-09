import { describe, expect, it } from "vitest";

import {
  buildContentGraph,
  countKinds,
  filterKindOf,
  isHub,
  listGroups,
  neighbours,
  type ContentMapInput,
} from "../../src/lib/content-map";

const input: ContentMapInput = {
  articles: [
    { slug: "hooks-intro", title: "Hooks intro", tags: ["react", "hooks"] },
    { slug: "a-state", title: "A state article", tags: ["react", "state", "react"] },
  ],
  snippets: [
    { slug: "focus-ring", title: "Focus ring", tags: ["css", "accessibility"] },
    { slug: "debounce", title: "Debounce", tags: ["typescript", "react"] },
  ],
  tools: [
    { slug: "json-to-ts", title: "JSON to TypeScript", category: "text", keywords: "typescript interface ts" },
    { slug: "clamp", title: "Clamp", category: "css", keywords: "fluid type CSS" },
    { slug: "units", title: "Units", category: "css", keywords: "px rem" },
    // "a11y" is not the accessibility tag, so no connection is inferred.
    { slug: "contrast", title: "Contrast", category: "colour", keywords: "wcag a11y" },
  ],
  categories: [
    { id: "colour", label: "Colour" },
    { id: "css", label: "CSS" },
    { id: "text", label: "Text" },
    { id: "web", label: "Web" },
  ],
};

describe("buildContentGraph", () => {
  const graph = buildContentGraph(input);
  const ids = graph.nodes.map((node) => node.id);
  const edgeKeys = graph.edges.map((edge) => `${edge.source}>${edge.target}`);

  it("makes a topic for every tag, busiest first, then categories, articles, snippets and tools", () => {
    expect(ids).toEqual([
      "topic:react",
      "topic:css",
      "topic:typescript",
      "topic:accessibility",
      "topic:hooks",
      "topic:state",
      "category:colour",
      "category:css",
      "category:text",
      "article:a-state",
      "article:hooks-intro",
      "snippet:debounce",
      "snippet:focus-ring",
      "tool:clamp",
      "tool:contrast",
      "tool:json-to-ts",
      "tool:units",
    ]);
  });

  it("leaves out categories with no tools", () => {
    expect(ids).not.toContain("category:web");
  });

  it("links items to their tags once, and tools to categories and word-for-word keyword topics", () => {
    expect(edgeKeys.filter((key) => key === "article:a-state>topic:react")).toHaveLength(1);
    expect(edgeKeys).toContain("snippet:debounce>topic:typescript");
    expect(edgeKeys).toContain("tool:json-to-ts>category:text");
    expect(edgeKeys).toContain("tool:json-to-ts>topic:typescript");
    expect(edgeKeys).toContain("tool:clamp>topic:css");
    expect(edgeKeys).not.toContain("tool:contrast>topic:accessibility");
    expect(edgeKeys.filter((key) => key.startsWith("tool:units>"))).toEqual(["tool:units>category:css"]);
    // Every edge runs from an item to a hub.
    for (const edge of graph.edges) {
      expect(isHub(graph.nodes.find((node) => node.id === edge.source)!.kind)).toBe(false);
      expect(isHub(graph.nodes.find((node) => node.id === edge.target)!.kind)).toBe(true);
    }
  });

  it("counts degree and links each node to its page", () => {
    const node = (id: string) => graph.nodes.find((item) => item.id === id)!;
    expect(node("topic:react")).toMatchObject({ degree: 3, href: "/tags/react/", label: "react" });
    expect(node("topic:css")).toMatchObject({ degree: 2, href: "/snippets/?tag=css" });
    expect(node("category:css")).toMatchObject({ degree: 2, href: "/tools/#tools-group-css", label: "CSS" });
    expect(node("article:hooks-intro").href).toBe("/hooks-intro/");
    expect(node("snippet:debounce").href).toBe("/snippets/debounce/");
    expect(node("tool:clamp")).toMatchObject({ href: "/tools/clamp/", degree: 2 });
  });

  it("handles empty input", () => {
    expect(buildContentGraph({ articles: [], snippets: [], tools: [], categories: [] })).toEqual({
      nodes: [],
      edges: [],
    });
  });
});

describe("graph helpers", () => {
  const graph = buildContentGraph(input);

  it("lists neighbours in node order", () => {
    expect(neighbours(graph).get("topic:react")).toEqual([
      "article:a-state",
      "article:hooks-intro",
      "snippet:debounce",
    ]);
    expect(neighbours(graph).get("tool:json-to-ts")).toEqual(["topic:typescript", "category:text"]);
  });

  it("groups items under every hub they link to", () => {
    const groups = listGroups(graph);
    expect(groups.map((group) => group.hub.id)).toEqual(
      graph.nodes.filter((node) => isHub(node.kind)).map((n) => n.id),
    );
    const typescript = groups.find((group) => group.hub.id === "topic:typescript")!;
    expect(typescript.snippets.map((node) => node.id)).toEqual(["snippet:debounce"]);
    expect(typescript.tools.map((node) => node.id)).toEqual(["tool:json-to-ts"]);
    expect(typescript.articles).toEqual([]);
    // Every edge appears in the list exactly once.
    const listed = groups.reduce(
      (sum, group) => sum + group.articles.length + group.snippets.length + group.tools.length,
      0,
    );
    expect(listed).toBe(graph.edges.length);
  });

  it("counts kinds and maps categories onto the tools filter", () => {
    expect(countKinds(graph)).toEqual({ topic: 6, article: 2, snippet: 2, category: 3, tool: 4 });
    expect(filterKindOf("category")).toBe("tool");
    expect(filterKindOf("article")).toBe("article");
  });
});
