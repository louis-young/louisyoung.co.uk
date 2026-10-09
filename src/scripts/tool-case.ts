import { type CaseName, convertAll } from "../lib/case-tool";
import { copyText } from "./tool-copy";

/** The case converter on /tools/case/. */
export const initCase = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-case]");
  if (!tool) return;
  const input = tool.querySelector<HTMLTextAreaElement>("[data-input]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const values = [...tool.querySelectorAll<HTMLElement>("[data-value]")];
  const message = (name: string) => tool.dataset[name] ?? "";
  let converted = convertAll("");

  const update = () => {
    converted = convertAll(input.value);
    for (const value of values) value.textContent = converted[value.dataset["value"] as CaseName];
    const lines = input.value.split(/\r?\n/u).filter((line) => line.trim() !== "").length;
    status.textContent =
      lines === 0
        ? message("empty")
        : message(lines === 1 ? "linesOne" : "linesOther").replace("{count}", String(lines));
  };

  for (const button of tool.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    button.addEventListener("click", () => {
      void copyText(button, converted[button.dataset["copy"] as CaseName], message("copied"));
    });
  }
  input.addEventListener("input", update);
  update();
};
