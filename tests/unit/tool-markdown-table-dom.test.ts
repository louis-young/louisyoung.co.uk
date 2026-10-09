// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initMarkdownTable } from "../../src/scripts/tool-markdown-table";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const messages = {
  copied: "Copied",
  column: "Column {column}",
  "header-row": "Header",
  "header-cell": "Header, column {column}",
  cell: "Row {row}, column {column}",
  "align-label": "Alignment of column {column}",
  left: "Left",
  center: "Centre",
  right: "Right",
  "remove-row-label": "Remove row {row}",
  "remove-column-label": "Remove column {column}",
  size: "{columns} columns, {rows} rows",
  "added-row": "Row {row} added.",
  "added-column": "Column {column} added.",
  "removed-row": "Row {row} removed.",
  "removed-column": "Column {column} removed.",
  imported: "Imported {rows} rows and {columns} columns from {format}.",
  "import-empty": "Nothing to import.",
  "format-markdown": "Markdown",
  "format-csv": "CSV",
  "format-tsv": "TSV",
};

const setup = (table = { headers: ["A", "B"], rows: [["1", "2"]], align: ["left", "right"] }) => {
  const attributes = Object.entries(messages)
    .map(([key, text]) => `data-${key}="${text}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-markdown-table data-table='${JSON.stringify(table)}' ${attributes}>
      <button data-add-row>Add row</button><button data-add-column>Add column</button>
      <table data-grid></table>
      <p data-announce></p>
      <textarea data-import-input></textarea><button data-import>Import</button><p data-import-status></p>
      <input type="checkbox" data-compact />
      <p data-status></p>
      <textarea data-output></textarea>
      <button data-copy><span data-copy-label>Copy</span></button>
    </div>`;
  initMarkdownTable();
  const get = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;
  const cell = (row: number, column: number) => get(`input[data-row="${row}"][data-column="${column}"]`);
  const output = () => get("[data-output]").value;
  const text = (selector: string) => get(selector).textContent;
  const type = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const key = (input: HTMLElement, name: string, options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...options });
    input.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { get, cell, output, text, type, key };
};

