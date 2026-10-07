import { site } from "../site.config";
import { articlePath, getArticles } from "./articles";
import type { FeedItem, FeedMeta } from "./feeds";
import { absoluteUrl } from "./seo";
import { useTranslations } from "../i18n";

export const feedMeta = (feedPath: string): FeedMeta => {
  const t = useTranslations();
  return {
    title: site.name,
    description: t("site.description"),
    siteUrl: `${site.url}/`,
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
