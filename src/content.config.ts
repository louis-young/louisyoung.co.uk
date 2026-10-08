import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

export const reservedSlugs = ["tags", "search", "design", "og", "404", "feed", "rss.xml", "atom.xml", "feed.json"];

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

export const collections = { articles };
