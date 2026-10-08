import type { MessageKey } from "../i18n/en-GB";
import { toolSchema } from "./seo";

interface Tool {
  slug: string;
  title: MessageKey;
  summary: MessageKey;
  /** A short glyph for the tools index; Geist must be able to render it. */
  icon: string;
}

/** Every tool, in the order the tools index lists them. */
export const tools = [
  { slug: "contrast", title: "tools.contrast.title", summary: "tools.contrast.summary", icon: "Aa" },
  { slug: "clamp", title: "tools.clamp.title", summary: "tools.clamp.summary", icon: "↔" },
  { slug: "reading-time", title: "tools.reading.title", summary: "tools.reading.summary", icon: "⏱" },
  { slug: "json", title: "tools.json.title", summary: "tools.json.summary", icon: "{ }" },
  { slug: "regex", title: "tools.regex.title", summary: "tools.regex.summary", icon: ".*" },
  { slug: "encode", title: "tools.encode.title", summary: "tools.encode.summary", icon: "⇄" },
  { slug: "colour", title: "tools.colour.title", summary: "tools.colour.summary", icon: "#" },
  { slug: "units", title: "tools.units.title", summary: "tools.units.summary", icon: "px" },
  { slug: "easing", title: "tools.easing.title", summary: "tools.easing.summary", icon: "∿" },
] as const satisfies readonly Tool[];

type ToolSlug = (typeof tools)[number]["slug"];

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
