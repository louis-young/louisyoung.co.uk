import { cycleTheme } from "./theme";

export type Shortcut =
  "palette" | "search" | "help" | "theme" | "next" | "previous" | "terminal" | "nextArticle" | "previousArticle";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/u.test(target.tagName));

export const shortcutFor = (
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey">,
): Shortcut | undefined => {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") return "palette";
  if (event.metaKey || event.ctrlKey || event.altKey) return undefined;
  if (event.key === "/") return "search";
  if (event.key === "?") return "help";
  if (event.key === "t") return "theme";
  if (event.key === "`") return "terminal";
  if (event.key === "j") return "next";
  if (event.key === "k") return "previous";
  if (event.key === "[") return "previousArticle";
  if (event.key === "]") return "nextArticle";
  return undefined;
};

/** Links that j/k step through: every article and case study row on the page. */
const LIST_LINKS = ".article-row__link, .work-row__link";

/** Moves focus to the next or previous list row, starting from the first or last. */
export const stepList = (delta: 1 | -1) => {
  // Rows hidden by the archive's topic filter are skipped.
  const links = [...document.querySelectorAll<HTMLAnchorElement>(LIST_LINKS)].filter(
    (link) => !link.closest("[hidden]"),
  );
  if (links.length === 0) return;
  const target = links[clampStep(links.indexOf(document.activeElement as HTMLAnchorElement), delta, links.length)];
  target?.focus();
  target?.scrollIntoView({ block: "nearest" });
};

/**
 * The search box `/` focuses instead of opening the palette: one a page opts in with
 * `data-search-shortcut` (the tools index's filter), or the full-text search on /search/. Pages
 * never add their own `/` listener, so the two can’t both fire. A box inside a hidden element
 * doesn’t count.
 */
const pageSearch = () =>
  [...document.querySelectorAll<HTMLInputElement>("[data-search-shortcut], .pagefind-ui__search-input")].find(
    (input) => !input.closest("[hidden]"),
  );

/** Follows the page's rel="prev" or rel="next" link (an article's pager), if it has one. */
const follow = (rel: "prev" | "next") => document.querySelector<HTMLAnchorElement>(`a[rel~="${rel}"]`)?.click();

/** From nowhere (-1), j goes to the first item and k to the last; otherwise step and stop at the ends. */
export const clampStep = (current: number, delta: 1 | -1, length: number) => {
  if (current === -1) return delta === 1 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, current + delta));
};

/** Wires up keyboard shortcuts. Pass a signal to remove the listeners again. */
export const initShortcuts = (
  openPalette: () => void,
  signal?: AbortSignal,
  openTerminal?: () => void,
  openHelp?: () => void,
) => {
  document.addEventListener(
    "keydown",
    (event) => {
      const shortcut = shortcutFor(event);
      if (!shortcut) return;
      // ⌘K works everywhere, even mid-sentence; single keys only when not typing or in a dialog.
      const chord = event.metaKey || event.ctrlKey;
      if (!chord && (isTyping(event.target) || document.querySelector("dialog[open]"))) return;
      event.preventDefault();
      if (shortcut === "search") {
        const input = pageSearch();
        if (input) input.focus();
        else openPalette();
      }
      if (shortcut === "palette") openPalette();
      if (shortcut === "help") openHelp?.();
      if (shortcut === "theme") cycleTheme();
      if (shortcut === "terminal") openTerminal?.();
      if (shortcut === "next") stepList(1);
      if (shortcut === "previous") stepList(-1);
      if (shortcut === "previousArticle") follow("prev");
      if (shortcut === "nextArticle") follow("next");
    },
    { signal } as AddEventListenerOptions,
  );
};
