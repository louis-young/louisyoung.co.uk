import { getCollection, type CollectionEntry } from "astro:content";

export type Article = CollectionEntry<"articles">;

export const isPublished = (entry: { data: { draft: boolean } }, includeDrafts = import.meta.env.DEV) =>
  includeDrafts || !entry.data.draft;

export const byNewest = (a: { data: { date: Date } }, b: { data: { date: Date } }) =>
  b.data.date.getTime() - a.data.date.getTime();

export const getArticles = async () => (await getCollection("articles", (entry) => isPublished(entry))).sort(byNewest);

export const articlePath = (article: Pick<Article, "id">) => `/${article.id}/`;

/** Previous is the older neighbour, next is the newer one. */
export const getAdjacent = <T extends { id: string }>(sortedNewestFirst: readonly T[], id: string) => {
  const index = sortedNewestFirst.findIndex((item) => item.id === id);
  if (index === -1) return { previous: undefined, next: undefined };
  return { previous: sortedNewestFirst[index + 1], next: sortedNewestFirst[index - 1] };
};

/** Ranks other articles by shared tags, breaking ties by recency. */
export const getRelated = <T extends { id: string; data: { tags: readonly string[]; date: Date } }>(
  articles: readonly T[],
  current: T,
  limit = 3,
) =>
  articles
    .filter((article) => article.id !== current.id)
    .map((article) => ({
      article,
      score: article.data.tags.filter((tag) => current.data.tags.includes(tag)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.article.data.date.getTime() - a.article.data.date.getTime())
    .slice(0, limit)
    .map(({ article }) => article);

export const getTags = (articles: readonly { data: { tags: readonly string[] } }[]) => {
  const counts = new Map<string, number>();
  for (const tag of articles.flatMap((article) => article.data.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
};

export const groupByYear = <T extends { data: { date: Date } }>(articles: readonly T[]) => {
  const groups = new Map<number, T[]>();
  for (const article of articles) {
    const year = article.data.date.getUTCFullYear();
    groups.set(year, [...(groups.get(year) ?? []), article]);
  }
  return [...groups].sort(([a], [b]) => b - a);
};
