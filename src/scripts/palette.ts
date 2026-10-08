import { moveIndex, rankCommands, sameOriginPath } from "../lib/palette";
import { cycleTheme } from "./theme";

interface Option {
  element: HTMLElement;
  title: string;
  keywords: string;
}

/**
 * The ⌘K command palette: a native modal `<dialog>` with an ARIA combobox and listbox.
 * Options are rendered at build time; this only filters, highlights and activates them.
 */
export const initPalette = (signal?: AbortSignal) => {
  const options = { signal } as AddEventListenerOptions;
  const dialog = document.querySelector<HTMLDialogElement>("#palette");
  const input = dialog?.querySelector<HTMLInputElement>("[role=combobox]");
  const list = dialog?.querySelector<HTMLElement>("[role=listbox]");
  const empty = dialog?.querySelector<HTMLElement>("[data-palette-empty]");
  const status = dialog?.querySelector<HTMLElement>("[data-palette-status]");
  if (!dialog || !input || !list) return () => undefined;

  const all: Option[] = [...list.querySelectorAll<HTMLElement>("[role=option]")].map((element) => ({
    element,
    title: element.dataset["title"] ?? element.textContent.trim(),
    keywords: element.dataset["keywords"] ?? "",
  }));
  let visible: Option[] = all;
  let active = 0;

  const highlight = (index: number) => {
    active = index;
    for (const [position, option] of visible.entries()) {
      option.element.setAttribute("aria-selected", String(position === active));
    }
    const current = visible[active];
    if (current) {
      input.setAttribute("aria-activedescendant", current.element.id);
      current.element.scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };

  const results = list.querySelector<HTMLElement>("[data-palette-results]");
  const groups = [...list.querySelectorAll<HTMLElement>("[role=group]")];

  /** Puts every option back in its group, in authored order. */
  const restore = () => {
    for (const option of all) {
      list.querySelector(`[data-group="${option.element.dataset["group"]}"] .palette__options`)?.append(option.element);
    }
    if (results) results.hidden = true;
    for (const group of groups) group.hidden = false;
    visible = all;
  };

  /** Ranks options for the query and shows them as one flat list, best match first. */
  const filter = () => {
    const query = input.value.trim();
    if (query && results) {
      visible = rankCommands(all, query);
      results.replaceChildren(...visible.map((option) => option.element));
      results.hidden = false;
      for (const group of groups) group.hidden = true;
    } else {
      restore();
    }
    for (const option of all) option.element.setAttribute("aria-selected", "false");
    if (query) announce(resultCount(visible.length));
    if (empty) empty.hidden = visible.length > 0;
    highlight(visible.length > 0 ? 0 : -1);
  };

  const plural = new Intl.PluralRules(document.documentElement.lang || "en-GB");
  /** "3 results", from the translated one/other templates on the dialog. */
  const resultCount = (count: number) =>
    (dialog.dataset[plural.select(count) === "one" ? "countOne" : "countOther"] ?? "").replace("#", String(count));

  const announce = (message: string) => {
    if (status) status.textContent = message;
  };

  const activate = async (option: Option | undefined) => {
    if (!option) {
      const query = input.value.trim();
      if (query) window.location.assign(`/search/?q=${encodeURIComponent(query)}`);
      return;
    }
    const { action } = option.element.dataset;
    const raw = option.element.dataset["href"];
    const href = raw ? sameOriginPath(raw, window.location.origin) : undefined;
    if (href) {
      dialog.close();
      if (action === "download") {
        const link = document.createElement("a");
        link.href = href;
        link.download = "";
        link.click();
      } else {
        window.location.assign(href);
      }
      return;
    }
    if (action === "copy") {
      const value = option.element.dataset["value"] ?? "";
      try {
        await navigator.clipboard.writeText(value);
        announce(option.element.dataset["done"] ?? "");
      } catch {
        window.location.assign(`mailto:${encodeURIComponent(value)}`);
      }
      return;
    }
    if (action === "search") {
      const query = input.value.trim();
      window.location.assign(query ? `/search/?q=${encodeURIComponent(query)}` : "/search/");
      return;
    }
    dialog.close();
    if (action === "theme") cycleTheme();
    if (action === "terminal") document.dispatchEvent(new Event("terminal:open"));
    if (action === "shortcuts") document.dispatchEvent(new Event("shortcuts:open"));
  };

  const open = () => {
    if (dialog.open) return;
    input.value = "";
    announce("");
    filter();
    dialog.showModal();
    input.focus();
  };

  input.addEventListener("input", filter, options);
  input.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        highlight(moveIndex(active, event.key === "ArrowDown" ? 1 : -1, visible.length));
      } else if (event.key === "Home" || event.key === "End") {
        if (visible.length === 0) return;
        event.preventDefault();
        highlight(event.key === "Home" ? 0 : visible.length - 1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        void activate(visible[active]);
      }
    },
    options,
  );
  list.addEventListener(
    "click",
    (event) => {
      const element = (event.target as Element).closest<HTMLElement>("[role=option]");
      const option = all.find((candidate) => candidate.element === element);
      if (option) void activate(option);
    },
    options,
  );
  list.addEventListener(
    "pointermove",
    (event) => {
      const element = (event.target as Element).closest<HTMLElement>("[role=option]");
      const index = visible.findIndex((candidate) => candidate.element === element);
      if (index !== -1 && index !== active) highlight(index);
    },
    options,
  );
  dialog.addEventListener(
    "click",
    (event) => {
      if (event.target === dialog || (event.target as Element).closest("[data-palette-close]")) dialog.close();
    },
    options,
  );
  return open;
};
