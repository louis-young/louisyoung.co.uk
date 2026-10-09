/**
 * A glob matcher for paths that follows picomatch and minimatch for the common cases: `*`, `?`,
 * `[...]` classes (with `!` or `^` to negate, ranges and POSIX classes), `{a,b}` and `{1..3}`
 * braces, `**` as a whole segment for any number of folders, and a leading `!` to negate.
 * Names that start with a dot are only matched by a wildcard when the `dot` option is on, and
 * never as `.` or `..`. Paths use forward slashes.
 */

export interface GlobOptions {
  /** Let wildcards match names that start with a dot. */
  dot?: boolean;
  /** Ignore case. */
  nocase?: boolean;
}

export type GlobPart =
  | { kind: "literal"; text: string }
  | { kind: "star" }
  | { kind: "qmark" }
  | { kind: "globstar" }
  | { kind: "class"; negated: boolean; text: string }
  | { kind: "braces"; alternatives: string[] };

export interface GlobSegment {
  /** The segment as written. */
  text: string;
  parts: GlobPart[];
  /** Whether a wildcard at the start of this segment skips names that start with a dot. */
  skipsHidden: boolean;
}

type GlobErrorCode = "empty" | "tooMany";

export type GlobResult =
  | {
      ok: true;
      regex: RegExp;
      /** True when the pattern starts with `!`: a path matches when the regex doesn't. */
      negated: boolean;
      /** The pattern with its braces expanded. */
      expanded: string[];
      segments: GlobSegment[];
    }
  | { ok: false; error: GlobErrorCode };

/** More than this many patterns after brace expansion is almost certainly a mistake. */
export const MAX_EXPANSIONS = 1000;

class TooManyError extends Error {}

const posixClasses: Record<string, string> = {
  alnum: "a-zA-Z0-9",
  alpha: "a-zA-Z",
  blank: " \\t",
  digit: "0-9",
  lower: "a-z",
  punct: "!-\\/:-@\\[-`{-~",
  space: " \\t\\r\\n\\v\\f",
  upper: "A-Z",
  word: "\\w",
  xdigit: "A-Fa-f0-9",
};

const escapeRegex = (text: string) => text.replace(/[$()*+.?[\\\]^{|}/]/gu, "\\$&");

/** Escapes a character for use inside a regex class, where `-` matters too. */
const escapeClass = (char: string) => (/[\\\]^[-]/u.test(char) ? `\\${char}` : char);

/** Finds the `]` that closes a class opened at `start`, or -1. A `]` straight after `[`, `[!` or `[^` is literal. */
const classEnd = (pattern: string, start: number) => {
  let index = start + 1;
  if (pattern[index] === "!" || pattern[index] === "^") index++;
  if (pattern[index] === "]") index++;
  while (index < pattern.length) {
    const char = pattern[index];
    if (char === "\\") index += 2;
    else if (char === "[" && pattern[index + 1] === ":") {
      const close = pattern.indexOf(":]", index + 2);
      index = close === -1 ? index + 1 : close + 2;
    } else if (char === "]") return index;
    else if (char === "/") return -1;
    else index++;
  }
  return -1;
};

/** Finds the `}` that closes braces opened at `start`, or -1, with the indices of its top-level commas. */
const braceEnd = (pattern: string, start: number) => {
  let depth = 0;
  const commas: number[] = [];
  for (let index = start; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === "\\") index++;
    else if (char === "[") {
      const end = classEnd(pattern, index);
      if (end !== -1) index = end;
    } else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return { end: index, commas };
    } else if (char === "," && depth === 1) commas.push(index);
  }
  return { end: -1, commas };
};

/** The values of a `{1..5}`, `{10..0..2}` or `{a..e}` range, or undefined if `body` isn't one. */
const rangeValues = (body: string) => {
  const numeric = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/u.exec(body);
  if (numeric) {
    const [from, to] = [Number(numeric[1]), Number(numeric[2])];
    const step = Math.abs(Number(numeric[3] ?? 1)) || 1;
    const width = /^-?0\d/u.test(numeric[1]!) || /^-?0\d/u.test(numeric[2]!) ? numeric[1]!.length : 0;
    const values: string[] = [];
    const direction = from <= to ? 1 : -1;
    for (let value = from; direction > 0 ? value <= to : value >= to; value += step * direction) {
      values.push(String(value).padStart(width, "0"));
      if (values.length > MAX_EXPANSIONS) throw new TooManyError();
    }
    return values;
  }
  const letters = /^([a-z])\.\.([a-z])$/iu.exec(body);
  if (!letters) return undefined;
  const [from, to] = [letters[1]!.charCodeAt(0), letters[2]!.charCodeAt(0)];
  const direction = from <= to ? 1 : -1;
  return Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => String.fromCharCode(from + i * direction));
};

