import { addRecent, parseRecent, RECENT_KEY } from "../lib/recent-tools";

/**
 * Remembers that a tool page was opened, for the "Recently used" row on /tools/. Storage can be
 * missing, blocked or full (private windows, strict privacy settings); then nothing is recorded.
 */
export const recordToolVisit = (slug: string) => {
  try {
    const list = parseRecent(localStorage.getItem(RECENT_KEY));
    localStorage.setItem(RECENT_KEY, JSON.stringify(addRecent(list, slug)));
  } catch {
    /* No storage, no history. */
  }
};

/**
 * Fills the "Recently used" row on /tools/ from storage, as small links copied from the tool
 * cards already on the page (text only, never markup). Stays hidden when storage is unavailable
 * or empty.
 */
export const initRecentTools = (root: ParentNode = document) => {
  const section = root.querySelector<HTMLElement>("[data-recent]");
  const list = section?.querySelector<HTMLElement>("[data-recent-list]");
  if (!section || !list) return;
  const cards = new Map(
    [...root.querySelectorAll<HTMLElement>("[data-tool]")].map((card) => [card.dataset["tool"] ?? "", card]),
  );
  let raw: string | null;
  try {
    raw = localStorage.getItem(RECENT_KEY);
  } catch {
    return;
  }
  const items = parseRecent(raw, [...cards.keys()]).map((slug) => {
    const card = cards.get(slug)!;
    const source = card.querySelector<HTMLAnchorElement>("[data-tool-link]")!;
    const link = document.createElement("a");
    link.className = "recent__link";
    link.setAttribute("href", source.getAttribute("href") ?? "");
    const icon = document.createElement("span");
    icon.className = "recent__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = card.querySelector("[data-tool-icon]")?.textContent.trim() ?? "";
    const title = document.createElement("span");
    title.textContent = source.textContent.trim();
    link.append(icon, title);
    const item = document.createElement("li");
    item.append(link);
    return item;
  });
  if (items.length === 0) return;
  list.replaceChildren(...items);
  section.hidden = false;
};
