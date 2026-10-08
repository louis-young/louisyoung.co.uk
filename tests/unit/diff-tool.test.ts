import { describe, expect, it } from "vitest";

import { collapse, diffLimits, diffLines, sideBySide, type DiffLine } from "../../src/lib/diff-tool";

/** A compact picture of a diff: " a" unchanged, "-a" removed, "+a" added. */
const picture = (before: string, after: string, limits = diffLimits) => {
  const result = diffLines(before, after, limits);
  if ("error" in result) return result.error;
  return result.lines.map((line) => ({ equal: " ", add: "+", remove: "-" })[line.type] + line.text);
};

/** Rebuilds both texts from a diff, which any correct diff must allow. */
const rebuild = (lines: DiffLine[]) => ({
  before: lines.filter((line) => line.type !== "add").map((line) => line.text),
  after: lines.filter((line) => line.type !== "remove").map((line) => line.text),
});

describe("diffLines", () => {
  it("finds a minimal line diff", () => {
    expect(picture("a\nb\nc", "a\nx\nc")).toEqual([" a", "-b", "+x", " c"]);
    expect(picture("a\nb\nc\na\nb\nb\na", "c\nb\na\nb\na\nc")).toHaveLength(7 + 2);
    expect(picture("one\ntwo", "zero\none\ntwo\nthree")).toEqual(["+zero", " one", " two", "+three"]);
    expect(picture("a\nb\nc", "c")).toEqual(["-a", "-b", " c"]);
  });

  it("handles empty sides", () => {
    expect(diffLines("", "")).toEqual({ lines: [], summary: { added: 0, removed: 0, unchanged: 0 } });
    expect(picture("", "a\nb")).toEqual(["+a", "+b"]);
    expect(picture("a\nb", "")).toEqual(["-a", "-b"]);
  });

  it("treats CRLF and CR line endings like LF, and keeps a trailing empty line", () => {
    expect(picture("a\r\nb\rc", "a\nb\nc")).toEqual([" a", " b", " c"]);
    expect(picture("a", "a\n")).toEqual([" a", "+"]);
  });

  it("numbers lines on each side and counts the changes", () => {
    expect(diffLines("a\nb\nc", "a\nc\nd")).toEqual({
      lines: [
        { type: "equal", text: "a", before: 1, after: 1 },
        { type: "remove", text: "b", before: 2 },
        { type: "equal", text: "c", before: 3, after: 2 },
        { type: "add", text: "d", after: 3 },
      ],
      summary: { added: 1, removed: 1, unchanged: 2 },
    });
  });

  it("always produces a diff that rebuilds both texts", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const text = () =>
      Array.from({ length: Math.floor(random() * 12) }, () => "abcd"[Math.floor(random() * 4)] ?? "").join("\n");
    for (let i = 0; i < 300; i++) {
      const before = text();
      const after = text();
      const result = diffLines(before, after);
      if ("error" in result) throw new Error("unexpected error");
      expect(rebuild(result.lines)).toEqual({
        before: before === "" ? [] : before.split("\n"),
        after: after === "" ? [] : after.split("\n"),
      });
    }
  });

  it("refuses input over the size limits", () => {
    expect(diffLines("x".repeat(diffLimits.characters + 1), "")).toEqual({ error: "tooLong" });
    expect(diffLines("", "x".repeat(diffLimits.characters + 1))).toEqual({ error: "tooLong" });
    expect(diffLines("\n".repeat(diffLimits.lines), "")).toEqual({ error: "tooLong" });
    expect(picture("a\nb\nc", "x\ny\nz", { characters: 100, lines: 2, edits: 10 })).toBe("tooLong");
  });

  it("gives up when the texts differ by more edits than allowed", () => {
    const limits = { characters: 1000, lines: 100, edits: 3 };
    expect(picture("a\nb", "c\nd", limits)).toBe("tooDifferent");
    expect(picture("a\nb", "a\nc", limits)).toEqual([" a", "-b", "+c"]);
  });

  it("stays quick on a large edit in the middle of a long text", () => {
    const lines = Array.from({ length: 5000 }, (_, i) => `line ${i}`);
    const changed = lines.map((line, i) => (i % 500 === 0 ? `${line} changed` : line));
    const result = diffLines(lines.join("\n"), changed.join("\n"));
    expect(result).toMatchObject({ summary: { added: 10, removed: 10, unchanged: 4990 } });
  });
});

const lines = (before: string, after: string) => {
  const result = diffLines(before, after);
  return "lines" in result ? result.lines : [];
};

describe("collapse", () => {
  const long = Array.from({ length: 20 }, (_, i) => String(i));

  it("folds long unchanged runs, keeping context around changes", () => {
    const changed = [...long];
    changed[10] = "ten";
    const items = collapse(lines(long.join("\n"), changed.join("\n")), 2);
    expect(items.map((item) => (item.type === "skip" ? `…${item.count}` : item.text))).toEqual([
      "…8",
      "8",
      "9",
      "10",
      "ten",
      "11",
      "12",
      "…7",
    ]);
  });

  it("keeps short runs, and everything when nothing is long enough to fold", () => {
    expect(collapse(lines("a\nb\nc", "a\nx\nc"))).toHaveLength(4);
    const changed = ["start", ...long.slice(0, 7), "middle", ...long.slice(0, 4)];
    const items = collapse(
      lines(changed.join("\n"), changed.join("\n").replace("start", "begin").replace("middle", "centre")),
    );
    expect(items.some((item) => item.type === "skip")).toBe(false);
    expect(collapse([])).toEqual([]);
  });

  it("folds an identical text down to one skip", () => {
    expect(collapse(lines(long.join("\n"), long.join("\n")))).toEqual([{ type: "skip", count: 20 }]);
  });
});

describe("sideBySide", () => {
  it("pairs removals with the additions that replace them", () => {
    const rows = sideBySide(collapse(lines("a\nb\nc\nd", "a\nx\nd\ne\nf")));
    expect(
      rows.map((row) => ("type" in row ? "skip" : `${row.before?.text ?? "·"}|${row.after?.text ?? "·"}`)),
    ).toEqual(["a|a", "b|x", "c|·", "d|d", "·|e", "·|f"]);
  });

  it("passes folded runs through", () => {
    const long = Array.from({ length: 12 }, (_, i) => String(i)).join("\n");
    const rows = sideBySide(collapse(lines(long, `${long}\nend`)));
    expect(rows[0]).toEqual({ type: "skip", count: 9 });
    expect(rows.at(-1)).toMatchObject({ before: undefined, after: { text: "end" } });
  });
});
