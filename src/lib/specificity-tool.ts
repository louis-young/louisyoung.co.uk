/**
 * A CSS selector tokenizer, parser and specificity calculator that follows Selectors Level 4
 * (https://www.w3.org/TR/selectors-4/#specificity-rules) and CSS Scoping for `:host` and `::slotted()`.
 */

type TokenType =
  | "whitespace"
  | "comment"
  | "ident"
  | "function"
  | "hash"
  | "string"
  | "number"
  | "colon"
  | "comma"
  | "open-square"
  | "close-square"
  | "open-paren"
  | "close-paren"
  | "delim";

export interface Token {
  type: TokenType;
  /** The source text, escapes and all. */
  text: string;
  /** Lower-cased name for identifiers, functions (without the bracket) and hashes (without the #). */
  value: string;
  start: number;
  end: number;
}

export type SelectorErrorCode = "unclosed" | "unexpected" | "empty" | "combinator";

export class SelectorError extends Error {
  constructor(
    readonly code: SelectorErrorCode,
    /** Offset in the source where the problem starts. */
    readonly at: number,
    /** The text at fault, if any. */
    readonly text = "",
  ) {
    super(`${code} at ${at}${text ? `: ${text}` : ""}`);
  }
}

const isWhitespace = (char: string) => char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\f";
const isDigit = (char: string) => char >= "0" && char <= "9";
const isHex = (char: string) => /^[\da-f]$/iu.test(char);
const isNameStart = (char: string) => /^[a-z_]$/iu.test(char) || (char !== "" && char.codePointAt(0)! >= 0x80);
const isName = (char: string) => isNameStart(char) || isDigit(char) || char === "-";
const isEscape = (source: string, at: number) =>
  source[at] === "\\" && at + 1 < source.length && source[at + 1] !== "\n";

/** The offset just after the escape that starts at `at`. */
const skipEscape = (source: string, at: number) => {
  let index = at + 1;
  if (!isHex(source[index] ?? "")) return index + String.fromCodePoint(source.codePointAt(index)!).length;
  const limit = index + 6;
  while (index < limit && isHex(source[index] ?? "")) index += 1;
  if (isWhitespace(source[index] ?? "")) index += source.startsWith("\r\n", index) ? 2 : 1;
  return index;
};

const startsIdent = (source: string, at: number) => {
  const char = source[at] ?? "";
  if (isNameStart(char) || isEscape(source, at)) return true;
  if (char !== "-") return false;
  const next = source[at + 1] ?? "";
  return next === "-" || isNameStart(next) || isEscape(source, at + 1);
};

const readName = (source: string, at: number) => {
  let index = at;
  while (index < source.length) {
    if (isEscape(source, index)) index = skipEscape(source, index);
    else if (isName(source[index]!)) index += 1;
    else break;
  }
  return index;
};

const single: Partial<Record<string, TokenType>> = {
  ":": "colon",
  ",": "comma",
  "[": "open-square",
  "]": "close-square",
  "(": "open-paren",
  ")": "close-paren",
};

