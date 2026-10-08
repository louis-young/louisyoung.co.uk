/** A Semantic Versioning 2.0.0 version. Build metadata is kept but never affects order. */
export interface Version {
  major: number;
  minor: number;
  patch: number;
  prerelease: (string | number)[];
  build: string[];
}

const identifier = String.raw`(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)`;
const versionPattern = new RegExp(
  String.raw`^[v=]?\s*(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)` +
    String.raw`(?:-(${identifier}(?:\.${identifier})*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$`,
  "u",
);

/** Parses a strict semantic version, allowing a leading `v` or `=` as npm does. */
export const parseVersion = (text: string): Version | undefined => {
  const match = versionPattern.exec(text.trim());
  if (!match) return undefined;
  const [, major = "", minor = "", patch = "", prerelease, build] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease:
      prerelease === undefined ? [] : prerelease.split(".").map((id) => (/^\d+$/u.test(id) ? Number(id) : id)),
    build: build === undefined ? [] : build.split("."),
  };
};

export const formatVersion = (version: Version) =>
  `${version.major}.${version.minor}.${version.patch}` +
  (version.prerelease.length > 0 ? `-${version.prerelease.join(".")}` : "");

const compareIdentifiers = (a: string | number, b: string | number) => {
  if (typeof a === "number" && typeof b === "number") return Math.sign(a - b);
  // Numeric identifiers always have lower precedence than alphanumeric ones.
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;
  return a < b ? -1 : a > b ? 1 : 0;
};

/** Orders two versions by SemVer precedence: -1, 0 or 1. */
export const compareVersions = (a: Version, b: Version): number => {
  const core = Math.sign(a.major - b.major) || Math.sign(a.minor - b.minor) || Math.sign(a.patch - b.patch);
  if (core !== 0) return core;
  // A pre-release sorts before its release.
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    return Math.sign(b.prerelease.length - a.prerelease.length);
  }
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const left = a.prerelease[i];
    const right = b.prerelease[i];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    const order = compareIdentifiers(left, right);
    if (order !== 0) return order;
  }
  return 0;
};

type Operator = "<" | "<=" | ">" | ">=" | "=";

export interface Comparator {
  operator: Operator;
  version: Version;
}

/** Comparators that must all hold. A range is a list of these, any one of which may match. */
export type ComparatorSet = Comparator[];

export type RangeResult = { sets: ComparatorSet[] } | { error: "empty" } | { error: "syntax"; token: string };

/** A version with some parts left as wildcards: `1`, `1.2`, `1.x`, `*`. */
interface PartialVersion {
  major?: number;
  minor?: number;
  patch?: number;
  prerelease: (string | number)[];
}

const wildcard = /^[xX*]$/u;
const partialPattern = new RegExp(
  String.raw`^[v=]?(0|[1-9]\d*|[xX*])(?:\.(0|[1-9]\d*|[xX*])(?:\.(0|[1-9]\d*|[xX*])` +
    String.raw`(?:-(${identifier}(?:\.${identifier})*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?)?)?$`,
  "u",
);

const parsePartial = (text: string): PartialVersion | undefined => {
  const match = partialPattern.exec(text);
  if (!match) return undefined;
  const [, major = "", minor, patch, prerelease] = match;
  const number = (part: string | undefined) => (part === undefined || wildcard.test(part) ? undefined : Number(part));
  const [first, second, third] = [number(major), number(minor), number(patch)];
  // Anything after a wildcard is a wildcard too: `1.x.3` means `1.x`.
  if (first === undefined) return { prerelease: [] };
  if (second === undefined) return { major: first, prerelease: [] };
  if (third === undefined) return { major: first, minor: second, prerelease: [] };
  return {
    major: first,
    minor: second,
    patch: third,
    prerelease: prerelease === undefined ? [] : parseVersion(`0.0.0-${prerelease}`)!.prerelease,
  };
};

const version = (major: number, minor: number, patch: number, prerelease: (string | number)[] = []): Version => ({
  major,
  minor,
  patch,
  prerelease,
  build: [],
});

/**
 * The lowest pre-release of a version. `<2.0.0-0` excludes 2.0.0’s pre-releases as well as 2.0.0,
 * which is what “below 2” means.
 */
const floor = (major: number, minor: number, patch: number) => version(major, minor, patch, [0]);

const at = (operator: Operator, value: Version): Comparator => ({ operator, version: value });

/** The lowest version a partial allows. */
const lower = (partial: PartialVersion) =>
  version(partial.major ?? 0, partial.minor ?? 0, partial.patch ?? 0, partial.prerelease);

