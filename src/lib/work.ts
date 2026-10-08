import { getCollection, type CollectionEntry } from "astro:content";

export type CaseStudy = CollectionEntry<"work">;

const byOrder = (a: Pick<CaseStudy, "data">, b: Pick<CaseStudy, "data">) => a.data.order - b.data.order;

/** Drafts render in development, and in CI builds (SHOW_DRAFTS) so their layouts stay tested. */
const showDrafts = () => import.meta.env.DEV || Boolean(process.env["SHOW_DRAFTS"]);

export const getWork = async () =>
  (await getCollection("work", (entry) => showDrafts() || !entry.data.draft)).sort(byOrder);

export const isPagePublished = (page: { data: { draft: boolean } }) => showDrafts() || !page.data.draft;

export const workPath = (study: Pick<CaseStudy, "id">) => `/work/${study.id}/`;

/** "001", "002"… the index-style numbering used in work tables. */
export const caseNumber = (index: number) => String(index + 1).padStart(3, "0");
