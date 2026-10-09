import { describe, expect, it } from "vitest";

import { mayHaveQuickAnswer } from "../../src/lib/quick-answer-trigger";
import {
  evaluate,
  fill,
  formatNumber,
  quickAnswer,
  uuidFromBytes,
  type QuickAnswerMessages,
} from "../../src/lib/quick-answers";
import { formatInZone } from "../../src/lib/timestamp-tool";

const messages: QuickAnswerMessages = {
  local: "Your time zone",
  iso: "ISO 8601",
  seconds: "Unix seconds",
  hex: "Hex",
  rgb: "RGB",
  hsl: "HSL",
  oklch: "OKLCH",
  onWhite: "On white",
  onBlack: "On black",
  decimal: "Decimal",
  hexadecimal: "Hexadecimal",
  binary: "Binary",
  octal: "Octal",
  nextRun: "Next run",
  cron: {
    at: "At {times}",
    everyMinute: "Every minute",
    everyMinutes: "Every {step} minutes",
    minuteOne: "At minute {list}",
    minuteOther: "At minutes {list}",
    during: "during {list}",
    dayOne: "on day {list} of the month",
    dayOther: "on days {list} of the month",
    months: "in {list}",
    days: "on {list}",
    weekdays: "on weekdays",
    weekends: "at weekends",
    either: "{first} or {second}",
  },
};

const context = {
  now: new Date("2026-10-09T08:00:00Z"),
  timeZone: "Asia/Tokyo",
  uuid: () => "123e4567-e89b-42d3-a456-426614174000",
};

/** Dates as the timestamp tool writes them; ICU versions differ on the comma after the weekday. */
const zoned = (iso: string, zone = "UTC") => formatInZone(new Date(iso), zone);
const answer = (query: string) => quickAnswer(query, messages, context);
const detail = (query: string, label: string) => answer(query)?.details.find((item) => item.label === label)?.value;

describe("quickAnswer: timestamps", () => {
  it("reads Unix seconds and milliseconds as a UTC and a local date", () => {
    expect(answer("1700000000")).toEqual({
      kind: "timestamp",
      value: zoned("2023-11-14T22:13:20Z"),
      copy: zoned("2023-11-14T22:13:20Z"),
      details: [
        { label: "Your time zone", value: zoned("2023-11-14T22:13:20Z", "Asia/Tokyo") },
        { label: "ISO 8601", value: "2023-11-14T22:13:20.000Z" },
      ],
      tool: { slug: "timestamp" },
    });
    expect(answer("1700000000000")?.value).toBe(zoned("2023-11-14T22:13:20Z"));
    // In UTC, the local time would only repeat the answer.
    expect(quickAnswer("1700000000", messages, { ...context, timeZone: "UTC" })?.details).toEqual([
      { label: "ISO 8601", value: "2023-11-14T22:13:20.000Z" },
    ]);
    expect(answer("123456789")?.value).toBe(zoned("1973-11-29T21:33:09Z"));
  });

  it("reads ISO 8601 dates and date-times, giving Unix seconds", () => {
    expect(answer("2026-10-09")?.value).toBe(zoned("2026-10-09T00:00:00Z"));
    expect(detail("2026-10-09", "Unix seconds")).toBe("1791504000");
    expect(answer("2026-10-09T10:30:00+01:00")?.value).toBe(zoned("2026-10-09T09:30:00Z"));
    expect(answer("2026-10-09 10:30Z")?.value).toBe(zoned("2026-10-09T10:30:00Z"));
    expect(answer("2026-10-09T10:30:00.250z")?.kind).toBe("timestamp");
  });

  it("ignores numbers that are too short or too long to be timestamps, and impossible dates", () => {
    for (const query of ["12345678", "12345678901", "12345678901234", "2026-13-45", "2026-02-30", "2026-10-09T25:00"]) {
      expect(answer(query), query).toBeUndefined();
    }
  });
});

