import { cycleTheme } from "./theme";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/u.test(target.tagName));

export const shortcutFor = (event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey">) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return undefined;
  if (event.key === "/") return "search";
  if (event.key === "t") return "theme";
  if (event.key === "?") return "help";
  return undefined;
};

/** Wires up keyboard shortcuts. Pass a signal to remove the listeners again. */
export const initShortcuts = (signal?: AbortSignal) => {
  const options = { signal } as AddEventListenerOptions;
  const dialog = document.querySelector<HTMLDialogElement>("#shortcuts");
  document.addEventListener(
    "keydown",
    (event) => {
      if (isTyping(event.target) || dialog?.open) return;
      const shortcut = shortcutFor(event);
      if (!shortcut) return;
      event.preventDefault();
      if (shortcut === "search") {
        const input = document.querySelector<HTMLInputElement>(".pagefind-ui__search-input");
        if (input) input.focus();
        else window.location.assign("/search/");
      }
      if (shortcut === "theme") cycleTheme();
      if (shortcut === "help") dialog?.showModal();
    },
    options,
  );
  for (const opener of document.querySelectorAll("[data-shortcuts-open]")) {
    opener.addEventListener("click", () => dialog?.showModal(), options);
  }
  dialog?.addEventListener(
    "click",
    (event) => {
      if (event.target === dialog || (event.target as Element).closest("[data-shortcuts-close]")) dialog.close();
    },
    options,
  );
};
