import {
  type Counts,
  counts,
  type Flag,
  type FlagKind,
  flagSummary,
  type Grapheme,
  graphemes,
  mixedScriptWords,
  normalise,
} from "../lib/unicode-tool";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

/** Rows past this many graphemes would make the table slow to build and no easier to read. */
export const MAX_ROWS = 300;

const flagKinds: FlagKind[] = ["invisible", "bidi", "space", "confusable", "control"];

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The Unicode inspector on /tools/unicode/. */
export const initUnicode = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-unicode]");
  if (!tool) return;
  const input = tool.querySelector<HTMLTextAreaElement>("[data-input]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const checks = tool.querySelector<HTMLElement>("[data-checks]")!;
  const note = tool.querySelector<HTMLElement>("[data-note]")!;
  const table = tool.querySelector<HTMLTableElement>("[data-table]")!;
  const scroll = tool.querySelector<HTMLElement>("[data-scroll]");
  const message = (key: string) => tool.dataset[key] ?? "";
  const categories = JSON.parse(tool.dataset["categories"] ?? "{}") as Record<string, string>;

  const cell = (tag: "td" | "th", ...children: (Node | string)[]) => {
    const element = document.createElement(tag);
    element.append(...children);
    return element;
  };

  const describeFlag = (flag: Flag) => {
    const chip = document.createElement("span");
    chip.className = "uni__flag";
    chip.textContent = fill(message(`flag${capitalised(flag.kind)}`), { label: flag.label });
    return chip;
  };

  /** The grapheme itself, or a labelled stand-in when every code point in it is invisible. */
  const glyph = (cluster: Grapheme) => {
    const span = document.createElement("span");
    const hidden = cluster.codePoints.every((point) => point.placeholder !== undefined);
    if (hidden) {
      span.className = "uni__placeholder";
      span.textContent = cluster.codePoints.map((point) => point.placeholder).join(" ");
    } else {
      span.className = "uni__glyph";
      span.textContent = cluster.text;
    }
    return span;
  };

  const rows = (cluster: Grapheme) => {
    const body = document.createElement("tbody");
    body.toggleAttribute(
      "data-flagged",
      cluster.codePoints.some((point) => point.flags.length > 0),
    );
    cluster.codePoints.forEach((point, index) => {
      const row = document.createElement("tr");
      if (index === 0) {
        const header = cell("th", glyph(cluster));
        header.scope = "rowgroup";
        header.rowSpan = cluster.codePoints.length;
        row.append(header);
      }
      const category = document.createElement("span");
      category.className = "uni__gc";
      category.textContent = ` ${categories[point.category] ?? ""}`;
      row.append(
        cell("td", point.label),
        cell("td", point.category, category),
        cell("td", point.utf8.join(" ")),
        cell("td", point.utf16.join(" ")),
        cell("td", ...point.flags.map(describeFlag)),
      );
      body.append(row);
    });
    return body;
  };

  const update = () => {
    const text = input.value;
    const clusters = graphemes(text);
    const total = counts(text, clusters);
    for (const key of Object.keys(total) as (keyof Counts)[]) {
      tool.querySelector(`[data-count="${key}"]`)!.textContent = total[key].toLocaleString("en-GB");
    }

    const summary = flagSummary(clusters);
    const mixed = mixedScriptWords(text);
    const issues = flagKinds.filter((kind) => summary[kind] > 0);
    const items = issues.map((kind) => fill(message(kind), { count: summary[kind] }));
    if (mixed.length > 0) items.push(fill(message("mixed"), { words: [...new Set(mixed)].join(", ") }));
    checks.replaceChildren(
      ...(items.length > 0 ? items : [message("clean")]).map((text) => {
        const item = document.createElement("li");
        item.textContent = text;
        item.toggleAttribute("data-clean", items.length === 0);
        return item;
      }),
    );
    const flagged = issues.reduce((sum, kind) => sum + summary[kind], 0);
    status.textContent = fill(message("statusText"), {
      graphemes: total.graphemes.toLocaleString("en-GB"),
      codePoints: total.codePoints.toLocaleString("en-GB"),
      issues: flagged > 0 ? fill(message("statusIssues"), { count: flagged }) : message("statusClean"),
    });
    status.toggleAttribute("data-invalid", flagged > 0);

    for (const form of normalise(text)) {
      const row = tool.querySelector(`[data-form="${form.form}"]`)!;
      const verdict = row.querySelector<HTMLElement>("[data-verdict]")!;
      verdict.textContent = message(form.changed ? "differs" : "same");
      verdict.toggleAttribute("data-changed", form.changed);
      row.querySelector("[data-text]")!.textContent = form.text;
      row.querySelector("[data-length]")!.textContent = form.codePoints.toLocaleString("en-GB");
    }

    for (const body of table.querySelectorAll("tbody")) body.remove();
    if (clusters.length === 0) {
      const body = document.createElement("tbody");
      const row = document.createElement("tr");
      const empty = cell("td", message("emptyTable"));
      empty.colSpan = 6;
      row.append(empty);
      body.append(row);
      table.append(body);
    } else table.append(...clusters.slice(0, MAX_ROWS).map(rows));
    note.hidden = clusters.length <= MAX_ROWS;
    note.textContent = fill(message("truncated"), {
      shown: MAX_ROWS,
      total: clusters.length.toLocaleString("en-GB"),
    });
  };

  /** The table scrolls sideways on narrow screens; only then does its region need to take focus to scroll by keyboard. */
  const updateFocus = () => {
    if (!scroll) return;
    if (scroll.scrollWidth > scroll.clientWidth) scroll.tabIndex = 0;
    else scroll.removeAttribute("tabindex");
  };

  input.addEventListener("input", () => {
    update();
    updateFocus();
  });
  window.addEventListener("resize", updateFocus);
  update();
  updateFocus();
};
