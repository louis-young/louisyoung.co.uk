import { cycleTheme } from "./theme";

export type Shortcut = "palette" | "search" | "theme" | "grid" | "next" | "previous";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/u.test(target.tagName));

export const shortcutFor = (
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey">,
): Shortcut | undefined => {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") return "palette";
  if (event.metaKey || event.ctrlKey || event.altKey) return undefined;
  if (event.key === "/") return "search";
  if (event.key === "?") return "palette";
  if (event.key === "t") return "theme";
  if (event.key === "g") return "grid";
  if (event.key === "j") return "next";
  if (event.key === "k") return "previous";
  return undefined;
};

/** Links that j/k step through: every article and case study row on the page. */
const LIST_LINKS = ".article-row__link, .work-row__link";

/** Moves focus to the next or previous list row, starting from the first or last. */
export const stepList = (delta: 1 | -1) => {
  const links = [...document.querySelectorAll<HTMLAnchorElement>(LIST_LINKS)];
  if (links.length === 0) return;
  const target = links[clampStep(links.indexOf(document.activeElement as HTMLAnchorElement), delta, links.length)];
  target?.focus();
  target?.scrollIntoView({ block: "nearest" });
};

/** From nowhere (-1), j goes to the first item and k to the last; otherwise step and stop at the ends. */
export const clampStep = (current: number, delta: 1 | -1, length: number) => {
  if (current === -1) return delta === 1 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, current + delta));
};

/** Shows or hides the 12-column layout grid overlay. */
export const toggleGrid = () => {
  const root = document.documentElement;
  if (root.hasAttribute("data-grid")) root.removeAttribute("data-grid");
  else root.setAttribute("data-grid", "");
};

/** Wires up keyboard shortcuts. Pass a signal to remove the listeners again. */
export const initShortcuts = (openPalette: () => void, signal?: AbortSignal) => {
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
        const input = document.querySelector<HTMLInputElement>(".pagefind-ui__search-input");
        if (input) input.focus();
        else openPalette();
      }
      if (shortcut === "palette") openPalette();
      if (shortcut === "theme") cycleTheme();
      if (shortcut === "grid") toggleGrid();
      if (shortcut === "next") stepList(1);
      if (shortcut === "previous") stepList(-1);
    },
    { signal } as AddEventListenerOptions,
  );
};