/** The first expandable brace group in `pattern`: its span and alternatives. */
const firstBraces = (pattern: string) => {
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === "\\") {
      index++;
      continue;
    }
    if (char === "[") {
      const end = classEnd(pattern, index);
      if (end !== -1) index = end;
      continue;
    }
    if (char !== "{") continue;
    const { end, commas } = braceEnd(pattern, index);
    if (end === -1) return undefined;
    const body = pattern.slice(index + 1, end);
    const alternatives =
      commas.length > 0
        ? [index, ...commas].map((at, i) => pattern.slice(at + 1, [...commas, end][i]))
        : rangeValues(body);
    if (alternatives) return { start: index, end, alternatives };
  }
  return undefined;
};

/** Expands `{a,b}` and `{1..3}` braces, nested ones included, into a list of patterns. */
export const expandBraces = (pattern: string): string[] => {
  const braces = firstBraces(pattern);
  if (!braces) return [pattern];
  const before = pattern.slice(0, braces.start);
  const after = pattern.slice(braces.end + 1);
  const results: string[] = [];
  for (const alternative of braces.alternatives) {
    for (const expanded of expandBraces(before + alternative + after)) {
      results.push(expanded);
      if (results.length > MAX_EXPANSIONS) throw new TooManyError();
    }
  }
  return results;
};

/** Splits a pattern into segments on the slashes outside classes and braces, keeping braces whole. */
const tokenize = (pattern: string, keepBraces: boolean) => {
  const segments: { text: string; parts: GlobPart[] }[] = [];
  let parts: GlobPart[] = [];
  let start = 0;
  const literal = (text: string) => {
    const last = parts.at(-1);
    if (last?.kind === "literal") last.text += text;
    else parts.push({ kind: "literal", text });
  };
  let index = 0;
  const finish = (end: number) => {
    segments.push({ text: pattern.slice(start, end), parts });
    parts = [];
    start = end + 1;
  };
  while (index < pattern.length) {
    const char = pattern[index]!;
    if (char === "\\") {
      literal(pattern[index + 1] ?? "\\");
      index += 2;
    } else if (char === "/") {
      finish(index);
      index++;
    } else if (char === "*") {
      let end = index;
      while (pattern[end] === "*") end++;
      const atStart = index === start;
      const atEnd = end === pattern.length || pattern[end] === "/";
      parts.push({ kind: end - index >= 2 && atStart && atEnd ? "globstar" : "star" });
      index = end;
    } else if (char === "?") {
      parts.push({ kind: "qmark" });
      index++;
    } else if (char === "[" && classEnd(pattern, index) !== -1) {
      const end = classEnd(pattern, index);
      const negated = pattern[index + 1] === "!" || pattern[index + 1] === "^";
      parts.push({ kind: "class", negated, text: pattern.slice(index + (negated ? 2 : 1), end) });
      index = end + 1;
    } else if (char === "{" && keepBraces && firstBraces(pattern.slice(index))?.start === 0) {
      const braces = firstBraces(pattern.slice(index))!;
      parts.push({ kind: "braces", alternatives: braces.alternatives });
      index += braces.end + 1;
    } else {
      literal(char);
      index++;
    }
  }
  finish(pattern.length);
  return segments;
};

/** A regex character class for the body of a glob class. It never matches a slash. */
const classSource = (text: string, negated: boolean) => {
  let body = "";
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (char === "[" && text[index + 1] === ":") {
      const close = text.indexOf(":]", index + 2);
      if (close !== -1) {
        const name = posixClasses[text.slice(index + 2, close)];
        // Like minimatch, a class naming an unknown POSIX class matches nothing.
        if (name === undefined) return "(?!)";
        body += name;
        index = close + 1;
        continue;
      }
    }
    if (char === "\\" && index + 1 < text.length) {
      body += escapeClass(text[index + 1]!);
      index++;
    } else if (char === "-" && index > 0 && index < text.length - 1) body += "-";
    else body += escapeClass(char);
  }
  return negated ? `[^${body}/]` : `[${body}]`;
};