/** The first version above everything a partial covers, or undefined for `*` or a full version. */
const upper = ({ major, minor, patch }: PartialVersion) => {
  if (major === undefined || patch !== undefined) return undefined;
  return minor === undefined ? floor(major + 1, 0, 0) : floor(major, minor + 1, 0);
};

const isFull = (partial: PartialVersion) => partial.patch !== undefined;

const anyVersion = (): ComparatorSet => [at(">=", version(0, 0, 0))];
const noVersion = (): ComparatorSet => [at("<", floor(0, 0, 0))];

const xRange = (partial: PartialVersion): ComparatorSet => {
  if (partial.major === undefined) return anyVersion();
  if (isFull(partial)) return [at("=", lower(partial))];
  return [at(">=", lower(partial)), at("<", upper(partial)!)];
};

const tilde = (partial: PartialVersion): ComparatorSet => {
  const { major, minor } = partial;
  if (major === undefined) return anyVersion();
  if (minor === undefined) return [at(">=", lower(partial)), at("<", floor(major + 1, 0, 0))];
  return [at(">=", lower(partial)), at("<", floor(major, minor + 1, 0))];
};

const caret = (partial: PartialVersion): ComparatorSet => {
  const { major, minor, patch } = partial;
  if (major === undefined) return anyVersion();
  const from = at(">=", lower(partial));
  // The first non-zero part is the one that may not change.
  if (major > 0 || minor === undefined) return [from, at("<", floor(major + 1, 0, 0))];
  if (minor > 0 || patch === undefined) return [from, at("<", floor(0, minor + 1, 0))];
  return [from, at("<", floor(0, 0, patch + 1))];
};

const primitive = (operator: Operator, partial: PartialVersion): ComparatorSet => {
  const { major, minor } = partial;
  if (operator === "=") return xRange(partial);
  if (major === undefined) return operator === "<" || operator === ">" ? noVersion() : anyVersion();
  if (isFull(partial)) return [at(operator, lower(partial))];
  // A partial stands for every version it covers, so compare against its bounds.
  switch (operator) {
    case ">":
      return [at(">=", minor === undefined ? version(major + 1, 0, 0) : version(major, minor + 1, 0))];
    case ">=":
      return [at(">=", lower(partial))];
    case "<":
      return [at("<", floor(major, minor ?? 0, 0))];
    default:
      return [at("<", upper(partial)!)];
  }
};

const hyphen = (from: PartialVersion, to: PartialVersion): ComparatorSet => {
  const start = from.major === undefined ? [] : [at(">=", lower(from))];
  if (to.major === undefined) return start.length > 0 ? start : anyVersion();
  const end = isFull(to) ? at("<=", lower(to)) : at("<", upper(to)!);
  return [...start, end];
};

const simplePattern = /^(~>?|\^|[<>]=?|=)?(.*)$/u;

const parseSet = (text: string): ComparatorSet | { token: string } => {
  // Allow a space between an operator and its version, as npm does: `>= 1.2.3`.
  const tokens = text
    .trim()
    .replaceAll(/(~>?|\^|[<>]=?|=)\s+/gu, "$1")
    .split(/\s+/u)
    .filter(Boolean);
  if (tokens.length === 0) return anyVersion();
  const hyphenAt = tokens.indexOf("-");
  if (hyphenAt !== -1) {
    const [from = "", , to = ""] = tokens;
    const start = parsePartial(from);
    const end = parsePartial(to);
    if (tokens.length !== 3 || hyphenAt !== 1) return { token: text.trim() };
    if (!start) return { token: from };
    if (!end) return { token: to };
    return hyphen(start, end);
  }
  const set: ComparatorSet = [];
  for (const token of tokens) {
    const [, operator = "", rest = ""] = simplePattern.exec(token) ?? [];
    const partial = parsePartial(rest);
    if (!partial) return { token };
    if (operator.startsWith("~")) set.push(...tilde(partial));
    else if (operator === "^") set.push(...caret(partial));
    else if (operator === "") set.push(...xRange(partial));
    else set.push(...primitive(operator as Operator, partial));
  }
  return set;
};

/**
 * Parses an npm-style range: `^1.2.3`, `~1.2`, `1.x`, `1.2.3 - 2.3.4`, `>=1 <2` and any of those
 * joined with `||`. Every set is expanded into plain comparators.
 */
export const parseRange = (text: string): RangeResult => {
  if (text.trim() === "") return { error: "empty" };
  const sets: ComparatorSet[] = [];
  for (const part of text.split("||")) {
    const set = parseSet(part);
    if ("token" in set) return { error: "syntax", token: set.token };
    sets.push(set);
  }
  return { sets };
};

