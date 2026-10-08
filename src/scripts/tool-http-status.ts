import { matchesStatus, statusClass } from "../lib/http-status-tool";

/**
 * The HTTP status code reference on /tools/http-status/. Every code is in the HTML already; this
 * only hides the ones that don’t match the search and class filter.
 */
export const initHttpStatus = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-http]");
  if (!tool) return;
  const search = tool.querySelector<HTMLInputElement>("[data-search]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const groups = [...tool.querySelectorAll<HTMLElement>("[data-group]")];
  const items = [...tool.querySelectorAll<HTMLElement>("[data-code]")].map((element) => ({
    element,
    code: Number(element.dataset["code"]),
    text: element.textContent,
  }));
  const message = (key: string) => tool.dataset[key] ?? "";

  const update = () => {
    const chosen = tool.querySelector<HTMLInputElement>('[name="http-class"]:checked')?.value ?? "all";
    let shown = 0;
    for (const item of items) {
      const visible =
        (chosen === "all" || statusClass(item.code) === Number(chosen)) &&
        matchesStatus(search.value, item.code, item.text);
      item.element.hidden = !visible;
      if (visible) shown++;
    }
    for (const group of groups) {
      group.hidden = !group.querySelector("[data-code]:not([hidden])");
    }
    const key = shown === 0 ? "countNone" : shown === 1 ? "countOne" : "countOther";
    status.textContent = message(key).replace("{count}", String(shown));
  };

  tool.addEventListener("input", update);
  tool.addEventListener("change", update);
  update();
};
