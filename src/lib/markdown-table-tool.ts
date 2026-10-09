/** Building GitHub Markdown (GFM) tables, and importing CSV, TSV or Markdown tables. */

export const alignments = ["left", "center", "right"] as const;
export type Align = (typeof alignments)[number];

export interface Table {
  headers: string[];
  rows: string[][];
  align: Align[];
}

export type TableFormat = "markdown" | "csv" | "tsv";

/** Escapes a pipe (which would end the cell) and turns line breaks into `<br>`. */
export const escapeCell = (text: string) =>
  text
    .trim()
    .replaceAll("|", String.raw`\|`)
    .replaceAll(/\r?\n/gu, "<br>");

const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Width in characters as people see them, so an emoji or an accented letter counts once. */
const width = (text: string) => [...graphemes.segment(text)].length;

const pad = (text: string, size: number, align: Align) => {
  const gap = size - width(text);
  if (align === "right") return " ".repeat(gap) + text;
  if (align === "center") return " ".repeat(Math.floor(gap / 2)) + text + " ".repeat(Math.ceil(gap / 2));
  return text + " ".repeat(gap);
};

const delimiter = (align: Align, size: number) => {
  if (align === "center") return `:${"-".repeat(size - 2)}:`;
  if (align === "right") return `${"-".repeat(size - 1)}:`;
  return `:${"-".repeat(size - 1)}`;
};

/** Gives every row as many cells as there are columns. */
export const normalise = (table: Table): Table => {
  const columns = Math.max(1, table.headers.length, ...table.rows.map((row) => row.length));
  const fill = (cells: string[]) => Array.from({ length: columns }, (_, i) => cells[i] ?? "");
  return {
    headers: fill(table.headers),
    rows: table.rows.map(fill),
    align: Array.from({ length: columns }, (_, i) => table.align[i] ?? "left"),
  };
};

/** Writes a GFM table, padded so the columns line up, or as compact as GFM allows. */
export const toMarkdown = (input: Table, compact = false) => {
  const table = normalise(input);
  const header = table.headers.map(escapeCell);
  const body = table.rows.map((row) => row.map(escapeCell));
  if (compact) {
    // A cell ending in a backslash gets a space, or `\|` would escape its closing pipe.
    const line = (cells: string[]) => `|${cells.map((cell) => (cell.endsWith("\\") ? `${cell} ` : cell)).join("|")}|`;
    const rule = table.align.map((align) => delimiter(align, align === "center" ? 3 : 2));
    return [line(header), line(rule), ...body.map(line)].join("\n");
  }
  const sizes = table.align.map((_, i) => Math.max(3, width(header[i]!), ...body.map((row) => width(row[i]!))));
  const line = (cells: string[]) => `| ${cells.map((cell, i) => pad(cell, sizes[i]!, table.align[i]!)).join(" | ")} |`;
  const rule = `| ${table.align.map((align, i) => delimiter(align, sizes[i]!)).join(" | ")} |`;
  return [line(header), rule, ...body.map(line)].join("\n");
};

/** Splits a Markdown table row on pipes that aren't escaped, dropping the outer ones. */
const markdownCells = (line: string) => {
  let text = line.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|") && !text.endsWith(String.raw`\|`)) text = text.slice(0, -1);
  return text.split(/(?<!\\)\|/u).map((cell) => cell.trim().replaceAll(String.raw`\|`, "|"));
};

const delimiterRow = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/u;

const parseMarkdown = (lines: string[]): Table => {
  const align = markdownCells(lines[1]!).map((cell): Align => {
    if (cell.startsWith(":") && cell.endsWith(":")) return "center";
    return cell.endsWith(":") ? "right" : "left";
  });
  return normalise({ headers: markdownCells(lines[0]!), rows: lines.slice(2).map(markdownCells), align });
};

/** RFC 4180 CSV (or TSV with `separator` a tab): quoted fields may hold separators, quotes and line breaks. */
export const parseDelimited = (text: string, separator: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
    index += 1;
  }
  if (field !== "" || row.length > 0) rows.push([...row, field]);
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
};

/** Counts `char` outside double quotes. */
const countOutsideQuotes = (line: string, char: string) => {
  let count = 0;
  let quoted = false;
  for (const symbol of line) {
    if (symbol === '"') quoted = !quoted;
    else if (symbol === char && !quoted) count += 1;
  }
  return count;
};

/** Reads a pasted Markdown table, TSV (from a spreadsheet) or CSV. The first row becomes the header. */
export const parseTable = (text: string): { table: Table; format: TableFormat } | undefined => {
  const lines = text.split(/\r?\n/u).filter((line) => line.trim() !== "");
  if (lines.length === 0) return undefined;
  if (lines.length >= 2 && lines[0]!.includes("|") && delimiterRow.test(lines[1]!.trim())) {
    return { table: parseMarkdown(lines), format: "markdown" };
  }
  const first = lines[0]!;
  const tabs = countOutsideQuotes(first, "\t");
  const semicolons = countOutsideQuotes(first, ";");
  const commas = countOutsideQuotes(first, ",");
  const format: TableFormat = tabs > 0 ? "tsv" : "csv";
  const separator = tabs > 0 ? "\t" : semicolons > commas ? ";" : ",";
  // A grid cell is one line, so line breaks inside quoted fields become <br>, as GFM writes them.
  const [headers = [], ...rows] = parseDelimited(text, separator).map((cells) =>
    cells.map((cell) => cell.trim().replaceAll(/\r?\n/gu, "<br>")),
  );
  return { table: normalise({ headers, rows, align: [] }), format };
};
