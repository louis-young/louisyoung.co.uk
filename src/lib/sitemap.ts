import { readdirSync, readFileSync } from "node:fs";

/**
 * What the sitemap needs to know about content-backed pages, read straight from MDX frontmatter
 * because `astro.config.ts` runs before content collections exist.
 */
interface PageInfo {
  lastmod: Date | undefined;
  draft: boolean;
}

type ContentIndex = ReadonlyMap<string, PageInfo>;

type Collection = "articles" | "work" | "pages";

const frontmatter = (source: string) => /^---\r?\n(?<body>[\s\S]*?)\r?\n---/u.exec(source)?.groups?.["body"] ?? "";

const field = (yaml: string, name: string) =>
  new RegExp(`^${name}:\\s*["']?(?<value>[^"'\\n#]*?)["']?\\s*(?:#.*)?$`, "mu").exec(yaml)?.groups?.["value"];

const validDate = (value: string | undefined) => {
  const date = value ? new Date(value) : undefined;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
};

export const pageInfo = (source: string): PageInfo => {
  const yaml = frontmatter(source);
  return {
    lastmod: validDate(field(yaml, "updated")) ?? validDate(field(yaml, "date")),
    draft: field(yaml, "draft") === "true",
  };
};

export const contentPath = (collection: Collection, id: string) => (collection === "work" ? `/work/${id}/` : `/${id}/`);

/** Reads `content/{articles,work}/<slug>/index.mdx` and `content/pages/<slug>.mdx`. */
export const readContentIndex = (root: URL): ContentIndex => {
  const index = new Map<string, PageInfo>();
  const read = (collection: Collection, id: string, file: URL) => {
    index.set(contentPath(collection, id), pageInfo(readFileSync(file, "utf8")));
  };
  for (const collection of ["articles", "work"] as const) {
    for (const entry of readdirSync(new URL(`${collection}/`, root), { withFileTypes: true })) {
      if (entry.isDirectory()) read(collection, entry.name, new URL(`${collection}/${entry.name}/index.mdx`, root));
    }
  }
  for (const name of readdirSync(new URL("pages/", root))) {
    if (name.endsWith(".mdx")) read("pages", name.slice(0, -4), new URL(`pages/${name}`, root));
  }
  return index;
};

const pathOf = (url: string) => new URL(url).pathname;

/** Keeps drafts out of the sitemap even in builds that render them (SHOW_DRAFTS). */
export const isListed = (index: ContentIndex, url: string) => {
  const path = pathOf(url);
  return !path.startsWith("/design/") && !index.get(path)?.draft;
};

/** Adds `lastmod` from the page's `updated` (or `date`) frontmatter when it has one. */
export const withLastmod = <Item extends { url: string }>(index: ContentIndex, item: Item): Item => {
  const lastmod = index.get(pathOf(item.url))?.lastmod;
  return lastmod ? { ...item, lastmod: lastmod.toISOString() } : item;
};
