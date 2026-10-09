import {
  moveIndex,
  parsePaletteIndex,
  rankCommands,
  sameOriginPath,
  type PaletteIndex,
  type PaletteOptionData,
} from "../lib/palette";
import { mayHaveQuickAnswer } from "../lib/quick-answer-trigger";
import type * as Answers from "./palette-answer";
import { cycleTheme } from "./theme";

export interface PaletteOption extends PaletteOptionData {
  element: HTMLElement;
  keywords: string;
  /** The group it belongs in when nothing is typed. Quick answers have none. */
  group?: string;
  /** Runs instead of the built-in behaviour, e.g. copying a quick answer. */
  run?: () => void;
  /** What ⌘/Ctrl+Enter activates instead, e.g. the tool behind a quick answer. */
  alternate?: PaletteOption;
}

type AnswersModule = typeof Answers;

const keys = new Set(["ArrowDown", "ArrowUp", "Home", "End", "Enter"]);

/**
 * The ⌘K command palette: a native modal `<dialog>` with an ARIA combobox and listbox. The page
 * holds only its shell; the options come from the palette index (`/palette.json`), fetched when the
 * palette is first warmed. `index` is that request, if the caller has already started it.
 */
export const initPalette = ({ signal, index }: { signal?: AbortSignal; index?: Promise<Response> } = {}) => {
  const listen = { signal } as AddEventListenerOptions;
  const dialog = document.querySelector<HTMLDialogElement>("#palette");
  const input = dialog?.querySelector<HTMLInputElement>("[role=combobox]");
  const list = dialog?.querySelector<HTMLElement>("[role=listbox]");
  if (!dialog || !input || !list) return () => undefined;
  const find = (selector: string) => dialog.querySelector<HTMLElement>(selector);
  const empty = find("[data-palette-empty]");
  const status = find("[data-palette-status]");
  const loading = find("[data-palette-loading]");
  const failure = find("[data-palette-error]");
  const results = list.querySelector<HTMLElement>("[data-palette-results]");
  const groups = [...list.querySelectorAll<HTMLElement>("[role=group]")];

  let data: PaletteIndex | undefined;
  let state: "loading" | "ready" | "error" = "loading";
  let all: PaletteOption[] = [];
  let visible: PaletteOption[] = [];
  let active = -1;
  /** A key pressed before the options arrived, replayed once they have. */
  let pending: { key: string; alternate: boolean } | undefined;
  let answersModule: AnswersModule | undefined;
  let answersLoading: Promise<AnswersModule> | undefined;

  const announce = (message: string) => {
    if (status) status.textContent = message;
  };

  const plural = new Intl.PluralRules(document.documentElement.lang || "en-GB");
  /** "3 results", from the translated one/other templates on the dialog. */
  const resultCount = (count: number) =>
    (dialog.dataset[plural.select(count) === "one" ? "countOne" : "countOther"] ?? "").replace("#", String(count));

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

  /** Builds one option with DOM APIs. Text goes in through `textContent`, never as markup. */
  const build = (group: string, option: PaletteOptionData, position: number): PaletteOption => {
    const element = document.createElement("div");
    element.setAttribute("role", "option");
    element.id = `palette-${group}-${position}`;
    element.className = "palette__option";
    element.setAttribute("aria-selected", "false");
    const title = document.createElement("span");
    title.className = "palette__title";
    title.textContent = option.title;
    element.append(title);
    if (option.hint) {
      const hint = document.createElement("span");
      hint.className = "palette__hint";
      hint.setAttribute("aria-hidden", "true");
      hint.textContent = option.hint;
      element.append(hint);
    }
    return { ...option, element, group, keywords: option.keywords ?? "" };
  };

  const render = (index: PaletteIndex) => {
    all = index.groups.flatMap(({ id, options }) => {
      const container = list.querySelector(`[data-group="${id}"] .palette__options`);
      if (!container) return [];
      const built = options.map((option, position) => build(id, option, position));
      container.replaceChildren(...built.map(({ element }) => element));
      return built;
    });
  };

  /** Puts every option back in its group, in authored order, and shows the groups that have any. */
  const restore = () => {
    for (const option of all) {
      list.querySelector(`[data-group="${option.group ?? ""}"] .palette__options`)?.append(option.element);
    }
    results?.replaceChildren();
    if (results) results.hidden = true;
    for (const group of groups) {
      group.hidden = state !== "ready" || !all.some((option) => option.group === group.dataset["group"]);
    }
    visible = all;
  };

  const loadAnswers = () => {
    answersLoading ??= import("./palette-answer").then(
      (module) => (answersModule = module),
      (error: unknown) => {
        // Let a later query try again, e.g. once the connection is back.
        answersLoading = undefined;
        throw error;
      },
    );
    return answersLoading;
  };

  /** The quick answer for the query, if it has one. Its code loads only for queries that might. */
  const answersFor = (query: string): PaletteOption[] => {
    if (!data || !query || !mayHaveQuickAnswer(query)) return [];
    if (answersModule) return answersModule.answerOptions(query, data, all, announce);
    void loadAnswers().then(
      () => {
        if (input.value.trim() === query) filter();
      },
      // Offline before it loaded: the pages still work, just without the answer.
      () => undefined,
    );
    return [];
  };

  /** Ranks options for the query and shows them as one flat list, best match first. */
  const filter = () => {
    const query = input.value.trim();
    const answers = answersFor(query);
    let matches = all;
    if (query && results && state === "ready") {
      matches = rankCommands(all, query);
      visible = [...answers, ...matches];
      results.replaceChildren(...visible.map((option) => option.element));
      results.hidden = false;
      for (const group of groups) group.hidden = true;
    } else {
      restore();
    }
    for (const option of all) option.element.setAttribute("aria-selected", "false");
    if (query && state === "ready") {
      const answer = answers[0]?.element.getAttribute("aria-label");
      announce(answer ? `${answer} ${resultCount(matches.length)}` : resultCount(matches.length));
    }
    if (empty) empty.hidden = state !== "ready" || visible.length > 0;
    highlight(visible.length > 0 ? 0 : -1);
  };

  const show = (next: typeof state) => {
    state = next;
    if (loading) loading.hidden = state !== "loading";
    if (failure) failure.hidden = state !== "error";
    // An empty listbox is expected while its options load, not a broken one.
    list.toggleAttribute("aria-busy", state === "loading");
    if (state === "loading" && dialog.open) announce(loading?.textContent.trim() ?? "");
    if (state === "error" && dialog.open) announce(failure?.querySelector("p")?.textContent.trim() ?? "");
  };

  const load = (request: Promise<Response> = fetch(dialog.dataset["index"] ?? "")) => {
    show("loading");
    filter();
    request
      .then((response) => {
        if (!response.ok) throw new Error(`The palette index returned ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        const parsed = parsePaletteIndex(value);
        if (!parsed) throw new Error("The palette index is malformed");
        data = parsed;
        render(parsed);
        show("ready");
        filter();
        if (pending) handleKey(pending.key, pending.alternate);
        pending = undefined;
      })
      .catch(() => {
        pending = undefined;
        show("error");
        filter();
      });
  };

  const navigate = (href: string) => {
    const here = `${window.location.pathname}${window.location.search}`;
    window.location.assign(href);
    // A new fragment alone doesn't reload the page, and a tool reads its share link on load.
    const [path] = href.split("#");
    if (href.includes("#") && path === here) window.location.reload();
  };

  const activate = async (option: PaletteOption | undefined, alternate = false) => {
    if (!option) {
      const query = input.value.trim();
      if (query && state === "ready") window.location.assign(`/search/?q=${encodeURIComponent(query)}`);
      return;
    }
    if (alternate && option.alternate) {
      await activate(option.alternate);
      return;
    }
    if (option.run) {
      option.run();
      return;
    }
    const { action } = option;
    const href = option.href ? sameOriginPath(option.href, window.location.origin) : undefined;
    if (href) {
      dialog.close();
      if (action === "download") {
        const link = document.createElement("a");
        link.href = href;
        link.download = "";
        link.click();
      } else {
        navigate(href);
      }
      return;
    }
    if (action === "copy") {
      const value = option.value ?? "";
      try {
        await navigator.clipboard.writeText(value);
        announce(option.done ?? "");
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

  function handleKey(key: string, alternate: boolean) {
    if (key === "ArrowDown" || key === "ArrowUp") {
      highlight(moveIndex(active, key === "ArrowDown" ? 1 : -1, visible.length));
    } else if (key === "Home" || key === "End") {
      if (visible.length > 0) highlight(key === "Home" ? 0 : visible.length - 1);
    } else if (key === "Enter") {
      void activate(visible[active], alternate);
    }
  }

  const open = () => {
    if (dialog.open) return;
    input.value = "";
    announce("");
    filter();
    dialog.showModal();
    input.focus();
    if (state === "loading") show("loading");
    // Reopening after a failed load tries again.
    if (state === "error") load();
  };

  input.addEventListener("input", filter, listen);
  input.addEventListener(
    "keydown",
    (event) => {
      if (!keys.has(event.key)) return;
      event.preventDefault();
      const alternate = event.metaKey || event.ctrlKey;
      // Keys pressed while the options load (say, a quick ⌘K then Enter) apply once they arrive.
      if (state === "loading") pending = { key: event.key, alternate };
      else handleKey(event.key, alternate);
    },
    listen,
  );
  list.addEventListener(
    "click",
    (event) => {
      const element = (event.target as Element).closest<HTMLElement>("[role=option]");
      const option = visible.find((candidate) => candidate.element === element);
      if (option) void activate(option);
    },
    listen,
  );
  list.addEventListener(
    "pointermove",
    (event) => {
      const element = (event.target as Element).closest<HTMLElement>("[role=option]");
      const index = visible.findIndex((candidate) => candidate.element === element);
      if (index !== -1 && index !== active) highlight(index);
    },
    listen,
  );
  dialog.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element;
      if (target === dialog || target.closest("[data-palette-close]")) dialog.close();
      if (target.closest("[data-palette-retry]")) {
        // The button is about to hide, so keep focus in the search box.
        input.focus();
        load();
      }
    },
    listen,
  );

  load(index);
  return open;
};
