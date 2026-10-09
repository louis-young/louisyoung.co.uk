import type { MessageKey } from "../i18n/en-GB";
import { newest } from "./latest";
import { toolSchema } from "./seo";

interface Tool {
  slug: string;
  title: MessageKey;
  summary: MessageKey;
  /** A short glyph for the tools index; Geist must be able to render it. */
  icon: string;
  category: ToolCategory;
  /** Extra search terms, separated by spaces. Not shown, so not translated. */
  keywords: string;
  /** When the tool first shipped, as an ISO 8601 date with an offset. Set by hand when a tool is added. */
  added: string;
}

/** The headings the tools index groups tools under, in the order it shows them. */
export const toolCategories = [
  { id: "colour", label: "tools.category.colour" },
  { id: "css", label: "tools.category.css" },
  { id: "text", label: "tools.category.text" },
  { id: "encoding", label: "tools.category.encoding" },
  { id: "web", label: "tools.category.web" },
] as const satisfies readonly { id: string; label: MessageKey }[];

type ToolCategory = (typeof toolCategories)[number]["id"];

/**
 * Every tool, in the order the tools index lists them within a category. `keywords` are extra
 * search terms for the index search and the ⌘K palette; titles and summaries are searched too.
 */
export const tools = [
  {
    slug: "contrast",
    title: "tools.contrast.title",
    summary: "tools.contrast.summary",
    icon: "Aa",
    category: "colour",
    added: "2026-10-08T21:54:24+01:00",
    keywords: "wcag colour color a11y",
  },
  {
    slug: "colour",
    title: "tools.colour.title",
    summary: "tools.colour.summary",
    icon: "#",
    category: "colour",
    added: "2026-10-08T23:08:41+01:00",
    keywords: "color hex rgb hsl oklch palette scale",
  },
  {
    slug: "css-generator",
    title: "tools.css.title",
    summary: "tools.css.summary",
    icon: "css",
    category: "colour",
    added: "2026-10-09T01:27:46+01:00",
    keywords: "box-shadow linear radial gradient css",
  },
  {
    slug: "easing",
    title: "tools.easing.title",
    summary: "tools.easing.summary",
    icon: "∿",
    category: "colour",
    added: "2026-10-08T23:08:41+01:00",
    keywords: "cubic-bezier animation transition curve",
  },
  {
    slug: "clamp",
    title: "tools.clamp.title",
    summary: "tools.clamp.summary",
    icon: "↔",
    category: "css",
    added: "2026-10-08T21:54:24+01:00",
    keywords: "fluid type css",
  },
  {
    slug: "units",
    title: "tools.units.title",
    summary: "tools.units.summary",
    icon: "px",
    category: "css",
    added: "2026-10-08T23:08:41+01:00",
    keywords: "px rem em pt vw vh convert",
  },
  {
    slug: "specificity",
    title: "tools.specificity.title",
    summary: "tools.specificity.summary",
    icon: "0,1,0",
    category: "css",
    added: "2026-10-09T04:18:41+01:00",
    keywords: "css selector specificity cascade weight is where not has id class",
  },
  {
    slug: "aspect-ratio",
    title: "tools.aspect.title",
    summary: "tools.aspect.summary",
    icon: "16:9",
    category: "css",
    added: "2026-10-09T02:43:47+01:00",
    keywords: "aspect ratio 16:9 4:3 resize width height video image",
  },
  {
    slug: "json",
    title: "tools.json.title",
    summary: "tools.json.summary",
    icon: "{ }",
    category: "text",
    added: "2026-10-08T23:08:41+01:00",
    keywords: "validate minify prettify format",
  },
  {
    slug: "regex",
    title: "tools.regex.title",
    summary: "tools.regex.summary",
    icon: ".*",
    category: "text",
    added: "2026-10-08T23:08:41+01:00",
    keywords: "regular expression pattern match",
  },
  {
    slug: "diff",
    title: "tools.diff.title",
    summary: "tools.diff.summary",
    icon: "±",
    category: "text",
    added: "2026-10-09T00:07:03+01:00",
    keywords: "compare difference text lines",
  },
  {
    slug: "json-to-ts",
    title: "tools.jsonts.title",
    summary: "tools.jsonts.summary",
    icon: "{T}",
    category: "text",
    added: "2026-10-09T02:43:47+01:00",
    keywords: "typescript interface type generate json schema ts",
  },
  {
    slug: "sql",
    title: "tools.sql.title",
    summary: "tools.sql.summary",
    icon: "SQL",
    category: "text",
    added: "2026-10-09T02:43:47+01:00",
    keywords: "sql query format beautify minify prettify database",
  },
  {
    slug: "markdown-table",
    title: "tools.markdownTable.title",
    summary: "tools.markdownTable.summary",
    icon: "|-|",
    category: "text",
    added: "2026-10-09T04:18:41+01:00",
    keywords: "markdown table gfm csv tsv generator columns rows",
  },
  {
    slug: "case",
    title: "tools.case.title",
    summary: "tools.case.summary",
    icon: "aA",
    category: "text",
    added: "2026-10-09T02:43:47+01:00",
    keywords: "camel pascal snake kebab title sentence slug uppercase lowercase text",
  },
  {
    slug: "reading-time",
    title: "tools.reading.title",
    summary: "tools.reading.summary",
    icon: "⏱",
    category: "text",
    added: "2026-10-08T21:54:24+01:00",
    keywords: "words",
  },
  {
    slug: "encode",
    title: "tools.encode.title",
    summary: "tools.encode.summary",
    icon: "⇄",
    category: "encoding",
    added: "2026-10-08T23:08:41+01:00",
    keywords: "base64 url html entities jwt decode",
  },
  {
    slug: "hash",
    title: "tools.hash.title",
    summary: "tools.hash.summary",
    icon: "0x",
    category: "encoding",
    added: "2026-10-09T00:07:03+01:00",
    keywords: "sha sha256 checksum uuid guid random",
  },
  {
    slug: "url",
    title: "tools.url.title",
    summary: "tools.url.summary",
    icon: "://",
    category: "encoding",
    added: "2026-10-09T04:18:41+01:00",
    keywords: "url uri parse query string search params encode decode percent",
  },
  {
    slug: "base",
    title: "tools.base.title",
    summary: "tools.base.summary",
    icon: "b16",
    category: "encoding",
    added: "2026-10-09T04:18:41+01:00",
    keywords: "binary octal decimal hex hexadecimal radix bits twos complement endian",
  },
  {
    slug: "http-status",
    title: "tools.http.title",
    summary: "tools.http.summary",
    icon: "200",
    category: "web",
    added: "2026-10-09T01:27:46+01:00",
    keywords: "http status code error 404 500 redirect",
  },
  {
    slug: "cron",
    title: "tools.cron.title",
    summary: "tools.cron.summary",
    icon: "*/5",
    category: "web",
    added: "2026-10-09T00:07:03+01:00",
    keywords: "crontab schedule job explain",
  },
  {
    slug: "timestamp",
    title: "tools.timestamp.title",
    summary: "tools.timestamp.summary",
    icon: "UTC",
    category: "web",
    added: "2026-10-09T00:07:03+01:00",
    keywords: "unix epoch iso date time zone",
  },
  {
    slug: "semver",
    title: "tools.semver.title",
    summary: "tools.semver.summary",
    icon: "^1",
    category: "web",
    added: "2026-10-09T01:27:46+01:00",
    keywords: "semantic version range npm caret tilde",
  },
  {
    slug: "chmod",
    title: "tools.chmod.title",
    summary: "tools.chmod.summary",
    icon: "755",
    category: "web",
    added: "2026-10-09T01:27:46+01:00",
    keywords: "unix file permissions octal 755 rwx",
  },
] as const satisfies readonly Tool[];

