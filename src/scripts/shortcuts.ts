import { cycleTheme } from "./theme";

export type Shortcut = "palette" | "search" | "theme" | "grid";

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
  return undefined;
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
    },
    { signal } as AddEventListenerOptions,
  );
};
