import { site } from "../site.config";

export const absoluteUrl = (path: string) => new URL(path, site.url).href;

interface ArticleSchemaInput {
  title: string;
  description: string;
  url: string;
  image: string;
  published: Date;
  updated?: Date | undefined;
  tags: readonly string[];
}

const person = {
  "@type": "Person",
  name: site.author.name,
  url: site.url,
  sameAs: site.social.map((profile) => profile.href),
} as const;

export const websiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.name,
  url: site.url,
  inLanguage: site.defaultLocale,
  author: person,
});

export const articleSchema = (input: ArticleSchemaInput) => [
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    url: input.url,
    mainEntityOfPage: input.url,
    image: input.image,
    datePublished: input.published.toISOString(),
    dateModified: (input.updated ?? input.published).toISOString(),
    keywords: input.tags.join(", "),
    inLanguage: site.defaultLocale,
    author: person,
    publisher: person,
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: site.name, item: site.url },
      { "@type": "ListItem", position: 2, name: input.title, item: input.url },
    ],
  },
];

/** Serialises JSON-LD safely for inline `<script>` use. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</gu, "\\u003c");
