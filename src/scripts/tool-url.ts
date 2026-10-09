import {
  type EditablePart,
  type Param,
  type ParsedUrl,
  parseUrl,
  readable,
  setParams,
  setPart,
  type UrlIssue,
} from "../lib/url-tool";
import { copyText } from "./tool-copy";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

const issueKey = (issue: UrlIssue) => `issue${issue.charAt(0).toUpperCase()}${issue.slice(1)}`;

/** The URL parser and builder on /tools/url/: the URL, its parts and its query kept in step. */
export const initUrl = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-url]");
  if (!tool) return;
  const input = tool.querySelector<HTMLTextAreaElement>("[data-input]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const issueList = tool.querySelector<HTMLElement>("[data-issues]")!;
  const partFields = [...tool.querySelectorAll<HTMLInputElement>("[data-part]")];
  const partsSet = tool.querySelector<HTMLFieldSetElement>("[data-parts]")!;
  const paramsSet = tool.querySelector<HTMLFieldSetElement>("[data-params]")!;
  const rows = tool.querySelector<HTMLTableSectionElement>("[data-rows]")!;
  const template = tool.querySelector<HTMLTemplateElement>("[data-row-template]")!;
  const add = tool.querySelector<HTMLButtonElement>("[data-add]")!;
  const announce = tool.querySelector<HTMLElement>("[data-announce]")!;
  const encodeButton = tool.querySelector<HTMLButtonElement>("[data-encode]")!;
  const decodeButton = tool.querySelector<HTMLButtonElement>("[data-decode]")!;
  const copy = tool.querySelector<HTMLButtonElement>("[data-copy]")!;
  const outputs = {
    origin: tool.querySelector<HTMLElement>("[data-origin]")!,
    host: tool.querySelector<HTMLElement>("[data-host]")!,
    readable: tool.querySelector<HTMLElement>("[data-readable]")!,
    href: tool.querySelector<HTMLElement>("[data-href]")!,
  };
  const message = (key: string) => tool.dataset[key] ?? "";
  let current: ParsedUrl | undefined;

  const errorOf = (field: HTMLInputElement) => tool.querySelector<HTMLElement>(`#${field.id}-error`)!;
  const setError = (field: HTMLInputElement, text: string) => {
    field.setAttribute("aria-invalid", String(text !== ""));
    const error = errorOf(field);
    error.textContent = text;
    error.hidden = text === "";
  };

  /** Numbers each row's labels, so "Value of parameter 2" stays true after a row goes. */
  const labelRows = () => {
    for (const [index, row] of [...rows.rows].entries()) {
      const n = { n: index + 1 };
      row.querySelector("[data-name]")!.setAttribute("aria-label", fill(message("paramName"), n));
      row.querySelector("[data-param]")!.setAttribute("aria-label", fill(message("paramValue"), n));
      row.querySelector("[data-remove-label]")!.textContent = fill(message("paramRemove"), n);
    }
  };

  const makeRow = ([name, value]: Param) => {
    const row = (template.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLTableRowElement;
    row.querySelector<HTMLInputElement>("[data-name]")!.value = name;
    row.querySelector<HTMLInputElement>("[data-param]")!.value = value;
    return row;
  };

  const renderRows = (params: readonly Param[]) => {
    rows.replaceChildren(...params.map(makeRow));
    labelRows();
  };

  const readRows = () =>
    [...rows.rows].map((row): Param => [
      row.querySelector<HTMLInputElement>("[data-name]")!.value,
      row.querySelector<HTMLInputElement>("[data-param]")!.value,
    ]);

  const describeStatus = (url: ParsedUrl) => {
    const count = url.params.length;
    const key = count === 0 ? "validNone" : count === 1 ? "validOne" : "validOther";
    return fill(message(key), { count });
  };

  /** Shows `url` in the outputs, and in the parts except the one being typed in. */
  const show = (url: ParsedUrl, source?: HTMLInputElement) => {
    current = url;
    for (const field of partFields) {
      if (field === source) continue;
      field.value = url[field.dataset["part"] as EditablePart];
      setError(field, "");
    }
    outputs.origin.textContent = url.origin;
    outputs.host.textContent = url.host;
    outputs.readable.textContent = readable(url.href);
    outputs.href.textContent = url.href;
    status.removeAttribute("data-invalid");
    status.textContent = describeStatus(url);
  };

  const setEnabled = (enabled: boolean) => {
    partsSet.disabled = !enabled;
    paramsSet.disabled = !enabled;
    for (const button of [encodeButton, decodeButton, copy]) button.disabled = !enabled;
  };

  const parseInput = () => {
    const result = parseUrl(input.value);
    issueList.replaceChildren(
      ...result.issues.map((issue) => {
        const item = document.createElement("li");
        item.textContent = message(issueKey(issue));
        return item;
      }),
    );
    issueList.hidden = result.issues.length === 0;
    setEnabled(result.ok);
    if (result.ok) {
      show(result.url);
      renderRows(result.url.params);
      return;
    }
    current = undefined;
    for (const output of Object.values(outputs)) output.textContent = "";
    status.toggleAttribute("data-invalid", result.reason === "invalid");
    status.textContent = message(result.reason === "invalid" ? "invalidUrl" : "empty");
  };

  /** A change made in the parts or the query: write the rebuilt URL back into the input. */
  const rebuilt = (url: ParsedUrl, source?: HTMLInputElement) => {
    input.value = url.href;
    issueList.replaceChildren();
    issueList.hidden = true;
    show(url, source);
  };

  input.addEventListener("input", parseInput);

  for (const field of partFields) {
    field.addEventListener("input", () => {
      if (!current) return;
      const result = setPart(current.href, field.dataset["part"] as EditablePart, field.value);
      if (!result.applied) {
        setError(field, message("rejected"));
        return;
      }
      rebuilt(result.url, field);
      setError(field, "");
    });
    // Once you leave a part, show it the way the URL now has it (`HTTP` becomes `http:`). A rejected
    // value stays, with its message, so the layout doesn't jump under the pointer as you click away.
    field.addEventListener("change", () => {
      if (current && field.getAttribute("aria-invalid") !== "true") {
        field.value = current[field.dataset["part"] as EditablePart];
      }
    });
  }

  rows.addEventListener("input", () => {
    if (current) rebuilt(setParams(current.href, readRows()));
  });

  rows.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-remove]");
    if (!button || !current) return;
    const row = button.closest("tr")!;
    const next = row.nextElementSibling ?? row.previousElementSibling;
    row.remove();
    labelRows();
    rebuilt(setParams(current.href, readRows()));
    announce.textContent = message("removed");
    (next?.querySelector<HTMLInputElement>("[data-name]") ?? add).focus();
  });

  add.addEventListener("click", () => {
    const row = makeRow(["", ""]);
    rows.append(row);
    labelRows();
    announce.textContent = fill(message("added"), { n: rows.rows.length });
    row.querySelector<HTMLInputElement>("[data-name]")!.focus();
  });

  encodeButton.addEventListener("click", () => {
    if (!current) return;
    input.value = current.href;
    parseInput();
  });

  decodeButton.addEventListener("click", () => {
    if (!current) return;
    input.value = readable(current.href);
    parseInput();
  });

  copy.addEventListener("click", () => {
    if (current) void copyText(copy, current.href, message("copied"));
  });

  parseInput();
};