/** Splits a selector into CSS tokens. Throws a `SelectorError` for an unclosed string or comment. */
export const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  const push = (type: TokenType, start: number, value = "") => {
    tokens.push({ type, text: source.slice(start, index), value, start, end: index });
  };
  while (index < source.length) {
    const start = index;
    const char = source[index]!;
    if (isWhitespace(char)) {
      while (isWhitespace(source[index] ?? "")) index += 1;
      push("whitespace", start);
    } else if (source.startsWith("/*", index)) {
      const close = source.indexOf("*/", index + 2);
      if (close === -1) throw new SelectorError("unclosed", start, "/*");
      index = close + 2;
      push("comment", start);
    } else if (char === '"' || char === "'") {
      index += 1;
      while (index < source.length && source[index] !== char) {
        if (source[index] === "\n") break;
        index += source[index] === "\\" ? 2 : 1;
      }
      if (source[index] !== char) throw new SelectorError("unclosed", start, char);
      index += 1;
      push("string", start);
    } else if (char === "#" && (isName(source[index + 1] ?? "") || isEscape(source, index + 1))) {
      index = readName(source, index + 1);
      push("hash", start, source.slice(start + 1, index).toLowerCase());
    } else if (single[char]) {
      index += 1;
      push(single[char], start);
    } else if (startsIdent(source, index)) {
      index = readName(source, index);
      const name = source.slice(start, index).toLowerCase();
      if (source[index] === "(") {
        index += 1;
        push("function", start, name);
      } else push("ident", start, name);
    } else if (
      isDigit(char) ||
      ((char === "+" || char === "-" || char === ".") &&
        (isDigit(source[index + 1] ?? "") || (source[index + 1] === "." && isDigit(source[index + 2] ?? ""))))
    ) {
      // Numbers only matter inside An+B (`2n+1`, `-n+3`), where `n` and what follows read as part of the number.
      index += 1;
      while (isDigit(source[index] ?? "") || source[index] === ".") index += 1;
      index = readName(source, index);
      push("number", start);
    } else {
      index += 1;
      push("delim", start, char);
    }
  }
  return tokens;
};

/** IDs, then classes, attributes and pseudo-classes, then types and pseudo-elements. */
export type Specificity = readonly [a: number, b: number, c: number];

export type Weight = "id" | "class" | "type";

/** How a stretch of the selector counts: towards a, b or c, not at all, or not at all because a sibling argument won. */
type PartKind = Weight | "zero" | "ignored" | "plain";

interface Part {
  text: string;
  kind: PartKind;
}

interface Contribution {
  text: string;
  weight: Weight;
  /** The functional pseudo-class (`:is()`, `:not()`…) the selector sits inside, if any. */
  via?: string;
}

export interface SelectorResult {
  /** The complex selector, trimmed. */
  selector: string;
  specificity: Specificity;
  /** The selector split into stretches that count the same way, covering every character. */
  parts: Part[];
  /** Every simple selector that adds to the specificity. */
  contributions: Contribution[];
}

type Simple =
  | { kind: "type"; from: number; to: number; universal: boolean }
  | { kind: "id" | "class" | "attribute" | "nesting"; from: number; to: number }
  | {
      kind: "pseudo-class" | "pseudo-element";
      name: string;
      from: number;
      to: number;
      /** Selectors inside the brackets, for the pseudo-classes whose arguments count. */
      args?: Complex[];
      /** Where the counted arguments start (after `of` for `:nth-child()`). */
      argsFrom?: number;
      /** Arguments a forgiving list dropped because they don't parse. */
      dropped?: [number, number][];
    };

interface Complex {
  from: number;
  to: number;
  items: Simple[];
}

/** Pseudo-elements that CSS 2 wrote with one colon, which still count as pseudo-elements. */
const legacyPseudoElements = new Set(["before", "after", "first-line", "first-letter"]);
/** Functional pseudo-classes that take the specificity of their most specific argument. */
const mostSpecific = new Set(["is", "not", "has"]);
const nthOf = new Set(["nth-child", "nth-last-child"]);
/** CSS Scoping: these add their compound-selector argument to their own weight. */
const compoundArgs = new Set(["host", "host-context", "slotted"]);

const combinatorDelims = new Set([">", "+", "~"]);

class Parser {
  index: number;

  constructor(
    readonly tokens: Token[],
    readonly source: string,
    start: number,
    readonly end: number,
  ) {
    this.index = start;
  }

  peek(offset = 0): Token | undefined {
    const at = this.index + offset;
    return at < this.end ? this.tokens[at] : undefined;
  }

  isDelim(token: Token | undefined, char: string) {
    return token?.type === "delim" && token.value === char;
  }

  skipSpace() {
    let skipped = false;
    while (this.peek()?.type === "whitespace" || this.peek()?.type === "comment") {
      this.index += 1;
      skipped = true;
    }
    return skipped;
  }

