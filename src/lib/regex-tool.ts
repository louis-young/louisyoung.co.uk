interface RegexGroup {
  /** 1-based capture group number. */
  number: number;
  name: string | undefined;
  /** Undefined when the group did not take part in the match. */
  value: string | undefined;
}

export interface RegexMatch {
  index: number;
  text: string;
  groups: RegexGroup[];
}

export type RegexResult = { error: string } | { matches: RegexMatch[]; truncated: boolean };

export interface Segment {
  text: string;
  /** Index into the matches list, when this segment is a match. */
  match?: number;
}

/** The highest number of matches the tester collects, so a pattern like /x*?/g on a novel stays responsive. */
export const matchLimit = 1000;

/**
 * Names of the capturing groups in order, undefined for unnamed groups. Only called on patterns that
 * already compiled, so it can skip escapes and character classes without validating them.
 */
export const groupNames = (pattern: string): (string | undefined)[] => {
  const names: (string | undefined)[] = [];
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const character = pattern[i];
    if (character === "\\") i++;
    else if (inClass) inClass = character !== "]";
    else if (character === "[") inClass = true;
    else if (character === "(") {
      if (pattern[i + 1] !== "?") names.push(undefined);
      else if (pattern[i + 2] === "<" && pattern[i + 3] !== "=" && pattern[i + 3] !== "!") {
        names.push(pattern.slice(i + 3, pattern.indexOf(">", i)));
      }
    }
  }
  return names;
};

/** Runs a pattern over text, collecting at most `limit` matches and never looping on empty matches. */
export const runRegex = (pattern: string, flags: string, text: string, limit = matchLimit): RegexResult => {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch (error) {
    return { error: (error as Error).message };
  }
  const names = groupNames(pattern);
  const repeat = regex.global || regex.sticky;
  const matches: RegexMatch[] = [];
  let truncated = false;
  for (let found = regex.exec(text); found; found = repeat ? regex.exec(text) : null) {
    if (matches.length === limit) {
      truncated = true;
      break;
    }
    matches.push({
      index: found.index,
      text: found[0],
      groups: names.map((name, i) => ({ number: i + 1, name, value: found[i + 1] })),
    });
    if (found[0] === "") {
      // Step past an empty match, by a whole code point in Unicode mode, or exec would find it forever.
      const point = regex.unicode ? (text.codePointAt(regex.lastIndex) ?? 0) : 0;
      regex.lastIndex += point > 0xffff ? 2 : 1;
    }
  }
  return { matches, truncated };
};

/** Splits text into plain and matched runs for highlighting. Empty matches produce no segment. */
export const segments = (text: string, matches: RegexMatch[]): Segment[] => {
  const result: Segment[] = [];
  let cursor = 0;
  matches.forEach((match, i) => {
    if (match.text === "") return;
    if (match.index > cursor) result.push({ text: text.slice(cursor, match.index) });
    result.push({ text: match.text, match: i });
    cursor = match.index + match.text.length;
  });
  if (cursor < text.length) result.push({ text: text.slice(cursor) });
  return result;
};
