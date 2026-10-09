/**
 * Matching for the search and category chips on /tools/. Kept free of the catalogue and i18n so
 * the browser bundle that imports it stays tiny.
 */
import { searchText } from "./snippet-filter";

/** What the filter knows about each tool card. `text` is already normalised with `searchText`. */
interface ToolIndexEntry {
  text: string;
  category: string;
}

export interface ToolQuery {
  query: string;
  /** Empty for every category. */
  category: string;
}

/** True when a tool is in the chosen category and its text contains every word of the query. */
export const matchesTool = (entry: ToolIndexEntry, { query, category }: ToolQuery) => {
  if (category && entry.category !== category) return false;
  return searchText([query])
    .split(" ")
    .filter(Boolean)
    .every((word) => entry.text.includes(word));
};

/** Whether the query narrows the list at all. */
export const isToolFilterActive = ({ query, category }: ToolQuery) => Boolean(query.trim() || category);