describe("quickAnswer: colours", () => {
  it("converts a hex colour, with a swatch, contrast and a prefilled contrast checker", () => {
    const result = answer("#7c6cf0");
    expect(result).toMatchObject({
      kind: "colour",
      value: "oklch(61.34% 0.1911 284.77)",
      swatch: "#7c6cf0",
      tool: { slug: "contrast", state: { foreground: "#7c6cf0", background: "#000000" } },
    });
    // OKLCH is the answer itself, so it isn't repeated below it.
    expect(result?.details.map(({ label }) => label)).toEqual(["Hex", "RGB", "HSL", "On white", "On black"]);
    expect(answer("rgb(255 0 0)")?.details.map(({ label }) => label)).toEqual([
      "RGB",
      "HSL",
      "OKLCH",
      "On white",
      "On black",
    ]);
    expect(detail("#7c6cf0", "RGB")).toBe("rgb(124 108 240)");
    expect(detail("#fff", "On black")).toBe("21.00:1");
    expect(detail("#000", "On white")).toBe("21.00:1");
    expect(answer("#000")?.tool?.state).toEqual({ foreground: "#000000", background: "#ffffff" });
  });

  it("converts rgb(), hsl() and oklch() to hex", () => {
    expect(answer("rgb(255, 0, 0)")?.value).toBe("#ff0000");
    expect(answer("rgba(0 128 0 / 50%)")?.value).toBe("#008000");
    expect(answer("hsl(240 100% 50%)")?.value).toBe("#0000ff");
    expect(answer("HSL(0, 0%, 100%)")?.value).toBe("#ffffff");
    expect(answer("oklch(100% 0 0)")?.value).toBe("#ffffff");
  });

  it("needs the # and a valid colour", () => {
    for (const query of [
      "add",
      "cafe",
      "fff",
      "bad",
      "#ggg",
      "#abcd",
      "#12345",
      "rgb(300 0 0)",
      "hsl(0 0% 200%)",
      "rgb()",
    ]) {
      expect(answer(query), query).toBeUndefined();
    }
  });
});

describe("quickAnswer: UUIDs", () => {
  it("makes a UUID for uuid, uuid v4 and guid, and points at the hash tool", () => {
    for (const query of ["uuid", "UUID", "uuid v4", "uuidv4", "guid"]) {
      expect(answer(query), query).toEqual({
        kind: "uuid",
        value: "123e4567-e89b-42d3-a456-426614174000",
        copy: "123e4567-e89b-42d3-a456-426614174000",
        details: [],
        tool: { slug: "hash" },
      });
    }
  });

  it("only for the word on its own", () => {
    for (const query of ["uuids", "what is a uuid", "uuid generator", "guide"]) {
      expect(answer(query), query).toBeUndefined();
    }
  });

  it("formats random bytes as a version 4 UUID", () => {
    expect(uuidFromBytes(new Uint8Array(16))).toBe("00000000-0000-4000-8000-000000000000");
    expect(uuidFromBytes(new Uint8Array(16).fill(255))).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    expect(uuidFromBytes(Uint8Array.from({ length: 16 }, (_, i) => i))).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });
});

describe("quickAnswer: cron", () => {
  it("describes a schedule and its next run, and prefills the cron tool", () => {
    expect(answer("0 9 * * 1-5")).toEqual({
      kind: "cron",
      value: "At 09:00 on weekdays",
      copy: "At 09:00 on weekdays",
      details: [{ label: "Next run", value: zoned("2026-10-09T09:00:00Z") }],
      tool: { slug: "cron", state: { expression: "0 9 * * 1-5" } },
    });
    expect(answer("*/15 * * * *")?.value).toBe("Every 15 minutes");
    expect(answer("0 0 1 jan *")?.value).toBe("At 00:00 on day 1 of the month in January");
    expect(answer("@daily")?.value).toBe("At 00:00");
  });

  it("has no next run for a schedule that never fires", () => {
    expect(answer("0 0 30 2 *")?.details).toEqual([]);
  });

  it("rejects five words, invalid fields and unknown macros", () => {
    for (const query of [
      "one two three four five",
      "jan mon tue wed thu",
      "* * * *",
      "* * * * * *",
      "60 * * * *",
      "a 9 * * 1",
      "@sometimes",
      "@",
    ]) {
      expect(answer(query), query).toBeUndefined();
    }
  });
});

