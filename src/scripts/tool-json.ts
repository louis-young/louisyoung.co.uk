import { formatJson, type Indent, type JsonError } from "../lib/json-tool";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

/** The JSON formatter on /tools/json/. */
export const initJson = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-json]");
  if (!tool) return;
  const input = tool.querySelector<HTMLTextAreaElement>("[data-input]")!;
  const indent = tool.querySelector<HTMLSelectElement>("[data-indent]")!;
  const sort = tool.querySelector<HTMLInputElement>("[data-sort]")!;
  const output = tool.querySelector<HTMLTextAreaElement>("[data-output]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const copy = tool.querySelector<HTMLButtonElement>("[data-copy]")!;
  const message = (name: string) => tool.dataset[name] ?? "";
  let formatted = "";

  const describe = (error: JsonError) => {
    const reason =
      error.reason === "token"
        ? fill(message("errorToken"), { token: error.token })
        : message(error.reason === "end" ? "errorEnd" : "errorDepth");
    return fill(message("errorAt"), { line: error.line, column: error.column, reason });
  };

  const update = () => {
    const result = formatJson(input.value, { indent: indent.value as Indent, sort: sort.checked });
    const failed = "error" in result;
    input.setAttribute("aria-invalid", String(failed));
    status.toggleAttribute("data-invalid", failed);
    copy.textContent = message("copyText");
    formatted = failed ? "" : result.output;
    output.value = formatted;
    copy.disabled = formatted === "";
    if (failed) status.textContent = describe(result.error);
    else if (formatted === "") status.textContent = message("empty");
    else {
      const count = formatted.length;
      status.textContent = fill(message(count === 1 ? "validOne" : "validOther"), {
        count: count.toLocaleString("en-GB"),
      });
    }
  };

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      copy.textContent = message("copied");
    } catch {
      /* Selecting the result by hand still works. */
    }
  };

  input.addEventListener("input", update);
  indent.addEventListener("change", update);
  sort.addEventListener("change", update);
  copy.addEventListener("click", () => {
    void copyOutput();
  });
  update();
};
