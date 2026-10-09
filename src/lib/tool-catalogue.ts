import type { MessageKey } from "../i18n/en-GB";
import { newest } from "./latest";
import { toolSchema } from "./seo";

interface Tool {
  slug: string;
  title: MessageKey;
  summary: MessageKey;
  /** A short glyph for the tools index; Geist must be able to render it. */
  icon: string;
  /**
   * When the tool first shipped: the author date of the commit that added its page
   * (`git log --diff-filter=A --format=%aI -- src/pages/tools/<slug>.astro`). Hard-coded so
   * shallow clones still know it; `tests/unit/tool-catalogue.test.ts` checks it against git.
   */
  added: string;
}

/** Every tool, in the order the tools index lists them. */
export const tools = [
  {
    slug: "contrast",
    title: "tools.contrast.title",
    summary: "tools.contrast.summary",
    icon: "Aa",
    added: "2026-10-08T21:54:24+01:00",
  },
  {
    slug: "clamp",
    title: "tools.clamp.title",
    summary: "tools.clamp.summary",
    icon: "↔",
    added: "2026-10-08T21:54:24+01:00",
  },
  {
    slug: "reading-time",
    title: "tools.reading.title",
    summary: "tools.reading.summary",
    icon: "⏱",
    added: "2026-10-08T21:54:24+01:00",
  },
  {
    slug: "json",
    title: "tools.json.title",
    summary: "tools.json.summary",
    icon: "{ }",
    added: "2026-10-08T23:08:41+01:00",
  },
  {
    slug: "regex",
    title: "tools.regex.title",
    summary: "tools.regex.summary",
    icon: ".*",
    added: "2026-10-08T23:08:41+01:00",
  },
  {
    slug: "encode",
    title: "tools.encode.title",
    summary: "tools.encode.summary",
    icon: "⇄",
    added: "2026-10-08T23:08:41+01:00",
  },
  {
    slug: "colour",
    title: "tools.colour.title",
    summary: "tools.colour.summary",
    icon: "#",
    added: "2026-10-08T23:08:41+01:00",
  },
  {
    slug: "units",
    title: "tools.units.title",
    summary: "tools.units.summary",
    icon: "px",
    added: "2026-10-08T23:08:41+01:00",
  },
  {
    slug: "easing",
    title: "tools.easing.title",
    summary: "tools.easing.summary",
    icon: "∿",
    added: "2026-10-08T23:08:41+01:00",
  },
  {
    slug: "cron",
    title: "tools.cron.title",
    summary: "tools.cron.summary",
    icon: "*/5",
    added: "2026-10-09T00:07:03+01:00",
  },
  {
    slug: "timestamp",
    title: "tools.timestamp.title",
    summary: "tools.timestamp.summary",
    icon: "UTC",
    added: "2026-10-09T00:07:03+01:00",
  },
  {
    slug: "diff",
    title: "tools.diff.title",
    summary: "tools.diff.summary",
    icon: "±",
    added: "2026-10-09T00:07:03+01:00",
  },
  {
    slug: "hash",
    title: "tools.hash.title",
    summary: "tools.hash.summary",
    icon: "0x",
    added: "2026-10-09T00:07:03+01:00",
  },
  {
    slug: "http-status",
    title: "tools.http.title",
    summary: "tools.http.summary",
    icon: "200",
    added: "2026-10-09T01:27:46+01:00",
  },
  {
    slug: "semver",
    title: "tools.semver.title",
    summary: "tools.semver.summary",
    icon: "^1",
    added: "2026-10-09T01:27:46+01:00",
  },
  {
    slug: "chmod",
    title: "tools.chmod.title",
    summary: "tools.chmod.summary",
    icon: "755",
    added: "2026-10-09T01:27:46+01:00",
  },
  {
    slug: "css-generator",
    title: "tools.css.title",
    summary: "tools.css.summary",
    icon: "css",
    added: "2026-10-09T01:27:46+01:00",
  },
  {
    slug: "json-to-ts",
    title: "tools.jsonts.title",
    summary: "tools.jsonts.summary",
    icon: "{T}",
    added: "2026-10-09T02:43:47+01:00",
  },
  {
    slug: "case",
    title: "tools.case.title",
    summary: "tools.case.summary",
    icon: "aA",
    added: "2026-10-09T02:43:47+01:00",
  },
  {
    slug: "aspect-ratio",
    title: "tools.aspect.title",
    summary: "tools.aspect.summary",
    icon: "16:9",
    added: "2026-10-09T02:43:47+01:00",
  },
  {
    slug: "sql",
    title: "tools.sql.title",
    summary: "tools.sql.summary",
    icon: "SQL",
    added: "2026-10-09T02:43:47+01:00",
  },
  {
    slug: "specificity",
    title: "tools.specificity.title",
    summary: "tools.specificity.summary",
    icon: "0,1,0",
    added: "2026-10-09T02:41:45+00:00",
  },
  {
    slug: "url",
    title: "tools.url.title",
    summary: "tools.url.summary",
    icon: "://",
    added: "2026-10-09T02:41:45+00:00",
  },
  {
    slug: "base",
    title: "tools.base.title",
    summary: "tools.base.summary",
    icon: "b16",
    added: "2026-10-09T02:41:45+00:00",
  },
  {
    slug: "markdown-table",
    title: "tools.markdownTable.title",
    summary: "tools.markdownTable.summary",
    icon: "|-|",
    added: "2026-10-09T02:41:45+00:00",
  },
] as const satisfies readonly Tool[];

type ToolSlug = (typeof tools)[number]["slug"];

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