describe("quickAnswer: number bases", () => {
  it("converts 0x, 0b and 0o numbers to decimal, with the other bases", () => {
    expect(answer("0xff")).toEqual({
      kind: "base",
      value: "255",
      copy: "255",
      details: [
        { label: "Decimal", value: "255" },
        { label: "Binary", value: "0b11111111" },
        { label: "Octal", value: "0o377" },
      ],
      tool: { slug: "base" },
    });
    expect(answer("0b1010")?.value).toBe("10");
    expect(detail("0b1010", "Hexadecimal")).toBe("0xa");
    expect(answer("0o777")?.value).toBe("511");
    expect(answer("0XFF_FF")?.value).toBe("65,535");
    expect(answer("0xffffffffffffffff")?.copy).toBe("18446744073709551615");
    expect(answer("-0x10")?.value).toBe("-16");
    expect(detail("-0x10", "Binary")).toBe("-0b10000");
  });

  it("rejects digits that don't belong to the base", () => {
    for (const query of ["0b102", "0o8", "0xg", "0x", "0x_f", "0b"]) {
      expect(answer(query), query).toBeUndefined();
    }
  });
});

describe("quickAnswer: arithmetic", () => {
  it.each([
    ["2^10", "1,024", "1024"],
    ["1024/16", "64", "64"],
    ["1 + 2 * 3", "7", "7"],
    ["(1 + 2) * 3", "9", "9"],
    ["10 % 3", "1", "1"],
    ["-2^2", "-4", "-4"],
    ["2^-1", "0.5", "0.5"],
    ["2^3^2", "512", "512"],
    ["0.1 + 0.2", "0.3", "0.3"],
    ["1/3", "0.333333333333333", "0.333333333333333"],
    ["-(3 - 5)", "2", "2"],
    ["+4 - 1", "3", "3"],
    [".5 * 4", "2", "2"],
    ["1000000 * 1000", "1,000,000,000", "1000000000"],
    ["2^100", "1.26765060023E30", "1.26765060023E30"],
    ["1 / 2^40", "9.09494701773E-13", "9.09494701773E-13"],
    ["0 * -1", "0", "0"],
  ])("%s is %s", (query, value, copy) => {
    expect(answer(query)).toEqual({ kind: "maths", value, copy, details: [] });
  });

  it("prefers a sum to a cron schedule that happens to look like one", () => {
    expect(answer("2 * 3 * 4")?.kind).toBe("maths");
  });

  it.each([
    "1024",
    "-5",
    "(5)",
    "1/0",
    "0/0",
    "10^400",
    "1 +",
    "* 2",
    "2 ** 3",
    "(1 + 2",
    "1 + 2)",
    "()",
    "1.2.3",
    "1 2",
    "2x + 1",
    "2026-10-1",
    "2026-10",
    "2026-13-45",
    "1e3 + 1",
    "Math.PI * 2",
    "alert(1)",
    "constructor",
  ])("%s gets no answer", (query) => {
    expect(answer(query)).toBeUndefined();
  });

  it("evaluates without eval, and refuses very long input", () => {
    expect(evaluate("((((1))))+1")).toBe(2);
    expect(evaluate("")).toBeUndefined();
    expect(evaluate("   ")).toBeUndefined();
    expect(evaluate(`${"1+".repeat(150)}1`)).toBeUndefined();
    expect(evaluate("1 + 1 ")).toBe(2);
  });

  it("formats results with grouping to show and without to copy", () => {
    expect(formatNumber(1234567.5)).toEqual({ shown: "1,234,567.5", copied: "1234567.5" });
    expect(formatNumber(-0.25)).toEqual({ shown: "-0.25", copied: "-0.25" });
    expect(formatNumber(0)).toEqual({ shown: "0", copied: "0" });
  });
});

