import { parseInteger } from "./base-tool";
import { contrastRatio } from "./colour";
import { formats, parseAnyColour, ratioText } from "./colour-convert";
import { describeCron, nextRuns, parseCron, type CronMessages } from "./cron-tool";
import type { ShareState } from "./share-state";
import { analyseSelectorList, formatSpecificity, SelectorError } from "./specificity-tool";
import { formatInZone, formatTimestamp, parseTimestamp } from "./timestamp-tool";

/**
 * Quick answers for the ⌘K palette: a query that is clearly a timestamp, a colour, a cron
 * expression, a prefixed number, a sum or a CSS selector gets an instant result, worked out by the
 * same code as the matching tool. Detection is deliberately strict: a plain word never matches, so
 * an answer can't take the top spot from the page someone was looking for.
 */

type QuickAnswerKind = "uuid" | "base" | "colour" | "timestamp" | "cron" | "maths" | "specificity";

/** Labels for the details under an answer. The palette index supplies them, translated. */
export interface QuickAnswerMessages {
  local: string;
  iso: string;
  seconds: string;
  hex: string;
  rgb: string;
  hsl: string;
  oklch: string;
  onWhite: string;
  onBlack: string;
  decimal: string;
  hexadecimal: string;
  binary: string;
  octal: string;
  nextRun: string;
  cron: CronMessages;
}

export interface QuickAnswerContext {
  now: Date;
  /** The reader's IANA time zone, for the local half of a date. */
  timeZone: string;
  /** Makes a random version 4 UUID. */
  uuid: () => string;
}

export interface QuickAnswer {
  kind: QuickAnswerKind;
  /** The result, as shown. */
  value: string;
  /** What Enter copies: the value without display-only grouping. */
  copy: string;
  details: { label: string; value: string }[];
  /** A hex colour to show as a swatch. */
  swatch?: string;
  /** The tool that works this out in full, and the share state that prefills it, if it has share links. */
  tool?: { slug: string; state?: ShareState };
}

/** Longer than any expression worth answering, and short enough that parsing is always instant. */
const maxLength = 200;

const numberFormat = new Intl.NumberFormat("en-GB");

// UUID ---------------------------------------------------------------------------------------

