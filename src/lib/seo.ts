import { site } from "../site.config";

export const absoluteUrl = (path: string) => new URL(path, site.url).href;

/** A step in a breadcrumb trail. `path` may be site-relative or absolute. */
export interface Crumb {
  name: string;
  path: string;
}

interface ArticleSchemaInput {
  title: string;
  description: string;
  url: string;
  image: string;
  published: Date;
  updated?: Date | undefined;
  tags: readonly string[];
  /** The section the article sits in, between the home page and the article in breadcrumbs. */
  section?: Crumb | undefined;
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

/** A BreadcrumbList that always starts at the home page. */
export const breadcrumbSchema = (trail: readonly Crumb[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [{ name: site.name, path: "/" }, ...trail].map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.name,
    item: absoluteUrl(crumb.path),
  })),
});

interface ToolSchemaInput {
  name: string;
  description: string;
  path: string;
  image: string;
  section: Crumb;
}

/** A free, in-browser tool: a WebApplication plus its breadcrumb trail. */
export const toolSchema = (input: ToolSchemaInput) =>
  [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: input.name,
      description: input.description,
      url: absoluteUrl(input.path),
      image: absoluteUrl(input.image),
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript. Runs entirely in the browser.",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
      inLanguage: site.defaultLocale,
      author: person,
    },
    breadcrumbSchema([input.section, { name: input.name, path: input.path }]),
  ] as const;

interface ItemListSchemaInput {
  name: string;
  description: string;
  path: string;
  items: readonly Crumb[];
}

/** An ordered list of pages (e.g. the tools index). */
export const itemListSchema = (input: ItemListSchemaInput) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: input.name,
  description: input.description,
  url: absoluteUrl(input.path),
  numberOfItems: input.items.length,
  itemListElement: input.items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    url: absoluteUrl(item.path),
  })),
});

/**
 * A meta description from a lead-in and a list, e.g. "3 articles tagged “react”: A, B, C.",
 * stopping before `max` characters so search results don't truncate it mid-word.
 */
export const describeList = (lead: string, items: readonly string[], max = 160) => {
  let text = lead;
  for (const [index, item] of items.entries()) {
    const next = `${text}${index === 0 ? ": " : ", "}${item}`;
    if (next.length >= max) return index === 0 ? `${lead}.` : `${text}…`;
    text = next;
  }
  return `${text}.`;
};

export const articleSchema = (input: ArticleSchemaInput) =>
  [
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
    breadcrumbSchema([...(input.section ? [input.section] : []), { name: input.title, path: input.url }]),
  ] as const;

interface CodeSnippetSchemaInput {
  title: string;
  description: string;
  path: string;
  image: string;
  /** The programming language's display name, e.g. "TypeScript". */
  language: string;
  published: Date;
  updated?: Date | undefined;
  tags: readonly string[];
  section: Crumb;
}

/** A code snippet: SoftwareSourceCode plus its breadcrumb trail. */
export const codeSnippetSchema = (input: CodeSnippetSchemaInput) =>
  [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name: input.title,
      description: input.description,
      url: absoluteUrl(input.path),
      image: absoluteUrl(input.image),
      programmingLanguage: input.language,
      datePublished: input.published.toISOString(),
      dateModified: (input.updated ?? input.published).toISOString(),
      keywords: input.tags.join(", "),
      inLanguage: site.defaultLocale,
      isAccessibleForFree: true,
      author: person,
    },
    breadcrumbSchema([input.section, { name: input.title, path: input.path }]),
  ] as const;

/** Serialises JSON-LD safely for inline `<script>` use. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</gu, "\\u003c");
