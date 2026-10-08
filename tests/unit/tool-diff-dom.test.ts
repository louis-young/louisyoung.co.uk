// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initDiff } from "../../src/scripts/tool-diff";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const setup = (before: string, after: string) => {
  document.body.innerHTML = `
    <div data-diff data-before="Original" data-after="Changed" data-line="Line" data-added="{count} added"
      data-removed="{count} removed" data-unchanged="{count} unchanged" data-added-line="Added"
      data-removed-line="Removed" data-skipped="{count} unchanged lines" data-identical="Identical."
      data-empty="Paste both." data-error-long="Max {lines} lines, {characters} characters."
      data-error-different="Over {edits} edits.">
      <textarea data-before></textarea>
      <textarea data-after></textarea>
      <input type="radio" name="view" value="split" checked />
      <input type="radio" name="view" value="unified" />
      <p data-status></p>
      <div data-output></div>
    </div>`;
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  (get("textarea[data-before]") as HTMLTextAreaElement).value = before;
  (get("textarea[data-after]") as HTMLTextAreaElement).value = after;
  initDiff();
  const rows = () =>
    [...document.querySelectorAll("[data-output] tbody tr")].map((row) =>
      [...row.children].map((cell) => cell.textContent).join("|"),
    );
  const headings = () => [...document.querySelectorAll("[data-output] thead th")].map((th) => th.textContent);
  return { get, rows, headings };
};

const type = (element: HTMLElement, value: string) => {
  (element as HTMLTextAreaElement).value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("text diff", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initDiff();
    }).not.toThrow();
  });

  it("shows changes side by side with symbols, labels and counts", () => {
    const { get, rows, headings } = setup("a\nb\nc", "a\nx\nc\nd");
    expect(get("[data-status]").textContent).toBe("2 added, 1 removed, 2 unchanged");
    expect(headings()).toEqual(["Original", "Changed"]);
    expect(rows()).toEqual(["1| |a|1| |a", "2|−Removed|b|2|+Added|x", "3| |c|3| |c", "|||4|+Added|d"]);
    expect(get("[data-output] col")).not.toBeNull();
    const removed = get('[data-output] td[data-type="remove"].diff__sign');
    expect(removed.querySelector("[aria-hidden]")?.textContent).toBe("−");
    expect(get("[data-output] .diff__blank")).not.toBeNull();
  });

  it("switches to a unified view", () => {
    const { get, rows, headings } = setup("a\nb", "a\nc");
    const unified = get('[value="unified"]') as HTMLInputElement;
    unified.checked = true;
    unified.dispatchEvent(new Event("change", { bubbles: true }));
    expect(headings()).toEqual(["Original", "Changed", "Line"]);
    expect(get("[data-output] thead").className).toBe("visually-hidden");
    expect(rows()).toEqual(["1|1| |a", "2||−Removed|b", "|2|+Added|c"]);
    expect(get('[data-output] tr[data-type="add"]')).not.toBeNull();
  });

  it("starts unified on narrow screens", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(width < 36rem)" }));
    const { headings } = setup("a", "b");
    expect(headings()).toEqual(["Original", "Changed", "Line"]);
  });

  it("folds long unchanged runs in both views", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i}`);
    const { get, rows } = setup(lines.join("\n"), [...lines, "end"].join("\n"));
    expect(rows()[0]).toBe("17 unchanged lines");
    expect((get(".diff__skip td") as HTMLTableCellElement).colSpan).toBe(6);
    const unified = get('[value="unified"]') as HTMLInputElement;
    unified.checked = true;
    unified.dispatchEvent(new Event("change", { bubbles: true }));
    expect((get(".diff__skip td") as HTMLTableCellElement).colSpan).toBe(4);
  });

  it("says when the texts match or are empty", () => {
    const { get } = setup("same", "same");
    expect(get("[data-status]").textContent).toBe("Identical.");
    expect(get("[data-output]").childElementCount).toBe(0);
    type(get("textarea[data-before]"), "");
    type(get("textarea[data-after]"), "");
    expect(get("[data-status]").textContent).toBe("Paste both.");
  });

  it("refuses input that would be too slow to compare", () => {
    const { get } = setup("x".repeat(200_001), "");
    expect(get("[data-status]").textContent).toBe("Max 5,000 lines, 200,000 characters.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    const many = (prefix: string) => Array.from({ length: 2001 }, (_, i) => `${prefix}${i}`).join("\n");
    type(get("textarea[data-before]"), many("a"));
    type(get("textarea[data-after]"), many("b"));
    expect(get("[data-status]").textContent).toBe("Over 2,000 edits.");
  });
});
