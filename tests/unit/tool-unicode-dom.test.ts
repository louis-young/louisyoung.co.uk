// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { initUnicode, MAX_ROWS } from "../../src/scripts/tool-unicode";

afterEach(() => {
  document.body.innerHTML = "";
});

const field = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;

const messages = {
  clean: "All clear.",
  invisible: "Invisible: {count}",
  bidi: "Bidi: {count}",
  space: "Spaces: {count}",
  confusable: "Look-alikes: {count}",
  control: "Controls: {count}",
  mixed: "Mixed: {words}",
  "status-text": "{graphemes} graphemes, {codePoints} code points. {issues}",
  "status-clean": "Nothing hidden.",
  "status-issues": "{count} flagged.",
  same: "Same",
  differs: "Differs",
  truncated: "First {shown} of {total}.",
  "empty-table": "Nothing yet.",
  "flag-invisible": "Invisible ({label})",
  "flag-bidi": "Bidi ({label})",
  "flag-space": "Space ({label})",
  "flag-confusable": "Like “{label}”",
  "flag-control": "Control ({label})",
};

const forms = ["NFC", "NFD", "NFKC", "NFKD"];

const setup = (text: string) => {
  const attributes = Object.entries(messages)
    .map(([key, value]) => `data-${key}="${value}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-unicode ${attributes} data-categories='{"Ll":"Lowercase letter","Cf":"Format","So":"Other symbol"}'>
      <textarea data-input></textarea>
      <p data-status></p>
      <dl>${["utf16", "codePoints", "graphemes", "utf8"].map((key) => `<dd data-count="${key}"></dd>`).join("")}</dl>
      <ul data-checks></ul>
      <table><tbody>${forms.map((form) => `<tr data-form="${form}"><td><span data-verdict></span><code data-text></code></td><td data-length></td></tr>`).join("")}</tbody></table>
      <p data-note hidden></p>
      <div data-scroll><table data-table><thead><tr><th>Character</th></tr></thead></table></div>
    </div>`;
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  field("[data-input]").value = text;
  initUnicode();
  const type = (value: string) => {
    const input = field("[data-input]");
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const count = (key: string) => get(`[data-count="${key}"]`).textContent;
  const checks = () => [...document.querySelectorAll("[data-checks] li")].map((item) => item.textContent);
  const groups = () => [...document.querySelectorAll<HTMLTableSectionElement>("[data-table] tbody")];
  return { get, type, count, checks, groups };
};

describe("Unicode inspector", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initUnicode();
    }).not.toThrow();
  });

  it("counts the text four ways", () => {
    const { count, get } = setup("e\u0301👍");
    expect(count("utf16")).toBe("4");
    expect(count("codePoints")).toBe("3");
    expect(count("graphemes")).toBe("2");
    expect(count("utf8")).toBe("7");
    expect(get("[data-status]").textContent).toBe("2 graphemes, 3 code points. Nothing hidden.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(false);
  });

  it("lists each grapheme with its code points in a row group", () => {
    const { groups } = setup("e\u0301a");
    const [first, second] = groups();
    expect(groups()).toHaveLength(2);
    const header = first!.querySelector("th")!;
    expect(header.scope).toBe("rowgroup");
    expect(header.rowSpan).toBe(2);
    expect(header.textContent).toBe("e\u0301");
    expect(header.querySelector(".uni__glyph")).not.toBeNull();
    const rows = [...first!.querySelectorAll("tr")].map((row) =>
      [...row.querySelectorAll("td")].map((cell) => cell.textContent),
    );
    expect(rows).toEqual([
      ["U+0065", "Ll Lowercase letter", "65", "0065", ""],
      ["U+0301", "Mn ", "CC 81", "0301", ""],
    ]);
    expect(second!.querySelector("th")!.rowSpan).toBe(1);
  });

  it("flags invisible, bidi, space, look-alike and control characters, and mixed scripts", () => {
    const { checks, groups, get } = setup("p\u0430ypal\u200b\u202e\u00a0\u0007");
    expect(checks()).toEqual([
      "Invisible: 1",
      "Bidi: 1",
      "Spaces: 1",
      "Look-alikes: 1",
      "Controls: 1",
      "Mixed: p\u0430ypal",
    ]);
    expect(get("[data-status]").textContent).toBe("10 graphemes, 10 code points. 5 flagged.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    const flagged = groups().filter((group) => group.hasAttribute("data-flagged"));
    expect(flagged.map((group) => group.querySelector(".uni__flag")!.textContent)).toEqual([
      "Like “a”",
      "Invisible (ZWSP)",
      "Bidi (RLO)",
      "Space (NBSP)",
      "Control (^G)",
    ]);
    const zwsp = groups()[6]!.querySelector("th")!;
    expect(zwsp.querySelector(".uni__placeholder")!.textContent).toBe("ZWSP");
    expect(groups()[6]!.querySelector("td:nth-child(3)")!.textContent).toBe("Cf Format");
  });

  it("says when nothing is flagged", () => {
    const { checks, get } = setup("hello");
    expect(checks()).toEqual(["All clear."]);
    expect(get("[data-checks] li").hasAttribute("data-clean")).toBe(true);
  });

  it("shows each normalisation form and whether it differs", () => {
    const { get } = setup("\ufb01e\u0301");
    const row = (form: string) => get(`[data-form="${form}"]`);
    expect(row("NFC").querySelector("[data-verdict]")!.textContent).toBe("Differs");
    expect(row("NFC").querySelector("[data-verdict]")!.hasAttribute("data-changed")).toBe(true);
    expect(row("NFC").querySelector("[data-text]")!.textContent).toBe("\ufb01é");
    expect(row("NFD").querySelector("[data-verdict]")!.textContent).toBe("Same");
    expect(row("NFKD").querySelector("[data-length]")!.textContent).toBe("4");
  });

  it("shows an empty row for empty text, and caps the table", () => {
    const { type, groups, get } = setup("");
    expect(groups()).toHaveLength(1);
    expect(groups()[0]!.textContent).toBe("Nothing yet.");
    expect(groups()[0]!.querySelector("td")!.colSpan).toBe(6);
    type("x".repeat(MAX_ROWS + 5));
    expect(groups()).toHaveLength(MAX_ROWS);
    expect(get("[data-note]").hidden).toBe(false);
    expect(get("[data-note]").textContent).toBe(`First ${MAX_ROWS} of ${MAX_ROWS + 5}.`);
    type("ok");
    expect(get("[data-note]").hidden).toBe(true);
    expect(groups()).toHaveLength(2);
  });

  it("lets the table's region take focus only while it scrolls sideways", () => {
    const { get, type } = setup("abc");
    const scroll = get("[data-scroll]");
    expect(scroll.hasAttribute("tabindex")).toBe(false);
    Object.defineProperty(scroll, "scrollWidth", { configurable: true, value: 800 });
    Object.defineProperty(scroll, "clientWidth", { configurable: true, value: 300 });
    window.dispatchEvent(new Event("resize"));
    expect(scroll.tabIndex).toBe(0);
    Object.defineProperty(scroll, "scrollWidth", { configurable: true, value: 300 });
    type("abcd");
    expect(scroll.hasAttribute("tabindex")).toBe(false);
  });

  it("copes without a category map", () => {
    document.body.innerHTML = `<div data-unicode><textarea data-input>a</textarea><p data-status></p>
      <dl>${["utf16", "codePoints", "graphemes", "utf8"].map((key) => `<dd data-count="${key}"></dd>`).join("")}</dl>
      <ul data-checks></ul><table>${forms.map((form) => `<tr data-form="${form}"><td><span data-verdict></span><code data-text></code></td><td data-length></td></tr>`).join("")}</table>
      <p data-note hidden></p><table data-table></table></div>`;
    initUnicode();
    expect(document.querySelector("[data-table] td:nth-child(3)")!.textContent).toBe("Ll ");
  });
});
