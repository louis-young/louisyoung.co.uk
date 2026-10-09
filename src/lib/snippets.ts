import { getCollection, type CollectionEntry } from "astro:content";

import { byNewest } from "./articles";
import { isPagePublished } from "./work";

export type Snippet = CollectionEntry<"snippets">;

type Language = Snippet["data"]["language"];

/** Display names for the languages snippets are filed under. These are proper names, not UI copy. */
const languageNames: Record<Language, string> & Partial<Record<string, string>> = {
  ts: "TypeScript",
  tsx: "TSX",
  js: "JavaScript",
  css: "CSS",
  html: "HTML",
  bash: "Shell",
  sql: "SQL",
  json: "JSON",
};

export const languageName = (language: string) => languageNames[language] ?? language;

/** Newest first. Drafts are included in development and SHOW_DRAFTS builds, like case studies. */
export const getSnippets = async () => (await getCollection("snippets", isPagePublished)).sort(byNewest);

export const snippetPath = (snippet: Pick<Snippet, "id">) => `/snippets/${snippet.id}/`;

interface Filterable {
  data: { language: string; tags: readonly string[] };
}

/** Counts the values `pick` returns across snippets: most used first, then alphabetically. */
const countBy = (snippets: readonly Filterable[], pick: (snippet: Filterable) => readonly string[]) => {
  const counts = new Map<string, number>();
  for (const value of snippets.flatMap(pick)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
};

export const languagesOf = (snippets: readonly Filterable[]) => countBy(snippets, (snippet) => [snippet.data.language]);

export const tagsOf = (snippets: readonly Filterable[]) => countBy(snippets, (snippet) => snippet.data.tags);