/** Formats 16 random bytes as a version 4, variant 1 UUID (RFC 9562 §5.4). */
export const uuidFromBytes = (bytes: Uint8Array) => {
  const copy = Uint8Array.from(bytes.slice(0, 16));
  copy[6] = ((copy[6] ?? 0) & 0x0f) | 0x40;
  copy[8] = ((copy[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(copy, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const uuidAnswer = (query: string, context: QuickAnswerContext): QuickAnswer | undefined => {
  if (!/^(?:uuid|uuid ?v4|guid)$/iu.test(query)) return undefined;
  const value = context.uuid();
  return { kind: "uuid", value, copy: value, details: [], tool: { slug: "uuid" } };
};

// Number bases --------------------------------------------------------------------------------

const baseAnswer = (query: string, messages: QuickAnswerMessages): QuickAnswer | undefined => {
  const match = /^([+-]?)0([xbo])([\da-f_]+)$/iu.exec(query);
  if (!match) return undefined;
  const value = parseInteger(query, 10);
  if (value === undefined) return undefined;
  const radix = match[2]?.toLowerCase();
  const sign = value < 0n ? "-" : "";
  const magnitude = value < 0n ? -value : value;
  const others = [
    { radix: "x", label: messages.hexadecimal, text: `${sign}0x${magnitude.toString(16)}` },
    { radix: "b", label: messages.binary, text: `${sign}0b${magnitude.toString(2)}` },
    { radix: "o", label: messages.octal, text: `${sign}0o${magnitude.toString(8)}` },
  ].filter((other) => other.radix !== radix);
  return {
    kind: "base",
    value: numberFormat.format(value),
    copy: value.toString(),
    details: [
      { label: messages.decimal, value: value.toString() },
      ...others.map((other) => ({ label: other.label, value: other.text })),
    ],
    tool: { slug: "base" },
  };
};

// Colours -------------------------------------------------------------------------------------

const white: [number, number, number] = [255, 255, 255];
const black: [number, number, number] = [0, 0, 0];

const colourAnswer = (query: string, messages: QuickAnswerMessages): QuickAnswer | undefined => {
  // A hex colour must have its #, or words such as "add" and "cafe" would be colours.
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/iu.test(query) && !/^(?:rgba?|hsla?|oklch)\(.*\)$/iu.test(query)) {
    return undefined;
  }
  const rgb = parseAnyColour(query);
  if (!rgb) return undefined;
  const written = formats(rgb);
  const onWhite = contrastRatio(rgb, white);
  const onBlack = contrastRatio(rgb, black);
  // Show the conversion people most likely want: hex for a function, OKLCH for a hex.
  const value = query.startsWith("#") ? written.oklch : written.hex;
  return {
    kind: "colour",
    value,
    copy: value,
    details: [
      { label: messages.hex, value: written.hex },
      { label: messages.rgb, value: written.rgb },
      { label: messages.hsl, value: written.hsl },
      { label: messages.oklch, value: written.oklch },
    ]
      // The answer already shows one of them.
      .filter((item) => item.value !== value)
      .concat([
        { label: messages.onWhite, value: ratioText(onWhite) },
        { label: messages.onBlack, value: ratioText(onBlack) },
      ]),
    swatch: written.hex,
    // The colour converter has no share links; the contrast checker does, against the better background.
    tool: {
      slug: "contrast",
      state: { foreground: written.hex, background: onWhite >= onBlack ? "#ffffff" : "#000000" },
    },
  };
};

// Timestamps ----------------------------------------------------------------------------------

/** Unix seconds from 1973 to 2286, or milliseconds from 1973 to 2286: anything else is just a number. */
const unixTimestamp = /^(?:\d{9,10}|\d{12,13})$/u;
const isoDate = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?\s*(?:z|[+-]\d{2}(?::?\d{2})?)?)?$/iu;

const timestampAnswer = (
  query: string,
  messages: QuickAnswerMessages,
  context: QuickAnswerContext,
): QuickAnswer | undefined => {
  if (!unixTimestamp.test(query) && !isoDate.test(query)) return undefined;
  const result = parseTimestamp(query);
  if ("error" in result) return undefined;
  const value = formatInZone(result.date, "UTC");
  const local = formatInZone(result.date, context.timeZone);
  const written = formatTimestamp(result.date);
  return {
    kind: "timestamp",
    value,
    copy: value,
    details: [
      // Someone in UTC already has their local time in the answer.
      ...(local === value ? [] : [{ label: messages.local, value: local }]),
      result.format === "iso"
        ? { label: messages.seconds, value: written.seconds }
        : { label: messages.iso, value: written.iso },
    ],
    tool: { slug: "timestamp" },
  };
};

// Cron ----------------------------------------------------------------------------------------

const cronFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
const cronNames = () => {
  const list = new Intl.ListFormat("en-GB", { type: "conjunction" });
  return {
    months: Array.from({ length: 12 }, (_, i) => cronFormat({ month: "long" }).format(Date.UTC(2023, i, 1))),
    // 1 January 2023 was a Sunday, so day 1 + i of that month is weekday i.
    days: Array.from({ length: 7 }, (_, i) => cronFormat({ weekday: "long" }).format(Date.UTC(2023, 0, 1 + i))),
    list: (items: string[]) => list.format(items),
  };
};

/** Five fields that each start with a digit or `*`, or a macro such as `@daily`. */
const cronShape = /^(?:@[a-z]+|[\d*][\w*,/-]*(?:\s+[\w*,/-]+){4})$/iu;

const cronAnswer = (
  query: string,
  messages: QuickAnswerMessages,
  context: QuickAnswerContext,
): QuickAnswer | undefined => {
  if (!cronShape.test(query)) return undefined;
  // Minutes and hours are numbers or `*`, so five plain words can never parse.
  const fields = query.split(/\s+/u);
  if (fields.length === 5 && !fields.slice(0, 2).every((field) => /^[\d*][\d*,/-]*$/u.test(field))) return undefined;
  const result = parseCron(query);
  if (!("schedule" in result)) return undefined;
  const value = describeCron(result.schedule, messages.cron, cronNames());
  const [next] = nextRuns(result.schedule, context.now, 1, "utc");
  return {
    kind: "cron",
    value,
    copy: value,
    details: next ? [{ label: messages.nextRun, value: formatInZone(next, "UTC") }] : [],
    tool: { slug: "cron", state: { expression: query } },
  };
};

// Arithmetic ----------------------------------------------------------------------------------

type Token = { type: "number"; value: number } | { type: "operator"; value: string };

const tokenize = (source: string): Token[] | undefined => {
  const tokens: Token[] = [];
  const pattern = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([-+*/%^()]))/uy;
  let at = 0;
  while (at < source.length) {
    if (source.slice(at).trim() === "") break;
    pattern.lastIndex = at;
    const match = pattern.exec(source);
    if (!match) return undefined;
    tokens.push(
      match[1] === undefined
        ? { type: "operator", value: match[2] ?? "" }
        : { type: "number", value: Number(match[1]) },
    );
    at = pattern.lastIndex;
  }
  return tokens;
};

/**
 * Evaluates arithmetic: numbers, `+ - * / % ^` and brackets, with the usual precedence. `^` is
 * a power and binds tighter than a unary minus (`-2^2` is -4) and to the right (`2^3^2` is 512).
 * A tiny recursive-descent parser: never `eval`. Returns undefined for anything else, for
 * a lone number (there is nothing to work out) and for results that aren't finite.
 */
export const evaluate = (source: string): number | undefined => {
  if (source.length > maxLength) return undefined;
  const tokens = tokenize(source);
  if (!tokens || tokens.length === 0) return undefined;
  let position = 0;
  let operations = 0;
  const peek = () => tokens[position];
  const isOperator = (value: string) => {
    const token = peek();
    return token?.type === "operator" && token.value === value;
  };
  const fail = () => {
    throw new SyntaxError("Not an expression");
  };

  const primary = (): number => {
    const token = peek();
    if (token?.type === "number") {
      position += 1;
      return token.value;
    }
    if (isOperator("(")) {
      position += 1;
      const value = expression();
      if (!isOperator(")")) fail();
      position += 1;
      return value;
    }
    return fail();
  };
  const power = (): number => {
    const base = primary();
    if (!isOperator("^")) return base;
    position += 1;
    operations += 1;
    return base ** unary();
  };
  const unary = (): number => {
    if (isOperator("-") || isOperator("+")) {
      const negative = isOperator("-");
      position += 1;
      const value = unary();
      return negative ? -value : value;
    }
    return power();
  };
  const term = (): number => {
    let value = unary();
    while (isOperator("*") || isOperator("/") || isOperator("%")) {
      const operator = peek()!.value;
      position += 1;
      operations += 1;
      const right = unary();
      value = operator === "*" ? value * right : operator === "/" ? value / right : value % right;
    }
    return value;
  };
  const expression = (): number => {
    let value = term();
    while (isOperator("+") || isOperator("-")) {
      const operator = peek()!.value;
      position += 1;
      operations += 1;
      const right = term();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };

  try {
    const value = expression();
    if (position !== tokens.length || operations === 0 || !Number.isFinite(value)) return undefined;
    return Object.is(value, -0) ? 0 : value;
  } catch {
    return undefined;
  }
};

/** A result as shown, grouped, and as copied, ungrouped. Huge and tiny values use E notation. */
export const formatNumber = (value: number) => {
  const magnitude = Math.abs(value);
  const scientific = magnitude >= 1e21 || (magnitude > 0 && magnitude < 1e-9);
  const options: Intl.NumberFormatOptions = scientific
    ? { notation: "scientific", maximumSignificantDigits: 12 }
    : { maximumSignificantDigits: 15 };
  return {
    shown: new Intl.NumberFormat("en-GB", options).format(value),
    copied: new Intl.NumberFormat("en-GB", { ...options, useGrouping: false }).format(value),
  };
};

/** Digits, operators, brackets and spaces, with at least one operator between two operands. */
const mathsShape = /^[\d\s.+\-*/%^()]+$/u;
/** Dates such as 2026-13-45 or 09/10/2026 would otherwise be read as subtraction or division. */
const dateLike = /^(?:\d{4}-\d{1,2}(?:-\d{1,2})?|\d{1,4}([-/])\d{1,2}\1\d{1,4})$/u;
/** Nobody writes a sum with a leading zero (`07946-000000`), but phone numbers have them. */
const leadingZero = /(?:^|[^\d.])0\d/u;
/** Two whole numbers joined by a hyphen with no spaces are a range (`9-5`, `2023-2024`), not a sum. */
const range = /^\d+-\d+$/u;

const mathsAnswer = (query: string): QuickAnswer | undefined => {
  if (
    !mathsShape.test(query) ||
    !/\d/u.test(query) ||
    dateLike.test(query) ||
    leadingZero.test(query) ||
    range.test(query)
  ) {
    return undefined;
  }
  const result = evaluate(query);
  if (result === undefined) return undefined;
  const { shown, copied } = formatNumber(result);
  return { kind: "maths", value: shown, copy: copied, details: [] };
};

// CSS selectors -------------------------------------------------------------------------------

/** Pseudo-classes and pseudo-elements people actually write, so `std::vector` or `re:invent` aren't selectors. */
const knownPseudos = new Set([
  "active",
  "after",
  "any-link",
  "backdrop",
  "before",
  "checked",
  "default",
  "defined",
  "dir",
  "disabled",
  "empty",
  "enabled",
  "first-child",
  "first-letter",
  "first-line",
  "first-of-type",
  "focus",
  "focus-visible",
  "focus-within",
  "has",
  "host",
  "hover",
  "in-range",
  "indeterminate",
  "invalid",
  "is",
  "lang",
  "last-child",
  "last-of-type",
  "link",
  "marker",
  "not",
  "nth-child",
  "nth-last-child",
  "nth-last-of-type",
  "nth-of-type",
  "only-child",
  "only-of-type",
  "open",
  "optional",
  "out-of-range",
  "part",
  "placeholder",
  "placeholder-shown",
  "popover-open",
  "read-only",
  "read-write",
  "required",
  "root",
  "scope",
  "selection",
  "slotted",
  "target",
  "user-invalid",
  "user-valid",
  "valid",
  "visited",
  "where",
]);

const looksLikeSelector = (query: string) => {
  // Selectors name something: `* * * *` is a cron schedule missing a field, not a question.
  if (/^[\d+-]/u.test(query) || !/[a-z[:]/iu.test(query)) return false;
  const marked = /^[.#[:*&]/u.test(query) || query.includes("[") || /:[a-z-]/iu.test(query);
  // A combinator counts only alongside a class, ID, attribute or pseudo, so `a > b` stays text.
  const combined = /[>~+]/u.test(query) && /[.#[:]/u.test(query);
  return marked || combined;
};

const parseSelectors = (query: string) => {
  try {
    return analyseSelectorList(query);
  } catch (error) {
    if (error instanceof SelectorError) return undefined;
    throw error;
  }
};

const specificityAnswer = (query: string): QuickAnswer | undefined => {
  if (!looksLikeSelector(query)) return undefined;
  const pseudos = [...query.matchAll(/::?([a-z-]+)/giu)].map((match) => (match[1] ?? "").toLowerCase());
  if (!pseudos.every((name) => knownPseudos.has(name))) return undefined;
  // One bare class or ID (`.env`, `#react`) is more likely a word or a hashtag than a question.
  if (/^[.#][\w-]+$/u.test(query)) return undefined;
  const results = parseSelectors(query);
  if (!results || results.length === 0) return undefined;
  const value = results.map((result) => formatSpecificity(result.specificity)).join(", ");
  return {
    kind: "specificity",
    value,
    copy: value,
    details:
      results.length > 1
        ? results.map((result) => ({ label: result.selector, value: formatSpecificity(result.specificity) }))
        : [],
    tool: { slug: "specificity", state: { selectors: query } },
  };
};

// Everything ----------------------------------------------------------------------------------

/**
 * The quick answer for a palette query, or undefined when the query isn't clearly one of the
 * supported shapes. Earlier kinds win: `#abc` is a colour before it is an ID selector,
 * `2026-10-09` is a date before it is a subtraction, and `2 * 3 * 4` is a sum before it is a
 * cron schedule.
 */
export const quickAnswer = (
  input: string,
  messages: QuickAnswerMessages,
  context: QuickAnswerContext,
): QuickAnswer | undefined => {
  const query = input.trim();
  if (query.length < 2 || query.length > maxLength) return undefined;
  return (
    uuidAnswer(query, context) ??
    baseAnswer(query, messages) ??
    colourAnswer(query, messages) ??
    timestampAnswer(query, messages, context) ??
    mathsAnswer(query) ??
    cronAnswer(query, messages, context) ??
    specificityAnswer(query)
  );
};

/** Fills `{name}` placeholders in a translated template. */
export const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => values[name] ?? match);
