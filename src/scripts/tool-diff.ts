import {
  collapse,
  diffLimits,
  diffLines,
  sideBySide,
  type DiffLine,
  type DiffRow,
  type DiffSkip,
} from "../lib/diff-tool";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) =>
    typeof values[name] === "number" ? values[name].toLocaleString("en-GB") : (values[name] ?? match),
  );

const signs = { add: "+", remove: "−", equal: " " } as const;

/** The text diff on /tools/diff/. */
export const initDiff = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-diff]");
  if (!tool) return;
  const before = tool.querySelector<HTMLTextAreaElement>("[data-before]")!;
  const after = tool.querySelector<HTMLTextAreaElement>("[data-after]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const output = tool.querySelector<HTMLElement>("[data-output]")!;
  const message = (key: string) => tool.dataset[key] ?? "";

  const cell = (tag: "td" | "th", className: string, text = "") => {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  };

  /** The +/− marker, with the change spelled out for screen readers. */
  const sign = (type: DiffLine["type"]) => {
    const element = cell("td", "diff__sign", signs[type]);
    if (type !== "equal") {
      element.textContent = "";
      const symbol = document.createElement("span");
      symbol.setAttribute("aria-hidden", "true");
      symbol.textContent = signs[type];
      const label = document.createElement("span");
      label.className = "visually-hidden";
      label.textContent = message(type === "add" ? "addedLine" : "removedLine");
      element.append(symbol, label);
    }
    return element;
  };

  const skipRow = (item: DiffSkip, columns: number) => {
    const row = document.createElement("tr");
    row.className = "diff__skip";
    const td = cell("td", "", fill(message("skipped"), { count: item.count }));
    td.colSpan = columns;
    row.append(td);
    return row;
  };

  const unified = (items: (DiffLine | DiffSkip)[]) =>
    items.map((item) => {
      if (item.type === "skip") return skipRow(item, 4);
      const row = document.createElement("tr");
      row.dataset["type"] = item.type;
      row.append(
        cell("td", "diff__number", item.before?.toString()),
        cell("td", "diff__number", item.after?.toString()),
        sign(item.type),
        cell("td", "diff__text", item.text),
      );
      return row;
    });

  const half = (line: DiffLine | undefined) => {
    if (!line)
      return [
        cell("td", "diff__number diff__blank"),
        cell("td", "diff__sign diff__blank"),
        cell("td", "diff__text diff__blank"),
      ];
    const number = line.type === "add" ? line.after : line.before;
    const cells = [
      cell("td", "diff__number", number?.toString()),
      sign(line.type),
      cell("td", "diff__text", line.text),
    ];
    for (const item of cells) item.dataset["type"] = line.type;
    return cells;
  };

  const split = (rows: (DiffRow | DiffSkip)[]) =>
    rows.map((row) => {
      if ("type" in row) return skipRow(row, 6);
      const tr = document.createElement("tr");
      tr.append(...half(row.before), ...half(row.after));
      return tr;
    });

  const update = () => {
    const view = tool.querySelector<HTMLInputElement>('[name="view"]:checked')?.value ?? "split";
    const result = diffLines(before.value, after.value);
    output.replaceChildren();
    status.toggleAttribute("data-invalid", "error" in result);
    if ("error" in result) {
      status.textContent = fill(message(result.error === "tooLong" ? "errorLong" : "errorDifferent"), diffLimits);
      return;
    }
    const { summary, lines } = result;
    if (lines.length === 0) {
      status.textContent = message("empty");
      return;
    }
    if (summary.added + summary.removed === 0) {
      status.textContent = message("identical");
      return;
    }
    status.replaceChildren(
      ...(["added", "removed", "unchanged"] as const).flatMap((key, i) => {
        const chip = document.createElement("span");
        chip.className = `diff__count diff__count--${key}`;
        chip.textContent = fill(message(key), { count: summary[key] });
        if (i === 0) return [chip];
        // A comma between counts for screen readers; the chips are spaced visually.
        const comma = document.createElement("span");
        comma.className = "visually-hidden";
        comma.textContent = ", ";
        return [comma, chip];
      }),
    );
    const items = collapse(lines);
    const table = document.createElement("table");
    table.className = `diff__table diff__table--${view}`;
    const head = document.createElement("thead");
    const headings = document.createElement("tr");
    const heading = (text: string, span: number) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.colSpan = span;
      th.textContent = text;
      return th;
    };
    if (view === "unified") {
      head.className = "visually-hidden";
      headings.append(heading(message("before"), 1), heading(message("after"), 1), heading(message("line"), 2));
    } else headings.append(heading(message("before"), 3), heading(message("after"), 3));
    head.append(headings);
    // Fixed table layout takes column widths from here, since the header cells span columns.
    const columns = document.createElement("colgroup");
    const kinds =
      view === "unified" ? ["number", "number", "sign", "text"] : ["number", "sign", "text", "number", "sign", "text"];
    for (const kind of kinds) {
      const col = document.createElement("col");
      col.className = `diff__col-${kind}`;
      columns.append(col);
    }
    const body = document.createElement("tbody");
    body.append(...(view === "unified" ? unified(items) : split(sideBySide(items))));
    table.append(columns, head, body);
    output.append(table);
  };

  // Side by side is cramped on a phone, so start unified there; the table still scrolls if chosen.
  const unifiedView = tool.querySelector<HTMLInputElement>('[name="view"][value="unified"]');
  if (unifiedView && typeof window.matchMedia === "function" && window.matchMedia("(width < 36rem)").matches) {
    unifiedView.checked = true;
  }
  tool.addEventListener("input", update);
  tool.addEventListener("change", update);
  update();
};
