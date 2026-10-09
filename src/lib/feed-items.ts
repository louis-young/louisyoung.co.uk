import { site } from "../site.config";
import { articlePath, getArticles } from "./articles";
import { getSnippets, snippetPath } from "./snippets";
import type { FeedItem, FeedMeta } from "./feeds";
import { absoluteUrl } from "./seo";
import { useTranslations } from "../i18n";

/** Metadata for a feed. A `section` feed (e.g. snippets) gets its own title, description and home page. */
export const feedMeta = (
  feedPath: string,
  section?: { title: string; description: string; path: string },
): FeedMeta => {
  const t = useTranslations();
  return {
    title: section ? `${site.name} · ${section.title}` : site.name,
    description: section?.description ?? t("site.description"),
    siteUrl: absoluteUrl(section?.path ?? "/"),
    feedUrl: absoluteUrl(feedPath),
    author: { name: site.author.name, email: site.author.email },
    language: site.defaultLocale,
  };
};

export const feedItems = async (): Promise<FeedItem[]> =>
  (await getArticles()).map((article) => ({
    title: article.data.title,
    description: article.data.description,
    url: absoluteUrl(articlePath(article)),
    published: article.data.date,
    updated: article.data.updated,
    tags: article.data.tags,
  }));

/** Snippets have their own feed, so the article feeds stay articles only. Drafts never appear. */
export const snippetFeedItems = async (): Promise<FeedItem[]> =>
  (await getSnippets())
    .filter((snippet) => !snippet.data.draft)
    .map((snippet) => ({
      title: snippet.data.title,
      description: snippet.data.description,
      url: absoluteUrl(snippetPath(snippet)),
      published: snippet.data.date,
      updated: snippet.data.updated,
      tags: snippet.data.tags,
    }));