  /** The last token before the current one that isn't whitespace or a comment. */
  lastSignificant() {
    let at = this.index - 1;
    while (at >= 0 && ["whitespace", "comment"].includes(this.tokens[at]!.type)) at -= 1;
    return this.tokens[at];
  }

  fail(code: SelectorErrorCode, token = this.peek()): never {
    const at = token?.start ?? this.tokens[this.end - 1]?.end ?? this.source.length;
    throw new SelectorError(code, at, token?.text ?? "");
  }

  /** The end of the bracketed run that opened just before `this.index`. */
  matching(closer: "close-paren" | "close-square") {
    let depth = 0;
    for (let at = this.index; at < this.end; at += 1) {
      const { type } = this.tokens[at]!;
      if (type === "function" || type === "open-paren" || type === "open-square") depth += 1;
      else if ((type === "close-paren" || type === "close-square") && depth > 0) depth -= 1;
      else if (type === closer) return at;
      else if (type === "close-paren" || type === "close-square") this.fail("unexpected", this.tokens[at]);
    }
    return this.fail("unclosed", this.tokens[this.index - 1]);
  }

  /** `ns|`, `*|` or `|` before a type or attribute name. */
  namespacePrefix() {
    const first = this.peek();
    const bar = (offset: number) => this.isDelim(this.peek(offset), "|") && !this.isDelim(this.peek(offset + 1), "|");
    if (this.isDelim(first, "|") && !this.isDelim(this.peek(1), "|")) {
      this.index += 1;
      return true;
    }
    if ((first?.type === "ident" || this.isDelim(first, "*")) && bar(1)) {
      const name = this.peek(2);
      if (name?.type === "ident" || this.isDelim(name, "*")) {
        this.index += 2;
        return true;
      }
    }
    return false;
  }

  typeSelector(): Simple | undefined {
    const from = this.index;
    const token = this.peek();
    const startsType =
      token?.type === "ident" ||
      this.isDelim(token, "*") ||
      (this.isDelim(token, "|") && !this.isDelim(this.peek(1), "|"));
    if (!startsType) return undefined;
    this.namespacePrefix();
    const name = this.peek();
    if (name?.type !== "ident" && !this.isDelim(name, "*")) this.fail("unexpected", name);
    this.index += 1;
    return { kind: "type", from, to: this.index, universal: name!.type !== "ident" };
  }

  attribute(): Simple {
    const from = this.index;
    this.index += 1;
    const close = this.matching("close-square");
    const inner = new Parser(this.tokens, this.source, this.index, close);
    inner.skipSpace();
    inner.namespacePrefix();
    if (inner.peek()?.type !== "ident") inner.fail(inner.peek() ? "unexpected" : "empty", inner.peek());
    inner.index += 1;
    inner.skipSpace();
    if (inner.peek()) {
      const operator = inner.peek()!;
      if (inner.isDelim(operator, "=")) inner.index += 1;
      else if (
        operator.type === "delim" &&
        ["~", "|", "^", "$", "*"].includes(operator.value) &&
        inner.isDelim(inner.peek(1), "=")
      ) {
        inner.index += 2;
      } else inner.fail("unexpected", operator);
      inner.skipSpace();
      const value = inner.peek();
      if (value?.type !== "ident" && value?.type !== "string") inner.fail(value ? "unexpected" : "empty", value);
      inner.index += 1;
      inner.skipSpace();
      if (inner.peek()?.type === "ident" && /^[is]$/u.test(inner.peek()!.value)) {
        inner.index += 1;
        inner.skipSpace();
      }
      if (inner.peek()) inner.fail("unexpected");
    }
    this.index = close + 1;
    return { kind: "attribute", from, to: this.index };
  }

