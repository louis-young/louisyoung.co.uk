import { type GlobPart, type GlobSegment, matchPaths } from "../lib/glob-tool";
import { copyText } from "./tool-copy";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

/** The glob tester on /tools/glob/. */
export const initGlob = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-glob]");
  if (!tool) return;
  const pattern = tool.querySelector<HTMLInputElement>("[data-pattern]")!;
  const paths = tool.querySelector<HTMLTextAreaElement>("[data-paths]")!;
  const dot = tool.querySelector<HTMLInputElement>("[data-dot]")!;
  const nocase = tool.querySelector<HTMLInputElement>("[data-nocase]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const list = tool.querySelector<HTMLElement>("[data-list]")!;
  const regex = tool.querySelector<HTMLElement>("[data-regex]")!;
  const negatedNote = tool.querySelector<HTMLElement>("[data-negated]")!;
  const expandedNote = tool.querySelector<HTMLElement>("[data-expanded-note]")!;
  const segments = tool.querySelector<HTMLElement>("[data-segments]")!;
  const copy = tool.querySelector<HTMLButtonElement>("[data-copy-regex]")!;
  const message = (key: string) => tool.dataset[key] ?? "";

  const describePart = (part: GlobPart, onlyStars: boolean) => {
    switch (part.kind) {
      case "literal":
        return fill(message("partLiteral"), { text: part.text });
      case "star":
        return message(onlyStars ? "partStarOnly" : "partStar");
      case "qmark":
        return message("partQmark");
      case "globstar":
        return message("partGlobstar");
      case "class":
        return fill(message(part.negated ? "partClassNegated" : "partClass"), { chars: part.text });
      default:
        return fill(message("partBraces"), {
          alternatives: part.alternatives
            .map((item) => fill(message("partLiteral"), { text: item }))
            .join(message("or")),
        });
    }
  };

  const describe = (segment: GlobSegment) => {
    const onlyStars = segment.parts.every((part) => part.kind === "star");
    const text =
      segment.parts.length === 0
        ? message("root")
        : segment.parts.map((part) => describePart(part, onlyStars)).join(message("then"));
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const update = () => {
    const { result, matches } = matchPaths(pattern.value, paths.value, { dot: dot.checked, nocase: nocase.checked });
    pattern.setAttribute("aria-invalid", String(!result.ok));
    status.toggleAttribute("data-invalid", !result.ok);
    copy.disabled = !result.ok;
    if (!result.ok) {
      status.textContent = message(result.error === "empty" ? "empty" : "tooMany");
      list.replaceChildren();
      regex.textContent = "";
      negatedNote.hidden = true;
      expandedNote.hidden = true;
      segments.replaceChildren();
      return;
    }
    const matched = matches.filter((match) => match.matched).length;
    status.textContent =
      matches.length === 0 ? message("noPaths") : fill(message("matchCount"), { matched, total: matches.length });
    list.replaceChildren(
      ...matches.map((match) => {
        const item = document.createElement("li");
        item.toggleAttribute("data-matched", match.matched);
        const code = document.createElement("code");
        code.textContent = match.path;
        const badge = document.createElement("span");
        badge.className = "glob__badge";
        badge.textContent = message(match.matched ? "match" : "noMatch");
        item.append(code, badge);
        return item;
      }),
    );
    regex.textContent = String(result.regex);
    negatedNote.hidden = !result.negated;
    const distinct = new Set(result.expanded).size;
    expandedNote.hidden = distinct < 2;
    expandedNote.textContent = fill(message("expanded"), { count: distinct });
    segments.replaceChildren(
      // An empty first segment is the root of an absolute path; an empty last one is a trailing slash.
      ...result.segments
        .filter((segment, index) => segment.text !== "" || index === 0)
        .map((segment) => {
          const item = document.createElement("li");
          const code = document.createElement("code");
          code.textContent = segment.text === "" ? "/" : segment.text;
          const text = document.createElement("span");
          text.textContent = describe(segment);
          item.append(code, text);
          if (segment.skipsHidden) {
            const hidden = document.createElement("span");
            hidden.className = "glob__hidden";
            hidden.textContent = message("hidden");
            item.append(hidden);
          }
          return item;
        }),
    );
  };

  for (const input of [pattern, paths]) input.addEventListener("input", update);
  for (const input of [dot, nocase]) input.addEventListener("change", update);
  copy.addEventListener("click", () => {
    void copyText(copy, regex.textContent, message("copied"));
  });
  update();
};
