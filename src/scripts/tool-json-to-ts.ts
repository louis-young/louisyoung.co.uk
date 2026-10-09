import { jsonToTypes, type TypeOptions } from "../lib/json-to-ts-tool";
import type { JsonError } from "../lib/json-tool";
import { copyText } from "./tool-copy";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

/** The JSON to TypeScript generator on /tools/json-to-ts/. */
export const initJsonToTs = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-jsonts]");
  if (!tool) return;
  const input = tool.querySelector<HTMLTextAreaElement>("[data-input]")!;
  const rootName = tool.querySelector<HTMLInputElement>("[data-root]")!;
  const styles = [...tool.querySelectorAll<HTMLInputElement>("[data-style]")];
  const readonly = tool.querySelector<HTMLInputElement>("[data-readonly]")!;
  const exported = tool.querySelector<HTMLInputElement>("[data-export]")!;
  const output = tool.querySelector<HTMLTextAreaElement>("[data-output]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const copy = tool.querySelector<HTMLButtonElement>("[data-copy]")!;
  const message = (name: string) => tool.dataset[name] ?? "";

  const describe = (error: JsonError) => {
    const reason =
      error.reason === "token"
        ? fill(message("errorToken"), { token: error.token })
        : message(error.reason === "end" ? "errorEnd" : "errorDepth");
    return fill(message("errorAt"), { line: error.line, column: error.column, reason });
  };

  const update = () => {
    const options: TypeOptions = {
      rootName: rootName.value,
      style: styles.find((style) => style.checked)?.value === "type" ? "type" : "interface",
      readonly: readonly.checked,
      export: exported.checked,
    };
    const result = jsonToTypes(input.value, options);
    const failed = "error" in result;
    input.setAttribute("aria-invalid", String(failed));
    status.toggleAttribute("data-invalid", failed);
    output.value = failed ? "" : result.output;
    copy.disabled = output.value === "";
    if (failed) status.textContent = describe(result.error);
    else if (result.count === 0) status.textContent = message("empty");
    else status.textContent = fill(message(result.count === 1 ? "countOne" : "countOther"), { count: result.count });
  };

  tool.addEventListener("input", update);
  tool.addEventListener("change", update);
  copy.addEventListener("click", () => {
    void copyText(copy, output.value, message("copied"));
  });
  update();
};