  pseudo(): Simple {
    const from = this.index;
    this.index += 1;
    let element = false;
    if (this.peek()?.type === "colon") {
      element = true;
      this.index += 1;
    }
    const name = this.peek();
    if (name?.type === "ident") {
      this.index += 1;
      const kind = element || legacyPseudoElements.has(name.value) ? "pseudo-element" : "pseudo-class";
      return { kind, name: name.value, from, to: this.index };
    }
    if (name?.type !== "function") return this.fail("unexpected", name);
    this.index += 1;
    const close = this.matching("close-paren");
    const args = this.functionArgs(name.value, element, close);
    this.index = close + 1;
    return { kind: element ? "pseudo-element" : "pseudo-class", name: name.value, from, to: this.index, ...args };
  }

  functionArgs(name: string, element: boolean, close: number): Partial<Extract<Simple, { args?: Complex[] }>> {
    const start = this.index;
    const inner = new Parser(this.tokens, this.source, start, close);
    inner.skipSpace();
    if (!element && name === "where") return {};
    if (!element && mostSpecific.has(name)) {
      return name === "is"
        ? { argsFrom: start, ...inner.forgivingList() }
        : { args: inner.list(name === "has"), argsFrom: start };
    }
    if (!element && nthOf.has(name)) {
      for (let at = start; at < close; at += 1) {
        const token = this.tokens[at]!;
        const before = this.tokens[at - 1];
        if (token.type === "ident" && token.value === "of" && before?.type === "whitespace") {
          if (at === start + 1) inner.fail("unexpected", token);
          const rest = new Parser(this.tokens, this.source, at + 1, close);
          rest.skipSpace();
          return { args: rest.list(false), argsFrom: at + 1 };
        }
      }
    }
    if (compoundArgs.has(name) && (element ? name === "slotted" : name !== "slotted")) {
      const complex = inner.complex(false);
      if (complex.combinators > 0) inner.fail("unexpected", this.tokens[complex.firstCombinator]);
      if (inner.peek()) inner.fail("unexpected");
      return { args: [complex], argsFrom: start };
    }
    if (!inner.peek()) inner.fail("empty", this.tokens[close]);
    return {};
  }

  /** A selector list where every selector must parse. */
  list(relative: boolean): Complex[] {
    const selectors: Complex[] = [];
    for (;;) {
      this.skipSpace();
      if (!this.peek() || this.peek()!.type === "comma") this.fail("empty", this.peek() ?? this.tokens[this.end]);
      selectors.push(this.complex(relative));
      if (!this.peek()) return selectors;
      this.index += 1; // the comma
    }
  }

  /** `:is()` drops the selectors in its list that don't parse instead of failing. */
  forgivingList(): { args: Complex[]; dropped: [number, number][] } {
    const args: Complex[] = [];
    const dropped: [number, number][] = [];
    while (this.index < this.end) {
      let depth = 0;
      let stop = this.index;
      while (stop < this.end) {
        const { type } = this.tokens[stop]!;
        if (type === "function" || type === "open-paren" || type === "open-square") depth += 1;
        else if (type === "close-paren" || type === "close-square") depth -= 1;
        else if (type === "comma" && depth === 0) break;
        stop += 1;
      }
      const part = new Parser(this.tokens, this.source, this.index, stop);
      part.skipSpace();
      if (part.peek()) {
        try {
          args.push(part.complex(false));
        } catch {
          dropped.push([this.index, stop]);
        }
      }
      this.index = stop + 1;
    }
    return { args, dropped };
  }

  compound(): Simple[] {
    const items: Simple[] = [];
    const type = this.typeSelector();
    if (type) items.push(type);
    for (;;) {
      const token = this.peek();
      if (token?.type === "hash") {
        // `#123` is a hash but not an ID: an ID has to be a valid identifier.
        if (!startsIdent(this.source, token.start + 1)) this.fail("unexpected", token);
        items.push({ kind: "id", from: this.index, to: this.index + 1 });
        this.index += 1;
      } else if (this.isDelim(token, ".")) {
        if (this.peek(1)?.type !== "ident") this.fail("unexpected", this.peek(1) ?? token);
        items.push({ kind: "class", from: this.index, to: this.index + 2 });
        this.index += 2;
      } else if (token?.type === "open-square") items.push(this.attribute());
      else if (token?.type === "colon") items.push(this.pseudo());
      else if (this.isDelim(token, "&")) {
        items.push({ kind: "nesting", from: this.index, to: this.index + 1 });
        this.index += 1;
      } else return items;
    }
  }

