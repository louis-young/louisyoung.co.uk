import {
  checkVersions,
  describeRange,
  formatRange,
  highestMatch,
  parseRange,
  type RangeMessages,
} from "../lib/semver-tool";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

const and = new Intl.ListFormat("en-GB", { type: "conjunction" });

/** The semver range checker on /tools/semver/. */
export const initSemver = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-semver]");
  if (!tool) return;
  const range = tool.querySelector<HTMLInputElement>("[data-range]")!;
  const versions = tool.querySelector<HTMLTextAreaElement>("[data-versions]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const facts = tool.querySelector<HTMLElement>("[data-facts]")!;
  const expanded = tool.querySelector<HTMLElement>("[data-expanded]")!;
  const highest = tool.querySelector<HTMLElement>("[data-highest]")!;
  const resultsSection = tool.querySelector<HTMLElement>("[data-results-section]")!;
  const count = tool.querySelector<HTMLElement>("[data-count-status]")!;
  const results = tool.querySelector<HTMLElement>("[data-results]")!;
  const message = (key: string) => tool.dataset[key] ?? "";
  const messages: RangeMessages = {
    ">=": message("atLeast"),
    ">": message("above"),
    "<=": message("atMost"),
    "<": message("below"),
    "=": message("exactly"),
    any: message("any"),
    none: message("none"),
  };
  // Sets are joined with a comma before “or”, so “and” binds tighter: “at least 1 and below 2, or exactly 3”.
  const lists = { and: (items: string[]) => and.format(items), or: (items: string[]) => items.join(message("or")) };
  const labels = {
    match: message("match"),
    miss: message("miss"),
    prerelease: message("prerelease"),
    invalid: message("invalid"),
  };

  const update = () => {
    const parsed = parseRange(range.value);
    const valid = "sets" in parsed;
    range.setAttribute("aria-invalid", String(!valid));
    status.toggleAttribute("data-invalid", !valid);
    facts.hidden = !valid;
    resultsSection.hidden = !valid;
    if (!valid) {
      status.textContent =
        parsed.error === "empty" ? message("errorEmpty") : fill(message("errorSyntax"), { token: parsed.token });
      return;
    }
    status.textContent = fill(message("describe"), { description: describeRange(parsed.sets, messages, lists) });
    expanded.textContent = formatRange(parsed.sets);
    const checks = checkVersions(versions.value, parsed.sets);
    highest.textContent = highestMatch(checks)?.text ?? message("noMatch");
    const matches = checks.filter((check) => check.result === "match").length;
    count.textContent =
      checks.length === 0 ? message("noVersions") : fill(message("count"), { count: matches, total: checks.length });
    results.replaceChildren(
      ...checks.map((check) => {
        const item = document.createElement("li");
        item.dataset["result"] = check.result;
        const code = document.createElement("code");
        code.textContent = check.text;
        const badge = document.createElement("span");
        badge.className = "semver__badge";
        badge.textContent = labels[check.result];
        item.append(code, badge);
        return item;
      }),
    );
  };

  for (const example of tool.querySelectorAll<HTMLButtonElement>("[data-example]")) {
    example.addEventListener("click", () => {
      range.value = example.dataset["example"] ?? "";
      update();
    });
  }
  tool.addEventListener("input", update);
  update();
};