const holds = ({ operator, version: bound }: Comparator, value: Version) => {
  const order = compareVersions(value, bound);
  switch (operator) {
    case "<":
      return order < 0;
    case "<=":
      return order <= 0;
    case ">":
      return order > 0;
    case ">=":
      return order >= 0;
    default:
      return order === 0;
  }
};

const sameCore = (a: Version, b: Version) => a.major === b.major && a.minor === b.minor && a.patch === b.patch;

/**
 * Whether a version satisfies one of the sets. As in npm, a pre-release only matches when a
 * comparator in the same set names a pre-release of the same major.minor.patch, so `^1.2.3`
 * never pulls in `1.5.0-beta`.
 */
export const satisfies = (value: Version, sets: ComparatorSet[]) =>
  sets.some(
    (set) =>
      set.every((comparator) => holds(comparator, value)) &&
      (value.prerelease.length === 0 ||
        set.some(({ version: bound }) => bound.prerelease.length > 0 && sameCore(bound, value))),
  );

/** Whether a version would match if pre-releases weren’t held back, to explain why it doesn’t. */
const satisfiesIgnoringPrerelease = (value: Version, sets: ComparatorSet[]) =>
  sets.some((set) => set.every((comparator) => holds(comparator, value)));

/**
 * A bound as people write it. The `-0` on an upper bound such as `<2.0.0-0` only keeps 2.0.0’s
 * pre-releases out, which they already are unless the range names one, so it is left off.
 */
const displayVersion = (value: Version) =>
  value.prerelease.length === 1 && value.prerelease[0] === 0
    ? formatVersion({ ...value, prerelease: [] })
    : formatVersion(value);

/** A comparator as text, e.g. `>=1.2.3` or `<2.0.0`. */
const formatComparator = ({ operator, version: value }: Comparator) =>
  `${operator === "=" ? "" : operator}${displayVersion(value)}`;

/** The whole range with every shorthand expanded: `>=1.2.3 <2.0.0 || >=3.0.0 <4.0.0`. */
export const formatRange = (sets: ComparatorSet[]) =>
  sets.map((set) => set.map((comparator) => formatComparator(comparator)).join(" ")).join(" || ");

/** The sentence fragments a plain-English description is built from. */
export interface RangeMessages {
  /** `{version}` */
  ">=": string;
  /** `{version}` */
  ">": string;
  /** `{version}` */
  "<=": string;
  /** `{version}` */
  "<": string;
  /** `{version}` */
  "=": string;
  any: string;
  none: string;
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => values[name] ?? match);

/**
 * Describes a range in words: each set’s comparators joined with `and`, and the sets with `or`.
 * `>=0.0.0` alone reads as “any version”, and `<0.0.0-0` as “no version”.
 */
export const describeRange = (
  sets: ComparatorSet[],
  messages: RangeMessages,
  lists: { and: (items: string[]) => string; or: (items: string[]) => string },
) =>
  lists.or(
    sets.map((set) => {
      const [only] = set;
      if (set.length === 1 && only?.operator === ">=" && formatVersion(only.version) === "0.0.0") return messages.any;
      if (set.length === 1 && only?.operator === "<" && formatVersion(only.version) === "0.0.0-0") {
        return messages.none;
      }
      return lists.and(
        set.map(({ operator, version: value }) => fill(messages[operator], { version: displayVersion(value) })),
      );
    }),
  );

export interface VersionCheck {
  /** The line as typed, trimmed. */
  text: string;
  version?: Version;
  /** `match`, `prerelease` (would match but is a held-back pre-release), `miss` or `invalid`. */
  result: "match" | "prerelease" | "miss" | "invalid";
}

/** Checks each non-blank line against the range. */
export const checkVersions = (lines: string, sets: ComparatorSet[]): VersionCheck[] =>
  lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => {
      const value = parseVersion(text);
      if (!value) return { text, result: "invalid" };
      if (satisfies(value, sets)) return { text, version: value, result: "match" };
      if (satisfiesIgnoringPrerelease(value, sets)) return { text, version: value, result: "prerelease" };
      return { text, version: value, result: "miss" };
    });

/** The highest version that matches, if any. */
export const highestMatch = (checks: VersionCheck[]) =>
  checks
    .filter((check) => check.result === "match")
    .reduce<VersionCheck | undefined>(
      (best, check) => (best?.version && compareVersions(check.version!, best.version) <= 0 ? best : check),
      undefined,
    );