export type ToolSlug = (typeof tools)[number]["slug"];

/** The tools the home page shows off: broad, everyday ones that read well as a sample of the set. */
const featuredToolSlugs = [
  "json",
  "regex",
  "contrast",
  "cron",
  "diff",
  "json-to-ts",
] as const satisfies readonly ToolSlug[];

export const featuredTools = () => featuredToolSlugs.map((slug) => tools.find((tool) => tool.slug === slug)!);

/** The most recently added tool. Tools added in the same commit go to the one listed last. */
export const newestTool = () => newest(tools, (tool) => new Date(tool.added))!;

export const toolPath = (slug: string) => `/tools/${slug}/`;

/** Each tool's Open Graph card, rendered by `src/pages/og/[slug].png.ts`. */
export const toolImage = (slug: string) => `/og/tools-${slug}.png`;

/** Title, description, OG image and structured data for a tool page's `<Base>`. */
export const toolPageProps = (slug: ToolSlug, t: (key: MessageKey) => string) => {
  const tool = tools.find((item) => item.slug === slug)!;
  const title = t(tool.title);
  const description = t(tool.summary);
  return {
    /** Base renders the related tools and records the visit for this tool. */
    tool: slug,
    title,
    description,
    image: toolImage(slug),
    schema: toolSchema({
      name: title,
      description,
      path: toolPath(slug),
      image: toolImage(slug),
      section: { name: t("nav.tools"), path: "/tools/" },
    }),
  };
};

/** The tools in each category, in index order. Empty categories are left out. */
export const toolsByCategory = () =>
  toolCategories
    .map((category) => ({ ...category, tools: tools.filter((tool) => tool.category === category.id) }))
    .filter((group) => group.tools.length > 0);

/**
 * Up to `count` other tools from the same category: the ones that follow this tool in index
 * order, wrapping round, so neighbouring tools don't all point at the same three.
 */
export const relatedTools = (slug: string, count = 3) => {
  const tool = tools.find((item) => item.slug === slug);
  if (!tool) return [];
  const siblings = tools.filter((item) => item.category === tool.category);
  const start = siblings.indexOf(tool);
  return [...siblings.slice(start + 1), ...siblings.slice(0, start)].slice(0, count);
};
