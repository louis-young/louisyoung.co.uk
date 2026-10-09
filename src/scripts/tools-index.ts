import { isToolFilterActive, matchesTool, type ToolQuery } from "../lib/tool-filter";

/**
 * The search box and category chips on /tools/. Every tool is already in the HTML, grouped by
 * category; this hides the cards that don't match, hides categories left empty, and announces the
 * count. Loaded on first use, so it reads whatever was typed before it arrived. Safe to call more
 * than once.
 */
export const initToolsIndex = (root: ParentNode = document) => {
  const index = root.querySelector<HTMLElement>("[data-tools]");
  if (!index || index.hasAttribute("data-ready")) return;
  index.setAttribute("data-ready", "");
  const search = index.querySelector<HTMLInputElement>("[data-tools-query]")!;
  const status = index.querySelector<HTMLElement>("[data-tools-status]")!;
  const empty = index.querySelector<HTMLElement>("[data-tools-empty]")!;
  const recent = index.querySelector<HTMLElement>("[data-recent]");
  const groups = [...index.querySelectorAll<HTMLElement>("[data-tool-group]")];
  const items = [...index.querySelectorAll<HTMLElement>("[data-tool]")].map((element) => ({
    element,
    entry: { text: element.dataset["text"] ?? "", category: element.dataset["category"] ?? "" },
  }));
  const message = (key: string, count: number) => (index.dataset[key] ?? "").replace("{count}", String(count));

  const read = (): ToolQuery => ({
    query: search.value,
    category: index.querySelector<HTMLInputElement>('input[name="category"]:checked')?.value ?? "",
  });

  const update = () => {
    const query = read();
    let shown = 0;
    for (const { element, entry } of items) {
      element.hidden = !matchesTool(entry, query);
      if (!element.hidden) shown += 1;
    }
    for (const group of groups) group.hidden = !group.querySelector("[data-tool]:not([hidden])");
    empty.hidden = shown > 0;
    // "Recently used" is a shortcut for the unfiltered page; while filtering it would only repeat cards.
    recent?.toggleAttribute("data-suppressed", isToolFilterActive(query));
    const key = !isToolFilterActive(query)
      ? "countAll"
      : shown === 0
        ? "countNone"
        : shown === 1
          ? "countOne"
          : "countOther";
    const text = message(key, shown);
    // Only touch the live region when the message changes, so it isn't announced twice.
    if (status.textContent !== text) status.textContent = text;
  };

  index.addEventListener("input", update);
  index.querySelector("[data-tools-clear]")?.addEventListener("click", () => {
    search.value = "";
    const all = index.querySelector<HTMLInputElement>('input[name="category"][value=""]');
    if (all) all.checked = true;
    update();
    search.focus();
  });
  update();
};
