import { isFiltered, matchesSnippet, type SnippetQuery } from "../lib/snippet-filter";

/** The URL parameters the filter reads and writes, so a filtered list can be shared. */
const params = { query: "q", language: "language", tag: "tag" } as const;

/**
 * The filter on /snippets/. Every snippet is already in the HTML; this hides the cards that don't
 * match the search box, language and tag, announces the count, and mirrors the filter in the URL.
 * Safe to call more than once.
 */
export const initSnippetFilter = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-snippets]");
  if (!tool || tool.hasAttribute("data-ready")) return;
  tool.setAttribute("data-ready", "");
  const search = tool.querySelector<HTMLInputElement>("[data-snippet-query]")!;
  const status = tool.querySelector<HTMLElement>("[data-snippet-status]")!;
  const empty = tool.querySelector<HTMLElement>("[data-snippet-empty]")!;
  const items = [...tool.querySelectorAll<HTMLElement>("[data-snippet]")].map((element) => ({
    element,
    entry: {
      text: element.dataset["text"] ?? "",
      language: element.dataset["language"] ?? "",
      tags: (element.dataset["tags"] ?? "").split(" ").filter(Boolean),
    },
  }));
  const radio = (name: string, value: string) =>
    tool.querySelector<HTMLInputElement>(`input[name="${name}"][value="${CSS.escape(value)}"]`);
  const chosen = (name: string) => tool.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? "";
  const message = (key: string, count: number) => (tool.dataset[key] ?? "").replace("{count}", String(count));

  const read = (): SnippetQuery => ({ query: search.value, language: chosen("language"), tag: chosen("tag") });

  const update = () => {
    const query = read();
    let shown = 0;
    for (const { element, entry } of items) {
      element.hidden = !matchesSnippet(entry, query);
      if (!element.hidden) shown += 1;
    }
    empty.hidden = shown > 0;
    const key = !isFiltered(query) ? "countAll" : shown === 0 ? "countNone" : shown === 1 ? "countOne" : "countOther";
    const text = message(key, shown);
    // Only touch the live region when the message changes, so it isn't announced twice.
    if (status.textContent !== text) status.textContent = text;

    const url = new URL(window.location.href);
    for (const [name, value] of [
      [params.query, query.query.trim()],
      [params.language, query.language],
      [params.tag, query.tag],
    ] as const) {
      if (value) url.searchParams.set(name, value);
      else url.searchParams.delete(name);
    }
    if (url.href !== window.location.href) history.replaceState(history.state, "", url);
  };

  // A filter in the URL wins over the defaults, but not over anything typed before this loaded.
  const initial = new URLSearchParams(window.location.search);
  const query = initial.get(params.query);
  if (query && !search.value) search.value = query;
  for (const name of [params.language, params.tag]) {
    const input = radio(name, initial.get(name) ?? "");
    if (input && initial.has(name)) input.checked = true;
  }

  tool.addEventListener("input", update);
  tool.querySelector("[data-snippet-clear]")?.addEventListener("click", () => {
    search.value = "";
    for (const name of [params.language, params.tag]) {
      const input = radio(name, "");
      if (input) input.checked = true;
    }
    update();
    search.focus();
  });
  update();
};
