// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { initRegex } from "../../src/scripts/tool-regex";

afterEach(() => {
  document.body.innerHTML = "";
});

const setup = (pattern: string, text: string, flags = "g") => {
  document.body.innerHTML = `
    <div data-regex data-count-none="No matches" data-count-one="1 match" data-count-other="{count} matches"
      data-truncated="Stopped at {count}." data-error-pattern="Invalid: {reason}" data-match-at="Match {number} at {index}"
      data-group="Group {number}" data-group-named="Group {number} · {name}" data-unmatched="not matched"
      data-empty-match="empty">
      <input type="text" data-pattern />
      ${["g", "i", "m", "s", "u", "y"].map((flag) => `<input type="checkbox" data-flag="${flag}"${flags.includes(flag) ? " checked" : ""} />`).join("")}
      <textarea data-text></textarea>
      <p data-status></p>
      <div data-highlight></div>
      <ol data-matches></ol>
    </div>`;
  document.querySelector<HTMLInputElement>("[data-pattern]")!.value = pattern;
  document.querySelector<HTMLTextAreaElement>("[data-text]")!.value = text;
  initRegex();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  return {
    pattern: get("[data-pattern]") as HTMLInputElement,
    text: get("[data-text]") as HTMLTextAreaElement,
    status: get("[data-status]"),
    highlight: get("[data-highlight]"),
    list: get("[data-matches]"),
    flag: (name: string) => get(`[data-flag="${name}"]`) as HTMLInputElement,
  };
};

const type = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("regex tester", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initRegex();
    }).not.toThrow();
  });

  it("highlights and lists matches with their groups", () => {
    const { status, highlight, list } = setup(String.raw`(?<year>\d{4})(-)?(x)?`, "in 2024 and 2026-");
    expect(status.textContent).toBe("2 matches");
    const marks = [...highlight.querySelectorAll("mark")];
    expect(marks.map((mark) => mark.textContent)).toEqual(["2024", "2026-"]);
    expect(marks.map((mark) => mark.hasAttribute("data-alternate"))).toEqual([false, true]);
    expect(highlight.textContent).toBe("in 2024 and 2026-");
    const items = list.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]!.querySelector("p")!.textContent).toBe("Match 1 at 3");
    expect([...items[0]!.querySelectorAll("dt")].map((term) => term.textContent)).toEqual([
      "Group 1 · year",
      "Group 2",
      "Group 3",
    ]);
    expect([...items[0]!.querySelectorAll("dd")].map((detail) => detail.textContent)).toEqual([
      "2024",
      "not matched",
      "not matched",
    ]);
    expect(items[1]!.querySelectorAll("dd")[1]!.textContent).toBe("-");
  });

  it("never renders the text as HTML", () => {
    const { highlight, list } = setup("<img[^>]*>", 'a <img src=x onerror="alert(1)"> b');
    expect(highlight.querySelector("img")).toBeNull();
    expect(list.querySelector("img")).toBeNull();
    expect(highlight.querySelector("mark")!.textContent).toBe('<img src=x onerror="alert(1)">');
  });

  it("reacts to flags, and counts one or no matches", () => {
    const { status, flag, list } = setup("a", "A a");
    expect(status.textContent).toBe("1 match");
    flag("i").checked = true;
    flag("i").dispatchEvent(new Event("input", { bubbles: true }));
    expect(status.textContent).toBe("2 matches");
    flag("g").checked = false;
    flag("i").checked = false;
    flag("i").dispatchEvent(new Event("input", { bubbles: true }));
    expect(status.textContent).toBe("1 match");
    expect(list.querySelector("dl")).toBeNull();
    const none = setup("z", "abc");
    expect(none.status.textContent).toBe("No matches");
    expect(none.highlight.textContent).toBe("abc");
  });

  it("labels empty matches and reports truncation", () => {
    const { status, list, text } = setup("", "ab");
    expect(list.querySelector("code")!.textContent).toBe("empty");
    expect(status.textContent).toBe("3 matches");
    type(text, "a".repeat(1200));
    expect(status.textContent).toBe("1,000 matches. Stopped at 1,000.");
  });

  it("shows invalid patterns and recovers", () => {
    const { pattern, status, highlight, list } = setup("(", "abc");
    expect(status.textContent).toMatch(/^Invalid: /u);
    expect(status.hasAttribute("data-invalid")).toBe(true);
    expect(pattern.getAttribute("aria-invalid")).toBe("true");
    expect(highlight.textContent).toBe("abc");
    expect(list.children).toHaveLength(0);
    type(pattern, "b");
    expect(pattern.getAttribute("aria-invalid")).toBe("false");
    expect(highlight.querySelector("mark")!.textContent).toBe("b");
  });
});