  /** Reads a combinator, if there is one, returning whether it found a non-descendant one. */
  combinator(): "explicit" | "descendant" | undefined {
    const spaced = this.skipSpace();
    const token = this.peek();
    const column = this.isDelim(token, "|") && this.isDelim(this.peek(1), "|");
    if ((token?.type === "delim" && combinatorDelims.has(token.value)) || column) {
      this.index += column ? 2 : 1;
      this.skipSpace();
      return "explicit";
    }
    return spaced && token && token.type !== "comma" ? "descendant" : undefined;
  }

  complex(relative: boolean): Complex & { combinators: number; firstCombinator: number } {
    const from = this.index;
    const items: Simple[] = [];
    let combinators = 0;
    let firstCombinator = -1;
    if (relative) {
      const at = this.index;
      if (this.combinator() === "explicit") {
        combinators += 1;
        firstCombinator = at;
      }
    }
    for (;;) {
      const compound = this.compound();
      if (compound.length === 0) {
        const token = this.peek();
        if (token && token.type !== "comma") this.fail("unexpected", token);
        this.fail(combinators > 0 ? "combinator" : "empty", this.lastSignificant());
      }
      items.push(...compound);
      const at = this.index;
      if (!this.combinator()) break;
      combinators += 1;
      if (firstCombinator === -1) firstCombinator = at;
    }
    let to = this.index;
    while (to > from && ["whitespace", "comment"].includes(this.tokens[to - 1]!.type)) to -= 1;
    if (this.peek() && this.peek()!.type !== "comma") this.fail("unexpected");
    return { from, to, items, combinators, firstCombinator };
  }
}

const add = (x: Specificity, y: Specificity): Specificity => [x[0] + y[0], x[1] + y[1], x[2] + y[2]];

/** Sorts higher specificity first: negative when `x` beats `y`. */
export const compareSpecificity = (x: Specificity, y: Specificity) => y[0] - x[0] || y[1] - x[1] || y[2] - x[2];

interface Measured {
  specificity: Specificity;
  /** How each token counts, by token index. */
  kinds: Map<number, PartKind>;
  contributions: Contribution[];
}

const zero: Specificity = [0, 0, 0];

const measure = (complex: Complex, tokens: Token[], source: string, via?: string): Measured => {
  const kinds = new Map<number, PartKind>();
  const contributions: Contribution[] = [];
  let specificity = zero;
  const mark = (from: number, to: number, kind: PartKind) => {
    for (let at = from; at < to; at += 1) kinds.set(at, kind);
  };
  const text = (from: number, to: number) => source.slice(tokens[from]!.start, tokens[to - 1]!.end);
  const count = (from: number, to: number, weight: Weight, label = text(from, to)) => {
    mark(from, to, weight);
    contributions.push({ text: label, weight, ...(via && { via }) });
    specificity = add(specificity, weight === "id" ? [1, 0, 0] : weight === "class" ? [0, 1, 0] : [0, 0, 1]);
  };
  /** Adds the most specific of `args`, marking the rest as ignored. */
  const strongest = (args: Complex[], name: string) => {
    let best: Measured | undefined;
    const measured = args.map((arg) => measure(arg, tokens, source, name));
    for (const item of measured) {
      if (!best || compareSpecificity(item.specificity, best.specificity) < 0) best = item;
    }
    for (const [i, item] of measured.entries()) {
      if (item === best) for (const [at, kind] of item.kinds) kinds.set(at, kind);
      else mark(args[i]!.from, args[i]!.to, "ignored");
    }
    if (best) {
      specificity = add(specificity, best.specificity);
      contributions.push(...best.contributions);
    }
  };

  for (const simple of complex.items) {
    const { from, to } = simple;
    switch (simple.kind) {
      case "id":
        count(from, to, "id");
        break;
      case "class":
      case "attribute":
        count(from, to, "class");
        break;
      case "type":
        if (simple.universal) mark(from, to, "zero");
        else count(from, to, "type");
        break;
      case "nesting":
        // Without a parent rule to take it from, `&` counts for nothing.
        mark(from, to, "zero");
        break;
      case "pseudo-element":
      case "pseudo-class": {
        const label = `${simple.kind === "pseudo-element" ? "::" : ":"}${simple.name}()`;
        if (simple.kind === "pseudo-class" && simple.name === "where") {
          mark(from, to, "zero");
        } else if (simple.kind === "pseudo-class" && mostSpecific.has(simple.name)) {
          mark(from, to, "plain");
          for (const [start, stop] of simple.dropped ?? []) mark(start, stop, "ignored");
          strongest(simple.args!, label);
        } else if (simple.args) {
          const weight = simple.kind === "pseudo-element" ? "type" : "class";
          // The pseudo-class itself, up to where its counted arguments start.
          const own = nthOf.has(simple.name)
            ? text(from, simple.argsFrom!)
                .trimEnd()
                .replace(/\s+of$/iu, " of …)")
            : label;
          count(from, to, weight, own);
          strongest(simple.args, label);
        } else {
          count(from, to, simple.kind === "pseudo-element" ? "type" : "class");
        }
        break;
      }
    }
  }
  return { specificity, kinds, contributions };
};

