import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

export const reservedSlugs = [
  "tags",
  "search",
  "design",
  "og",
  "404",
  "feed",
  "rss.xml",
  "atom.xml",
  "feed.json",
  "work",
  "writing",
  "hire",
  "cv",
  "cv.pdf",
  "now",
  "uses",
  "changelog",
  "changelog.xml",
  "colophon",
  "accessibility",
];

const articles = defineCollection({
  loader: glob({ pattern: "*/index.mdx", base: "./content/articles", generateId: ({ entry }) => entry.split("/")[0]! }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(10).max(90),
        description: z.string().min(50).max(240),
        date: z.coerce.date(),
        updated: z.coerce.date().optional(),
        tags: z
          .array(z.string().regex(/^[a-z0-9-]+$/u))
          .min(1)
          .max(5),
        cover: z.object({
          src: image(),
          /** Empty string marks the image as decorative. */
          alt: z.string(),
        }),
        draft: z.boolean().default(false),
      })
      .refine((data) => !data.updated || data.updated >= data.date, {
        message: "`updated` must not be before `date`",
        path: ["updated"],
      }),
});

/** Case studies, listed on `/work/` in `order`. */
const work = defineCollection({
  loader: glob({ pattern: "*/index.mdx", base: "./content/work", generateId: ({ entry }) => entry.split("/")[0]! }),
  schema: z.object({
    title: z.string().min(3).max(90),
    summary: z.string().min(20).max(240),
    client: z.string(),
    role: z.string(),
    year: z.string(),
    order: z.number().int().positive(),
    stack: z.array(z.string()).min(1).max(8),
    outcomes: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .max(4)
      .default([]),
    links: z
      .array(z.object({ label: z.string(), href: z.url() }))
      .max(4)
      .default([]),
    draft: z.boolean().default(false),
  }),
});

/** Standalone pages written in MDX: `/now/` and `/uses/`. */
const pages = defineCollection({
  loader: glob({ pattern: "*.mdx", base: "./content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().min(50).max(240),
    summary: z.string(),
    updated: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { articles, work, pages };
