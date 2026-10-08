import { runRegex, segments, type RegexMatch } from "../lib/regex-tool";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = "") => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

/** The regex tester on /tools/regex/. Everything the user typed is rendered with textContent, never as HTML. */
export const initRegex = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-regex]");
  if (!tool) return;
  const pattern = tool.querySelector<HTMLInputElement>("[data-pattern]")!;
  const text = tool.querySelector<HTMLTextAreaElement>("[data-text]")!;
  const flags = [...tool.querySelectorAll<HTMLInputElement>("[data-flag]")];
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const highlight = tool.querySelector<HTMLElement>("[data-highlight]")!;
  const list = tool.querySelector<HTMLElement>("[data-matches]")!;
  const message = (name: string) => tool.dataset[name] ?? "";

  const item = (match: RegexMatch, position: number) => {
    const entry = element("li", "regex__match");
    entry.append(
      element("p", "regex__match-head", fill(message("matchAt"), { number: position + 1, index: match.index })),
      element("code", "regex__match-text", match.text === "" ? message("emptyMatch") : match.text),
    );
    if (match.groups.length > 0) {
      const groups = element("dl", "regex__groups");
      for (const group of match.groups) {
        const row = element("div", "regex__group");
        const label = group.name
          ? fill(message("groupNamed"), { number: group.number, name: group.name })
          : fill(message("group"), { number: group.number });
        row.append(
          element("dt", "", label),
          element("dd", group.value === undefined ? "regex__unmatched" : "", group.value ?? message("unmatched")),
        );
        groups.append(row);
      }
      entry.append(groups);
    }
    return entry;
  };

  const update = () => {
    const chosen = flags.filter((flag) => flag.checked).map((flag) => flag.dataset["flag"] ?? "");
    const result = runRegex(pattern.value, chosen.join(""), text.value);
    const failed = "error" in result;
    pattern.setAttribute("aria-invalid", String(failed));
    status.toggleAttribute("data-invalid", failed);
    highlight.replaceChildren();
    list.replaceChildren();
    if (failed) {
      status.textContent = fill(message("errorPattern"), { reason: result.error });
      highlight.textContent = text.value;
      return;
    }
    const { matches, truncated } = result;
    const count = matches.length.toLocaleString("en-GB");
    const summary = message(matches.length === 0 ? "countNone" : matches.length === 1 ? "countOne" : "countOther");
    status.textContent = [fill(summary, { count }), truncated ? fill(message("truncated"), { count }) : ""]
      .filter(Boolean)
      .join(". ");
    for (const segment of segments(text.value, matches)) {
      if (segment.match === undefined) highlight.append(segment.text);
      else {
        const mark = element("mark", "regex__mark", segment.text);
        mark.toggleAttribute("data-alternate", segment.match % 2 === 1);
        highlight.append(mark);
      }
    }
    list.append(...matches.map(item));
  };

  tool.addEventListener("input", update);
  update();
};
