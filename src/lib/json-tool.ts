export type Indent = "2" | "4" | "tab" | "minify";

export interface JsonError {
  /** `token`: an unexpected character; `end`: the input stops early; `depth`: too deeply nested to handle. */
  reason: "token" | "end" | "depth";
  line: number;
  column: number;
  /** The offending character, escaped so whitespace and control characters are visible. */
  token: string;
}

export type JsonResult = { output: string } | { error: JsonError };

class ScanError extends Error {
  constructor(readonly index: number) {
    super("Invalid JSON");
  }
}

const whitespace = new Set([" ", "\t", "\n", "\r"]);
const escapes = new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);
const hex = /^[0-9a-f]$/iu;
const number = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/uy;

/**
 * Walks the JSON grammar (RFC 8259) and throws a ScanError at the first character that breaks it.
 * Browsers word and locate JSON.parse errors differently (Safari gives no position at all), so the
 * tool finds the position itself.
 */
const scan = (text: string) => {
  let i = 0;
  const fail = (): never => {
    throw new ScanError(i);
  };
  const skip = () => {
    while (whitespace.has(text[i] ?? "")) i++;
  };
  const literal = (word: string) => {
    for (const character of word) {
      if (text[i] !== character) fail();
      i++;
    }
  };
  const string = () => {
    i++;
    for (;;) {
      const character = text[i] ?? fail();
      if (character === '"') break;
      if (character < " ") fail();
      if (character === "\\") {
        i++;
        const escape = text[i] ?? fail();
        if (escape === "u") {
          for (let digit = 0; digit < 4; digit++) {
            i++;
            if (!hex.test(text[i] ?? fail())) fail();
          }
        } else if (!escapes.has(escape)) fail();
      }
      i++;
    }
    i++;
  };
  const list = (close: string, item: () => void) => {
    i++;
    skip();
    if (text[i] === close) {
      i++;
      return;
    }
    for (;;) {
      item();
      skip();
      if (text[i] === ",") {
        i++;
        skip();
      } else if (text[i] === close) {
        i++;
        return;
      } else fail();
    }
  };
  const value = (): void => {
    skip();
    const character = text[i] ?? fail();
    if (character === "{") {
      list("}", () => {
        if (text[i] !== '"') fail();
        string();
        skip();
        if (text[i] !== ":") fail();
        i++;
        value();
      });
    } else if (character === "[") list("]", value);
    else if (character === '"') string();
    else if (character === "t") literal("true");
    else if (character === "f") literal("false");
    else if (character === "n") literal("null");
    else {
      number.lastIndex = i;
      if (!number.test(text)) fail();
      i = number.lastIndex;
    }
  };
  value();
  skip();
  if (i < text.length) fail();
};

/** 1-based line and column of a UTF-16 offset. */
export const locate = (text: string, index: number) => {
  const before = text.slice(0, index);
  const lineStart = before.lastIndexOf("\n") + 1;
  return { line: before.split("\n").length, column: index - lineStart + 1 };
};

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== "object") return value;
  // fromEntries defines properties, so a "__proto__" key stays an ordinary key.
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => [key, sortKeys(item)]),
  );
};

const indents: Record<Indent, string | number> = { "2": 2, "4": 4, tab: "\t", minify: 0 };

const failure = (input: string, error: unknown): { error: JsonError } => {
  const index = error instanceof ScanError ? error.index : 0;
  const reason = error instanceof ScanError ? (index >= input.length ? "end" : "token") : "depth";
  const token = reason === "token" ? JSON.stringify(input[index]).slice(1, -1) : "";
  return { error: { reason, token, ...locate(input, index) } };
};

/** Checks the grammar first so a mistake gets a position, then lets the engine build the value. */
const parse = (input: string) => {
  scan(input);
  return JSON.parse(input) as unknown;
};

/** Parses JSON, or explains where it first goes wrong. */
export const parseJson = (input: string): { value: unknown } | { error: JsonError } => {
  try {
    return { value: parse(input) };
  } catch (error) {
    return failure(input, error);
  }
};

/** Validates JSON and re-serialises it with the chosen indent, optionally sorting object keys. */
export const formatJson = (input: string, options: { indent: Indent; sort: boolean }): JsonResult => {
  if (input.trim() === "") return { output: "" };
  try {
    const value = parse(input);
    return { output: JSON.stringify(options.sort ? sortKeys(value) : value, null, indents[options.indent]) };
  } catch (error) {
    return failure(input, error);
  }
};
