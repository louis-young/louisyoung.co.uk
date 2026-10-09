import { formatSql, type KeywordCase, type SqlIndent } from "../lib/sql-tool";
import { copyText } from "./tool-copy";

/** The SQL formatter on /tools/sql/. */
export const initSql = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-sql]");
  if (!tool) return;
  const input = tool.querySelector<HTMLTextAreaElement>("[data-input]")!;
  const cases = [...tool.querySelectorAll<HTMLInputElement>("[data-case]")];
  const indent = tool.querySelector<HTMLSelectElement>("[data-indent]")!;
  const minify = tool.querySelector<HTMLInputElement>("[data-minify]")!;
  const output = tool.querySelector<HTMLTextAreaElement>("[data-output]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const copy = tool.querySelector<HTMLButtonElement>("[data-copy]")!;
  const message = (name: string) => tool.dataset[name] ?? "";

  const update = () => {
    const keywordCase = (cases.find((option) => option.checked)?.value ?? "upper") as KeywordCase;
    indent.disabled = minify.checked;
    const result = formatSql(input.value, {
      keywordCase,
      indent: indent.value as SqlIndent,
      minify: minify.checked,
    });
    output.value = result.output;
    copy.disabled = result.output === "";
    const warning = result.unchanged || result.unterminated;
    status.toggleAttribute("data-invalid", warning);
    if (result.unchanged) status.textContent = message("unchanged");
    else if (result.unterminated) status.textContent = message("unterminated");
    else if (result.statements === 0) status.textContent = message("empty");
    else {
      const kind = minify.checked ? "minified" : "formatted";
      const key = `${kind}${result.statements === 1 ? "One" : "Other"}`;
      status.textContent = message(key).replace("{count}", String(result.statements));
    }
  };

  tool.addEventListener("input", update);
  tool.addEventListener("change", update);
  copy.addEventListener("click", () => {
    void copyText(copy, output.value, message("copied"));
  });
  update();
};
