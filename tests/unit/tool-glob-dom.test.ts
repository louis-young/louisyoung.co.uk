// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initGlob } from "../../src/scripts/tool-glob";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const field = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;

const messages = {
  copied: "Copied",
  "match-count": "{matched} of {total} match.",
  "no-paths": "Add paths.",
  empty: "Type a pattern.",
  "too-many": "Too many.",
  match: "Match",
  "no-match": "No match",
  expanded: "{count} patterns.",
  "part-globstar": "any folders",
  "part-star": "any characters",
  "part-star-only": "any name",
  "part-qmark": "one character",
  "part-class": "one of [{chars}]",
  "part-class-negated": "not [{chars}]",
  "part-braces": "one of {alternatives}",
  "part-literal": "“{text}”",
  or: " or ",
  then: ", then ",
  root: "the root",
  hidden: "Skips dotfiles.",
};

const setup = (pattern: string, paths: string) => {
  const attributes = Object.entries(messages)
    .map(([key, value]) => `data-${key}="${value}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-glob ${attributes}>
      <input data-pattern />
      <textarea data-paths></textarea>
      <input type="checkbox" data-dot /><input type="checkbox" data-nocase />
      <p data-status></p>
      <ul data-list></ul>
      <button data-copy-regex><span data-copy-label>Copy</span></button>
      <code data-regex></code>
      <p data-negated hidden></p><p data-expanded-note hidden></p>
      <ol data-segments></ol>
    </div>`;
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  field("[data-pattern]").value = pattern;
  field("[data-paths]").value = paths;
  initGlob();
  const type = (selector: string, value: string) => {
    const element = field(selector);
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const check = (selector: string, checked: boolean) => {
    const element = field(selector);
    element.checked = checked;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const results = () =>
    [...document.querySelectorAll("[data-list] li")].map(
      (item) => `${item.querySelector("code")!.textContent}: ${item.querySelector(".glob__badge")!.textContent}`,
    );
  const segments = () => [...document.querySelectorAll("[data-segments] li")].map((item) => item.textContent);
  return { get, type, check, results, segments };
};

describe("glob tester", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initGlob();
    }).not.toThrow();
  });

  it("marks matching paths, shows the RegExp and explains each segment", () => {
    const { get, results, segments } = setup("src/**/*.{ts,tsx}", "src/a.ts\nsrc/x/b.tsx\nsrc/.c/d.ts\nREADME.md");
    expect(get("[data-status]").textContent).toBe("2 of 4 match.");
    expect(results()).toEqual([
      "src/a.ts: Match",
      "src/x/b.tsx: Match",
      "src/.c/d.ts: No match",
      "README.md: No match",
    ]);
    expect(get("[data-list] li").hasAttribute("data-matched")).toBe(true);
    expect(get("[data-regex]").textContent).toMatch(/^\/\^\(\?:src\\\/.+\$\/u$/u);
    expect(get("[data-expanded-note]").hidden).toBe(false);
    expect(get("[data-expanded-note]").textContent).toBe("2 patterns.");
    expect(get("[data-negated]").hidden).toBe(true);
    expect(segments()).toEqual([
      "src“src”",
      "**Any foldersSkips dotfiles.",
      "*.{ts,tsx}Any characters, then “.”, then one of “ts” or “tsx”Skips dotfiles.",
    ]);
  });

  it("describes ?, classes, lone stars and the root", () => {
    const { segments, type } = setup("/[a-c]/[!x]?/*", "");
    expect(segments()).toEqual([
      "/The root",
      "[a-c]One of [a-c]",
      "[!x]?Not [x], then one characterSkips dotfiles.",
      "*Any nameSkips dotfiles.",
    ]);
    type("[data-pattern]", "a/");
    expect(segments()).toEqual(["a“a”"]);
  });

  it("updates for options, negation, empty patterns and runaway braces", () => {
    const { get, type, check, results } = setup("*.MD", "README.md\n.env");
    expect(results()).toEqual(["README.md: No match", ".env: No match"]);
    check("[data-nocase]", true);
    expect(results()).toEqual(["README.md: Match", ".env: No match"]);
    type("[data-pattern]", "*");
    check("[data-dot]", true);
    expect(results()).toEqual(["README.md: Match", ".env: Match"]);
    type("[data-pattern]", "!*.md");
    expect(get("[data-negated]").hidden).toBe(false);
    expect(results()).toEqual(["README.md: No match", ".env: Match"]);
    type("[data-pattern]", "");
    expect(get("[data-status]").textContent).toBe("Type a pattern.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    expect(get("[data-pattern]").getAttribute("aria-invalid")).toBe("true");
    expect(field("[data-copy-regex]").disabled).toBe(true);
    expect(results()).toEqual([]);
    type("[data-pattern]", "{1..5000}");
    expect(get("[data-status]").textContent).toBe("Too many.");
    type("[data-pattern]", "*");
    type("[data-paths]", "  \n");
    expect(get("[data-status]").textContent).toBe("Add paths.");
    expect(get("[data-pattern]").getAttribute("aria-invalid")).toBe("false");
  });

  it("copies the RegExp", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get } = setup("*.js", "a.js");
    get("[data-copy-regex]").click();
    expect(writeText).toHaveBeenCalledWith(String.raw`/^(?!\.)[^/]*\.js\/?$/u`);
  });
});
