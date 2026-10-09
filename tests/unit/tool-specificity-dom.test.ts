// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { initSpecificity } from "../../src/scripts/tool-specificity";

afterEach(() => {
  document.body.innerHTML = "";
});

const messages = {
  empty: "Type a selector.",
  "count-one": "{selector} has {specificity}.",
  "count-other": "{count} ranked. {selector} wins with {specificity}.",
  tie: "Ties with {other}.",
  "invalid-one": "{count} bad line.",
  "invalid-other": "{count} bad lines.",
  error: "Line {line}, column {column}: {message}",
  "error-unclosed": "“{text}” unclosed.",
  "error-unexpected": "“{text}” unexpected.",
  "error-empty": "Missing.",
  "error-combinator": "Dangling “{text}”.",
  "error-end": "Too short.",
  "line-label": "Line {line}",
  via: "(in {name})",
  none: "None",
};

const weights = ["id", "class", "type"];

const setup = (value: string) => {
  const attributes = Object.entries(messages)
    .map(([key, text]) => `data-${key}="${text}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-specificity ${attributes}>
      <textarea data-input></textarea>
      <p data-status></p>
      <ul data-errors hidden></ul>
      <ol data-list></ol>
      <template data-item-template>
        <li>
          <span data-rank></span><code data-selector></code><span data-winner hidden>Wins</span>
          <dl class="spec__score">${weights.map((weight) => `<div data-weight="${weight}"><dd data-score></dd></div>`).join("")}</dl>
          <dl class="spec__breakdown">${weights.map((weight) => `<div data-weight="${weight}"><dd data-items></dd></div>`).join("")}</dl>
          <p data-line></p>
        </li>
      </template>
    </div>`;
  const input = document.querySelector<HTMLTextAreaElement>("[data-input]")!;
  input.value = value;
  initSpecificity();
  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const items = () => [...document.querySelectorAll<HTMLElement>("[data-list] > li")];
  const status = () => document.querySelector("[data-status]")!.textContent;
  const errors = () => document.querySelector<HTMLElement>("[data-errors]")!;
  return { type, items, status, errors };
};

describe("specificity calculator", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initSpecificity();
    }).not.toThrow();
  });

  it("ranks selectors, highlights them and marks the winner", () => {
    const { items, status } = setup(".a\n#b:not(p)\nul li");
    expect(status()).toBe("3 ranked. #b:not(p) wins with (1, 0, 1).");
    const [first, second] = items();
    expect(first!.querySelector("[data-rank]")!.textContent).toBe("1");
    expect(first!.hasAttribute("data-winning")).toBe(true);
    expect(first!.querySelector<HTMLElement>("[data-winner]")!.hidden).toBe(false);
    expect(second!.querySelector<HTMLElement>("[data-winner]")!.hidden).toBe(true);
    expect(first!.querySelector("[data-selector]")!.innerHTML).toBe(
      '<span data-kind="id">#b</span>:not(<span data-kind="type">p</span>)',
    );
    const scores = [...first!.querySelectorAll("[data-score]")].map((score) => score.textContent);
    expect(scores).toEqual(["1", "0", "1"]);
    const breakdown = [...first!.querySelectorAll("[data-items]")].map((cell) => cell.textContent);
    expect(breakdown).toEqual(["#b", "None", "p (in :not())"]);
    expect(first!.querySelector("[data-line]")!.textContent).toBe("Line 2");
  });

  it("separates several contributions with commas", () => {
    const { items } = setup("a.b.c");
    expect(items()[0]!.querySelector('.spec__breakdown [data-weight="class"] [data-items]')!.textContent).toBe(
      ".b, .c",
    );
  });

  it("describes one selector, ties and an empty input", () => {
    const { type, status, items } = setup("li");
    expect(status()).toBe("li has (0, 0, 1).");
    expect(items()[0]!.hasAttribute("data-winning")).toBe(false);
    type(".a\n.b");
    expect(status()).toBe("2 ranked. .b wins with (0, 1, 0). Ties with .a.");
    type("  ");
    expect(status()).toBe("Type a selector.");
    expect(items()).toHaveLength(0);
  });

  it("lists invalid lines and keeps the rest", () => {
    const { type, status, errors } = setup("a >\n.b\n[x\n:\n#1\n,");
    expect(status()).toBe(".b has (0, 1, 0). 5 bad lines.");
    expect([...errors().children].map((item) => item.textContent)).toEqual([
      "Line 1, column 3: Dangling “>”.",
      "Line 3, column 1: “[” unclosed.",
      "Line 4, column 2: Too short.",
      "Line 5, column 1: “#1” unexpected.",
      "Line 6, column 1: Missing.",
    ]);
    expect(errors().hidden).toBe(false);
    expect(document.querySelector("[data-status]")!.hasAttribute("data-invalid")).toBe(true);
    type("a >");
    expect(status()).toBe("1 bad line.");
    type("a");
    expect(errors().hidden).toBe(true);
  });
});