/** Parses a selector list into its complex selectors, each with its specificity and breakdown. */
export const analyseSelectorList = (source: string): SelectorResult[] => {
  const tokens = tokenize(source);
  const parser = new Parser(tokens, source, 0, tokens.length);
  const list = parser.list(false);
  return list.map((complex) => {
    const measured = measure(complex, tokens, source);
    const parts: Part[] = [];
    for (let at = complex.from; at < complex.to; at += 1) {
      const token = tokens[at]!;
      const kind = measured.kinds.get(at) ?? "plain";
      const last = parts.at(-1);
      if (last?.kind === kind) last.text += token.text;
      else parts.push({ text: token.text, kind });
    }
    return {
      selector: source.slice(tokens[complex.from]!.start, tokens[complex.to - 1]!.end),
      specificity: measured.specificity,
      parts,
      contributions: measured.contributions,
    };
  });
};

/** Just the specificity of each selector in a list. */
export const specificity = (selector: string) => analyseSelectorList(selector).map((result) => result.specificity);

export const formatSpecificity = ([a, b, c]: Specificity) => `(${a}, ${b}, ${c})`;

interface RankedSelector extends SelectorResult {
  /** 1-based line the selector came from. */
  line: number;
  /** Position in the input, counting every selector in every list. */
  order: number;
}

export interface LineError {
  line: number;
  code: SelectorErrorCode;
  /** 1-based column. */
  column: number;
  text: string;
}

export interface Ranking {
  /** Highest specificity first; on a tie the later selector, which wins the cascade, comes first. */
  ranked: RankedSelector[];
  errors: LineError[];
  /** Whether the winner only wins because it comes later. */
  tie: boolean;
}

/** Reads one selector (or selector list) per line and ranks them by specificity. */
export const rankSelectors = (input: string): Ranking => {
  const selectors: RankedSelector[] = [];
  const errors: LineError[] = [];
  for (const [index, text] of input.split(/\r?\n/u).entries()) {
    if (text.trim() === "") continue;
    try {
      for (const result of analyseSelectorList(text)) {
        selectors.push({ ...result, line: index + 1, order: selectors.length });
      }
    } catch (error) {
      if (!(error instanceof SelectorError)) throw error;
      errors.push({ line: index + 1, code: error.code, column: error.at + 1, text: error.text });
    }
  }
  const ranked = selectors.toSorted((x, y) => compareSpecificity(x.specificity, y.specificity) || y.order - x.order);
  const [first, second] = ranked;
  const tie = Boolean(first && second && compareSpecificity(first.specificity, second.specificity) === 0);
  return { ranked, errors, tie };
};