/** Does a segment start with a wildcard that could match a leading dot? A class has to say so. */
const startsWild = (parts: GlobPart[]) => {
  const first = parts[0];
  if (first === undefined || first.kind === "literal") return false;
  return first.kind !== "class" || first.negated;
};

const segmentSource = (parts: GlobPart[], dot: boolean) => {
  const wild = startsWild(parts);
  const hasWildcard = parts.some((part) => part.kind !== "literal");
  // A wildcard can't start a hidden name unless `dot` is on, and a segment with a wildcard in it
  // never matches `.` or `..`, even one that starts with a literal dot like `.*`.
  const guard = wild && !dot ? String.raw`(?!\.)` : hasWildcard ? String.raw`(?!\.{1,2}(?:/|$))` : "";
  const onlyStars = parts.every((part) => part.kind === "star");
  return (
    guard +
    parts
      .map((part) => {
        switch (part.kind) {
          case "literal":
            return escapeRegex(part.text);
          case "star":
            return onlyStars ? "[^/]+" : "[^/]*";
          case "qmark":
            return "[^/]";
          case "class":
            return classSource(part.text, part.negated);
          default:
            return "";
        }
      })
      .join("")
  );
};

/** The regex source, without anchors, for one pattern that has no braces left in it. */
const patternSource = (pattern: string, dot: boolean) => {
  const any = dot ? String.raw`(?!\.{1,2}(?:/|$))[^/]+` : String.raw`(?!\.)[^/]+`;
  const segments = tokenize(pattern, false);
  const isGlobstar = (index: number) => segments[index]?.parts[0]?.kind === "globstar";
  let source = "";
  segments.forEach((segment, i) => {
    const last = i === segments.length - 1;
    if (isGlobstar(i)) {
      if (isGlobstar(i - 1)) return;
      if (i === 0 && last) source += `${any}(?:/${any})*/?`;
      else if (last) source += `(?:/${any})*/?`;
      else if (i === 0) source += `(?:${any}/)*`;
      else source += `/(?:${any}/)*`;
      return;
    }
    if (i > 0 && !isGlobstar(i - 1)) source += "/";
    source += segmentSource(segment.parts, dot);
  });
  // Like picomatch and minimatch, a trailing slash (as on a folder) doesn't stop a match.
  return pattern.endsWith("/") || isGlobstar(segments.length - 1) ? source : `${source}/?`;
};

/** Compiles a glob into a RegExp, and explains it segment by segment. */
export const compileGlob = (input: string, options: GlobOptions = {}): GlobResult => {
  let pattern = input.trim();
  let negated = false;
  while (pattern.startsWith("!")) {
    negated = !negated;
    pattern = pattern.slice(1);
  }
  if (pattern === "") return { ok: false, error: "empty" };
  let expanded: string[];
  try {
    expanded = expandBraces(pattern);
  } catch (error) {
    if (error instanceof TooManyError) return { ok: false, error: "tooMany" };
    throw error;
  }
  const dot = options.dot ?? false;
  const sources = [...new Set(expanded.map((item) => patternSource(item, dot)))];
  const body = sources.length === 1 ? sources[0]! : `(?:${sources.join("|")})`;
  const regex = new RegExp(`^${body}$`, options.nocase ? "iu" : "u");
  const segments = tokenize(pattern, true).map((segment) => ({
    ...segment,
    skipsHidden: !dot && startsWild(segment.parts),
  }));
  return { ok: true, regex, negated, expanded, segments };
};

interface PathMatch {
  path: string;
  matched: boolean;
}

/** Tests each non-empty line of `paths` against `pattern`. */
export const matchPaths = (pattern: string, paths: string, options: GlobOptions = {}) => {
  const result = compileGlob(pattern, options);
  const lines = paths
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (!result.ok) return { result, matches: [] as PathMatch[] };
  const matches = lines.map((path) => ({ path, matched: result.regex.test(path) !== result.negated }));
  return { result, matches };
};

/** Tests one path, for when there's no need for the explanation. */
export const isMatch = (path: string, pattern: string, options: GlobOptions = {}) => {
  const result = compileGlob(pattern, options);
  return result.ok && result.regex.test(path) !== result.negated;
};