describe("quickAnswer: CSS specificity", () => {
  it.each([
    ["#main .card > a:hover", "(1, 2, 1)"],
    [".btn.primary", "(0, 2, 0)"],
    ["a:hover", "(0, 1, 1)"],
    ["input[type=text]", "(0, 1, 1)"],
    ["[data-theme]", "(0, 1, 0)"],
    ["::before", "(0, 0, 1)"],
    [":is(#a, .b) p", "(1, 0, 1)"],
    ["nav > .item", "(0, 1, 1)"],
    ["*:focus-visible", "(0, 1, 0)"],
    ["ul li:nth-child(2n+1)", "(0, 1, 2)"],
  ])("%s has a specificity of %s", (query, value) => {
    expect(answer(query)).toMatchObject({
      kind: "specificity",
      value,
      details: [],
      tool: { slug: "specificity", state: { selectors: query } },
    });
  });

  it("lists each selector in a list", () => {
    expect(answer(".a, #b:hover")).toMatchObject({
      value: "(0, 1, 0), (1, 1, 0)",
      details: [
        { label: ".a", value: "(0, 1, 0)" },
        { label: "#b:hover", value: "(1, 1, 0)" },
      ],
    });
  });

  it.each([
    "div",
    "hello world",
    "node.js",
    "vue.js",
    "div.card",
    "a > b",
    "a, b",
    ".env",
    "#react",
    "#1",
    "std::vector",
    "re:invent",
    "TODO: fix",
    "localhost:4321",
    "https://example.com",
    "c++",
    "c#",
    ":)",
    ".5",
    "a[",
    "e.g.",
    ".a >",
    "* * * *",
    "* > *",
  ])("%s gets no answer", (query) => {
    expect(answer(query)).toBeUndefined();
  });
});

describe("quickAnswer: plain searches", () => {
  it.each([
    "",
    " ",
    "a",
    "1",
    "#",
    "hire",
    "react",
    "createContext",
    "useEventListener",
    "keyboard",
    "terminal",
    "dark mode",
    "how to fetch data",
    "the quick brown fox jumps",
    "contrast",
    "colour",
    "cron",
    "timestamp",
    "hash",
    "base",
    "specificity",
    "json",
    "Crème brûlée",
    "me@louisyoung.co.uk",
    "/tools",
    "v1.2.3",
    "react-18",
    "2.0",
  ])("%j gets no answer", (query) => {
    expect(answer(query)).toBeUndefined();
  });

  // Bug hunt: British and American dates and phone numbers were worked out as sums.
  it.each(["09/10/2026", "1/4/2025", "9/10/26", "10-12-2025", "2025/10/09", "07946-000000", "1-800-555-0199"])(
    "%j is a date or a phone number, not a sum",
    (query) => {
      expect(answer(query)).toBeUndefined();
    },
  );

  // A hyphen between two whole numbers with no spaces is a range: opening hours, years, scores.
  it.each(["9-5", "2023-2024", "10-12", "1-0"])("%j is a range, not a subtraction", (query) => {
    expect(answer(query)).toBeUndefined();
  });

  it("still subtracts when the hyphen is spaced or part of a longer sum", () => {
    expect(answer("2023 - 2024")?.value).toBe("-1");
    expect(answer("10-2*3")?.value).toBe("4");
    expect(answer("1.5-0.5")?.value).toBe("1");
  });

  it("still works out sums with a zero and a decimal point", () => {
    expect(answer("0.5 - 0.25")?.value).toBe("0.25");
    expect(answer("100 - 50")?.value).toBe("50");
  });

  it("ignores surrounding space and very long queries", () => {
    expect(answer("  2^10  ")?.value).toBe("1,024");
    expect(answer(`#${"a".repeat(250)} .b`)).toBeUndefined();
  });
});

describe("mayHaveQuickAnswer", () => {
  const answered = [
    "1700000000",
    "2026-10-09",
    "#7c6cf0",
    "rgb(0 0 0)",
    "hsl(0 0% 0%)",
    "oklch(50% 0.1 200)",
    "uuid",
    "GUID",
    "*/15 * * * *",
    "@daily",
    "0xff",
    "2^10",
    "(1+2)*3",
    "a:hover",
    "input[type=text]",
    "nav > .item",
    ".btn.primary",
    "::before",
  ];

  it("passes every query that has an answer, so the answer code loads for it", () => {
    for (const query of answered) {
      expect(answer(query), query).toBeDefined();
      expect(mayHaveQuickAnswer(query), query).toBe(true);
    }
  });

  it("never loads the answer code for words", () => {
    for (const query of ["", "a", "hire", "react", "createContext", "dark mode", "how-to", "Crème brûlée"]) {
      expect(mayHaveQuickAnswer(query), query).toBe(false);
    }
  });
});

describe("fill", () => {
  it("fills named placeholders and leaves unknown ones", () => {
    expect(fill("Answer: {value}. {other}", { value: "1,024" })).toBe("Answer: 1,024. {other}");
  });
});
