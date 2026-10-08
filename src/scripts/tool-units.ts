import { convertAll, isUnit } from "../lib/units-tool";
import { copyText } from "./tool-copy";

/** The CSS unit converter on /tools/units/. */
export const initUnits = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-units]");
  if (!tool) return;
  const error = tool.querySelector<HTMLElement>("[data-error]")!;
  const field = (name: string) => tool.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
  const number = (name: string) => (field(name).value.trim() === "" ? Number.NaN : Number(field(name).value));
  const row = (unit: string) => tool.querySelector<HTMLElement>(`tr[data-unit="${unit}"]`);

  const update = () => {
    const from = field("unit").value;
    if (!isUnit(from)) return;
    const result = convertAll(number("value"), from, {
      root: number("root"),
      parent: number("parent"),
      viewportWidth: number("viewportWidth"),
      viewportHeight: number("viewportHeight"),
    });
    if ("error" in result) {
      error.textContent = tool.dataset[result.error === "value" ? "errorValue" : "errorContext"] ?? "";
      error.hidden = false;
      return;
    }
    error.hidden = true;
    for (const { unit, css } of result.rows) {
      const item = row(unit);
      if (!item) continue;
      item.querySelector("[data-value]")!.textContent = css;
      item.toggleAttribute("data-current", unit === from);
    }
  };

  tool.addEventListener("input", update);
  tool.addEventListener("change", update);
  for (const button of tool.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    button.addEventListener("click", () => {
      const text = row(button.dataset["copy"] ?? "")?.querySelector("[data-value]")?.textContent ?? "";
      void copyText(button, text, tool.dataset["copied"] ?? "");
    });
  }
  update();
};