describe("Markdown table generator", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initMarkdownTable();
    }).not.toThrow();
  });

  it("builds a labelled grid and writes the table", () => {
    const { get, cell, output, text } = setup();
    expect(cell(0, 0).value).toBe("A");
    expect(cell(0, 1).getAttribute("aria-label")).toBe("Header, column 2");
    expect(cell(1, 0).getAttribute("aria-label")).toBe("Row 1, column 1");
    expect([...document.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Column 1", "Column 2"]);
    expect([...document.querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual(["Header", "1"]);
    expect(get('[data-align="1"]').value).toBe("right");
    expect(get('[data-align="1"]').getAttribute("aria-label")).toBe("Alignment of column 2");
    expect(text('[data-remove-row="0"] .visually-hidden')).toBe("Remove row 1");
    expect(output()).toBe("| A   |   B |\n| :-- | --: |\n| 1   |   2 |");
    expect(text("[data-status]")).toBe("2 columns, 1 rows");
  });

  it("follows edits, alignment and the compact option", () => {
    const { get, cell, output, type } = setup();
    type(cell(0, 0), "Name");
    type(cell(1, 1), "a|b");
    const select = get('[data-align="0"]');
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.value = "center";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(output()).toBe("| Name |    B |\n| :--: | ---: |\n|  1   | a\\|b |");
    const compact = get("[data-compact]");
    compact.checked = true;
    compact.dispatchEvent(new Event("change", { bubbles: true }));
    expect(output()).toBe("|Name|B|\n|:-:|-:|\n|1|a\\|b|");
    cell(0, 0).dispatchEvent(new Event("change", { bubbles: true }));
    expect(output()).toBe("|Name|B|\n|:-:|-:|\n|1|a\\|b|");
  });

  it("adds and removes rows and columns, moving focus sensibly", () => {
    const { get, cell, output, text } = setup();
    get("[data-add-row]").click();
    expect(document.activeElement).toBe(cell(2, 0));
    expect(text("[data-announce]")).toBe("Row 2 added.");
    get("[data-add-column]").click();
    expect(document.activeElement).toBe(cell(0, 2));
    expect(text("[data-announce]")).toBe("Column 3 added.");
    expect(output().split("\n")[1]).toBe("| :-- | --: | :-- |");
    get('[data-remove-column="1"]').click();
    expect(text("[data-announce]")).toBe("Column 2 removed.");
    expect(document.activeElement).toBe(get('[data-align="1"]'));
    expect(output().split("\n")[0]).toBe("| A   |     |");
    get('[data-remove-row="1"]').click();
    expect(text("[data-announce]")).toBe("Row 2 removed.");
    expect(document.activeElement).toBe(get('[data-remove-row="0"]'));
    get('[data-remove-row="0"]').click();
    expect(document.activeElement).toBe(get("[data-add-row]"));
    get('[data-remove-column="1"]').click();
    expect(get('[data-remove-column="0"]').disabled).toBe(true);
    expect(output()).toBe("| A   |\n| :-- |");
    get("[data-grid]").click();
  });

  it("moves between cells with the arrow keys", () => {
    const { cell, key } = setup({ headers: ["ab", "cd"], rows: [["ef", "gh"]], align: [] });
    const first = cell(0, 0);
    first.focus();
    first.setSelectionRange(2, 2);
    expect(key(first, "ArrowRight")).toBe(true);
    expect(document.activeElement).toBe(cell(0, 1));
    expect(cell(0, 1).selectionStart).toBe(0);
    expect(key(cell(0, 1), "ArrowRight")).toBe(false);
    expect(key(cell(0, 1), "ArrowDown")).toBe(true);
    expect(document.activeElement).toBe(cell(1, 1));
    expect(cell(1, 1).selectionStart).toBe(2);
    cell(1, 1).setSelectionRange(1, 1);
    expect(key(cell(1, 1), "ArrowLeft")).toBe(false);
    cell(1, 1).setSelectionRange(0, 0);
    expect(key(cell(1, 1), "ArrowLeft")).toBe(true);
    expect(document.activeElement).toBe(cell(1, 0));
    expect(key(cell(1, 0), "ArrowDown")).toBe(false);
    expect(key(cell(1, 0), "ArrowUp")).toBe(true);
    expect(key(cell(0, 0), "ArrowUp")).toBe(false);
    expect(key(cell(0, 0), "ArrowDown", { shiftKey: true })).toBe(false);
    expect(key(cell(0, 0), "Enter")).toBe(false);
    expect(key(document.querySelector<HTMLElement>("select")!, "ArrowDown")).toBe(false);
  });

  it("imports CSV, TSV and Markdown, and reports an empty paste", () => {
    const { get, cell, output, text, type } = setup();
    const area = get("[data-import-input]");
    const importButton = get("[data-import]");
    importButton.click();
    expect(text("[data-import-status]")).toBe("Nothing to import.");
    expect(get("[data-import-status]").hasAttribute("data-invalid")).toBe(true);
    type(area, "x,y,z\n1,2,3\n4,5,6");
    importButton.click();
    expect(text("[data-import-status]")).toBe("Imported 2 rows and 3 columns from CSV.");
    expect(get("[data-import-status]").hasAttribute("data-invalid")).toBe(false);
    expect(cell(2, 2).value).toBe("6");
    type(area, "| a | b |\n| :-: | --: |\n| 1 | 2 |");
    importButton.click();
    expect(text("[data-import-status]")).toBe("Imported 1 rows and 2 columns from Markdown.");
    expect(output()).toBe("|  a  |   b |\n| :-: | --: |\n|  1  |   2 |");
    type(area, "p\tq\n");
    importButton.click();
    expect(text("[data-import-status]")).toBe("Imported 0 rows and 2 columns from TSV.");
  });

  it("copies the output", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get, output } = setup();
    get("[data-copy]").click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(output());
  });

  it("starts from an empty table without data", () => {
    document.body.innerHTML = `<div data-markdown-table><table data-grid></table><textarea data-output></textarea>
      <button data-add-row></button><button data-add-column></button><p data-announce></p><textarea data-import-input></textarea>
      <button data-import></button><p data-import-status></p><input type="checkbox" data-compact /><p data-status></p>
      <button data-copy></button></div>`;
    initMarkdownTable();
    expect(document.querySelector<HTMLTextAreaElement>("[data-output]")!.value).toBe("|     |\n| :-- |");
  });
});
