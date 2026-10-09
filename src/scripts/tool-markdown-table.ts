import { type Align, alignments, normalise, parseTable, type Table, toMarkdown } from "../lib/markdown-table-tool";
import { copyText } from "./tool-copy";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className !== undefined) node.className = className;
  return node;
};

/** The Markdown table generator on /tools/markdown-table/. */
export const initMarkdownTable = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-markdown-table]");
  if (!tool) return;
  const grid = tool.querySelector<HTMLTableElement>("[data-grid]")!;
  const addRow = tool.querySelector<HTMLButtonElement>("[data-add-row]")!;
  const addColumn = tool.querySelector<HTMLButtonElement>("[data-add-column]")!;
  const announce = tool.querySelector<HTMLElement>("[data-announce]")!;
  const importInput = tool.querySelector<HTMLTextAreaElement>("[data-import-input]")!;
  const importButton = tool.querySelector<HTMLButtonElement>("[data-import]")!;
  const importStatus = tool.querySelector<HTMLElement>("[data-import-status]")!;
  const compact = tool.querySelector<HTMLInputElement>("[data-compact]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const output = tool.querySelector<HTMLTextAreaElement>("[data-output]")!;
  const copy = tool.querySelector<HTMLButtonElement>("[data-copy]")!;
  const message = (key: string) => tool.dataset[key] ?? "";
  const initial = tool.dataset["table"];
  let table = normalise(initial ? (JSON.parse(initial) as Table) : { headers: [], rows: [], align: [] });

  const columns = () => table.headers.length;

  const writeOutput = () => {
    output.value = toMarkdown(table, compact.checked);
    status.textContent = fill(message("size"), { columns: columns(), rows: table.rows.length });
  };

  /** A text input for row `row` (0 is the header row) and column `column`. */
  const cellInput = (row: number, column: number) => {
    const values = { row, column: column + 1 };
    const input = element("input");
    input.type = "text";
    input.value = (row === 0 ? table.headers[column] : table.rows[row - 1]![column]) ?? "";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("aria-label", fill(message(row === 0 ? "headerCell" : "cell"), values));
    input.dataset["row"] = String(row);
    input.dataset["column"] = String(column);
    return input;
  };

  const removeButton = (label: string, data: string, index: number, disabled: boolean) => {
    const button = element("button", undefined, "mdt__remove");
    button.type = "button";
    button.disabled = disabled;
    button.dataset[data] = String(index);
    button.append(element("span", "×"), element("span", label, "visually-hidden"));
    button.firstElementChild!.setAttribute("aria-hidden", "true");
    return button;
  };

  const render = () => {
    const head = element("thead");
    const names = element("tr");
    names.append(element("td"));
    const controls = element("tr");
    controls.append(element("td"));
    for (let column = 0; column < columns(); column += 1) {
      const name = element("th", fill(message("column"), { column: column + 1 }));
      name.scope = "col";
      names.append(name);
      const select = element("select");
      select.setAttribute("aria-label", fill(message("alignLabel"), { column: column + 1 }));
      select.dataset["align"] = String(column);
      for (const align of alignments) {
        const option = element("option", message(align));
        option.value = align;
        option.selected = table.align[column] === align;
        select.append(option);
      }
      const wrap = element("div", undefined, "mdt__column");
      wrap.append(
        select,
        removeButton(
          fill(message("removeColumnLabel"), { column: column + 1 }),
          "removeColumn",
          column,
          columns() === 1,
        ),
      );
      const cell = element("td");
      cell.append(wrap);
      controls.append(cell);
    }
    names.append(element("td"));
    controls.append(element("td"));
    head.append(names, controls);

    const body = element("tbody");
    for (let row = 0; row <= table.rows.length; row += 1) {
      const tr = element("tr");
      const label = element("th", row === 0 ? message("headerRow") : String(row));
      label.scope = "row";
      tr.append(label);
      if (row === 0) tr.dataset["headerRow"] = "";
      for (let column = 0; column < columns(); column += 1) {
        const td = element("td");
        td.append(cellInput(row, column));
        tr.append(td);
      }
      const actions = element("td", undefined, "mdt__actions");
      if (row > 0) actions.append(removeButton(fill(message("removeRowLabel"), { row }), "removeRow", row - 1, false));
      tr.append(actions);
      body.append(tr);
    }
    grid.replaceChildren(head, body);
    writeOutput();
  };

  const focusCell = (row: number, column: number) =>
    grid.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-column="${column}"]`);

  grid.addEventListener("input", (event) => {
    const input = event.target as HTMLElement;
    // Selects fire input events too; alignment is handled on change.
    if (!(input instanceof HTMLInputElement)) return;
    const row = Number(input.dataset["row"]);
    const column = Number(input.dataset["column"]);
    if (row === 0) table.headers[column] = input.value;
    else table.rows[row - 1]![column] = input.value;
    writeOutput();
  });

  grid.addEventListener("change", (event) => {
    const select = event.target as HTMLElement;
    if (!(select instanceof HTMLSelectElement)) return;
    table.align[Number(select.dataset["align"])] = select.value as Align;
    writeOutput();
  });

  grid.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(".mdt__remove");
    if (!button) return;
    if (button.dataset["removeRow"] !== undefined) {
      const index = Number(button.dataset["removeRow"]);
      table.rows.splice(index, 1);
      render();
      announce.textContent = fill(message("removedRow"), { row: index + 1 });
      const next = grid.querySelector<HTMLButtonElement>(
        `[data-remove-row="${Math.min(index, table.rows.length - 1)}"]`,
      );
      (next ?? addRow).focus();
    } else {
      const index = Number(button.dataset["removeColumn"]);
      table.headers.splice(index, 1);
      table.align.splice(index, 1);
      for (const row of table.rows) row.splice(index, 1);
      render();
      announce.textContent = fill(message("removedColumn"), { column: index + 1 });
      grid.querySelector<HTMLSelectElement>(`[data-align="${Math.min(index, columns() - 1)}"]`)!.focus();
    }
  });

  /** Arrow keys move between cells; left and right only once the caret reaches the edge of the text. */
  grid.addEventListener("keydown", (event) => {
    const input = event.target as HTMLElement;
    if (!(input instanceof HTMLInputElement) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    const row = Number(input.dataset["row"]);
    const column = Number(input.dataset["column"]);
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
    const moves: Record<string, [number, number, boolean]> = {
      ArrowUp: [row - 1, column, true],
      ArrowDown: [row + 1, column, true],
      ArrowLeft: [row, column - 1, atStart],
      ArrowRight: [row, column + 1, atEnd],
    };
    const move = moves[event.key];
    if (!move?.[2]) return;
    const target = focusCell(move[0], move[1]);
    if (!target) return;
    event.preventDefault();
    target.focus();
    const caret = event.key === "ArrowRight" ? 0 : target.value.length;
    target.setSelectionRange(caret, caret);
  });

  addRow.addEventListener("click", () => {
    table.rows.push(Array<string>(columns()).fill(""));
    render();
    announce.textContent = fill(message("addedRow"), { row: table.rows.length });
    focusCell(table.rows.length, 0)!.focus();
  });

  addColumn.addEventListener("click", () => {
    table.headers.push("");
    table.align.push("left");
    for (const row of table.rows) row.push("");
    render();
    announce.textContent = fill(message("addedColumn"), { column: columns() });
    focusCell(0, columns() - 1)!.focus();
  });

  importButton.addEventListener("click", () => {
    const result = parseTable(importInput.value);
    importStatus.toggleAttribute("data-invalid", !result);
    if (!result) {
      importStatus.textContent = message("importEmpty");
      return;
    }
    table = result.table;
    render();
    const format = message(`format${result.format.charAt(0).toUpperCase()}${result.format.slice(1)}`);
    importStatus.textContent = fill(message("imported"), { rows: table.rows.length, columns: columns(), format });
  });

  compact.addEventListener("change", writeOutput);
  copy.addEventListener("click", () => {
    void copyText(copy, output.value, message("copied"));
  });
  render();
};
