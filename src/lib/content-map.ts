/**
 * The graph behind /map/: how articles, snippets and tools connect through shared topics. Pure,
 * so the page, the layout and the tests all build it from plain data.
 *
 * Topics (tags) and tool categories are the hubs. Every edge runs from an item to a hub:
 * - an article or snippet links to each of its tags;
 * - a tool links to its category, and to a topic only when that topic's tag appears word for
 *   word in the tool's own search keywords (`json-to-ts` mentions "typescript", so it links to
 *   #typescript). Nothing else is inferred, so the map never shows a connection the content
 *   doesn't make itself.
 */

export type MapKind = "topic" | "article" | "snippet" | "category" | "tool";

/** The kinds the map's filter toggles. Tool categories hide and show with their tools. */
export type FilterKind = Exclude<MapKind, "category">;

export const filterKindOf = (kind: MapKind): FilterKind => (kind === "category" ? "tool" : kind);

export const isHub = (kind: MapKind) => kind === "topic" || kind === "category";

export interface MapNode {
  id: string;
  kind: MapKind;
  label: string;
  href: string;
  /** How many edges touch this node. */
  degree: number;
}

interface MapEdge {
  /** The item. */
  source: string;
  /** The hub it belongs to. */
  target: string;
}

export interface ContentGraph {
  nodes: MapNode[];
  edges: MapEdge[];
}

interface TaggedItem {
  slug: string;
  title: string;
  tags: readonly string[];
}

interface ToolItem {
  slug: string;
  title: string;
  category: string;
  keywords: string;
}

export interface ContentMapInput {
  articles: readonly TaggedItem[];
  snippets: readonly TaggedItem[];
  tools: readonly ToolItem[];
  /** In the order the tools index shows them. */
  categories: readonly { id: string; label: string }[];
}

const nodeId = (kind: MapKind, key: string) => `${kind}:${key}`;

/** Article tags have their own pages; a tag only snippets use opens the filtered snippets index. */
const topicHref = (tag: string, articleTags: ReadonlySet<string>) =>
  articleTags.has(tag) ? `/tags/${tag}/` : `/snippets/?tag=${encodeURIComponent(tag)}`;

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "en");

/**
 * Builds the graph. Nodes come out in a stable reading order: topics (most connected first), tool
 * categories in index order, then articles, snippets and tools alphabetically. The map's Tab
 * order and the tests rely on it.
 */
export const buildContentGraph = (input: ContentMapInput): ContentGraph => {
  const articleTags = new Set(input.articles.flatMap((article) => article.tags));
  const tags = [...new Set([...articleTags, ...input.snippets.flatMap((snippet) => snippet.tags)])];
  const tagSet = new Set(tags);
  const usedCategories = new Set(input.tools.map((tool) => tool.category));

  const edges: MapEdge[] = [
    ...input.articles.flatMap((article) =>
      [...new Set(article.tags)].map((tag) => ({
        source: nodeId("article", article.slug),
        target: nodeId("topic", tag),
      })),
    ),
    ...input.snippets.flatMap((snippet) =>
      [...new Set(snippet.tags)].map((tag) => ({
        source: nodeId("snippet", snippet.slug),
        target: nodeId("topic", tag),
      })),
    ),
    ...input.tools.flatMap((tool) => [
      { source: nodeId("tool", tool.slug), target: nodeId("category", tool.category) },
      ...[...new Set(tool.keywords.toLowerCase().split(/\s+/u))]
        .filter((word) => tagSet.has(word))
        .map((tag) => ({ source: nodeId("tool", tool.slug), target: nodeId("topic", tag) })),
    ]),
  ];

  const degrees = new Map<string, number>();
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  const node = (kind: MapKind, key: string, label: string, href: string): MapNode => ({
    id: nodeId(kind, key),
    kind,
    label,
    href,
    degree: degrees.get(nodeId(kind, key)) ?? 0,
  });

  const topics = tags
    .map((tag) => node("topic", tag, tag, topicHref(tag, articleTags)))
    .sort((a, b) => b.degree - a.degree || byLabel(a, b));
  const categories = input.categories
    .filter((category) => usedCategories.has(category.id))
    .map((category) => node("category", category.id, category.label, `/tools/#tools-group-${category.id}`));
  const items = (kind: MapKind, list: readonly { slug: string; title: string }[], href: (slug: string) => string) =>
    list.map((item) => node(kind, item.slug, item.title, href(item.slug))).sort(byLabel);

  return {
    nodes: [
      ...topics,
      ...categories,
      ...items("article", input.articles, (slug) => `/${slug}/`),
      ...items("snippet", input.snippets, (slug) => `/snippets/${slug}/`),
      ...items("tool", input.tools, (slug) => `/tools/${slug}/`),
    ],
    edges,
  };
};

/** Each node's neighbours, in node order. */
export const neighbours = (graph: ContentGraph) => {
  const order = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const map = new Map<string, string[]>(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) {
    map.get(edge.source)?.push(edge.target);
    map.get(edge.target)?.push(edge.source);
  }
  for (const list of map.values()) list.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  return map;
};

export interface ListGroup {
  hub: MapNode;
  articles: MapNode[];
  snippets: MapNode[];
  tools: MapNode[];
}

/**
 * The map as a list: each hub (topics, then tool categories) with the items that link to it.
 * Every item appears under every hub it connects to, so the list holds every edge.
 */
export const listGroups = (graph: ContentGraph): ListGroup[] => {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacent = neighbours(graph);
  return graph.nodes
    .filter((node) => isHub(node.kind))
    .map((hub) => {
      const linked = (adjacent.get(hub.id) ?? []).map((id) => byId.get(id)!);
      return {
        hub,
        articles: linked.filter((node) => node.kind === "article"),
        snippets: linked.filter((node) => node.kind === "snippet"),
        tools: linked.filter((node) => node.kind === "tool"),
      };
    });
};

/** How many nodes of each kind the graph holds. */
export const countKinds = (graph: ContentGraph) => {
  const counts: Record<MapKind, number> = { topic: 0, article: 0, snippet: 0, category: 0, tool: 0 };
  for (const node of graph.nodes) counts[node.kind] += 1;
  return counts;
};
