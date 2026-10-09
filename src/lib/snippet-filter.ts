/**
 * Matching for the filter on /snippets/. Kept free of `astro:content` so the browser bundle that
 * imports it stays tiny.
 */

/** What the filter knows about each card. `text` is everything the search box matches against. */
interface SnippetIndexEntry {
  text: string;
  language: string;
  tags: readonly string[];
}

export interface SnippetQuery {
  query: string;
  /** Empty for any language. */
  language: string;
  /** Empty for any tag. */
  tag: string;
}

const normalise = (value: string) => value.normalize("NFKD").replace(/[̀-ͯ]/gu, "").toLowerCase();

/** The searchable text for a card, from its title, description, language and tags. */
export const searchText = (fields: readonly string[]) => normalise(fields.join(" ")).replace(/\s+/gu, " ").trim();

/** True when a snippet matches every part of the query. Every word in the search box must appear. */
export const matchesSnippet = (entry: SnippetIndexEntry, { query, language, tag }: SnippetQuery) => {
  if (language && entry.language !== language) return false;
  if (tag && !entry.tags.includes(tag)) return false;
  const text = normalise(entry.text);
  return normalise(query)
    .split(/\s+/u)
    .filter(Boolean)
    .every((word) => text.includes(word));
};

/** Whether any part of the query narrows the list. */
export const isFiltered = ({ query, language, tag }: SnippetQuery) => Boolean(query.trim() || language || tag);
