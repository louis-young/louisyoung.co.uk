import type { QuickAnswerMessages } from "./quick-answers";

export interface Command {
  id: string;
  title: string;
  group: string;
  /** Extra words that should match, e.g. tags or a summary. */
  keywords?: string;
}

const normalise = (value: string) => value.normalize("NFKD").replace(/[̀-ͯ]/gu, "").toLowerCase();

/**
 * Scores how well a query matches a command. Higher is better; 0 means no match.
 * Prefix and word-start matches beat substrings, which beat in-order fuzzy matches.
 */
export const scoreCommand = (command: Pick<Command, "title" | "keywords">, query: string) => {
  const needle = normalise(query.trim());
  if (!needle) return 1;
  const title = normalise(command.title);
  const keywords = normalise(command.keywords ?? "");
  if (title.startsWith(needle)) return 100;
  if (title.split(/\s+/u).some((word) => word.startsWith(needle))) return 80;
  if (title.includes(needle)) return 60;
  if (keywords.includes(needle)) return 40;
  let position = 0;
  for (const character of needle.replaceAll(" ", "")) {
    position = title.indexOf(character, position);
    if (position === -1) return 0;
    position += 1;
  }
  return 20;
};

/** Filters and ranks commands for a query, keeping the original order within a score. */
export const rankCommands = <T extends Pick<Command, "title" | "keywords">>(commands: readonly T[], query: string) =>
  commands
    .map((command, index) => ({ command, index, score: scoreCommand(command, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ command }) => command);

/** Moves an active index up or down a list, wrapping at both ends. */
export const moveIndex = (current: number, delta: number, length: number) =>
  length === 0 ? -1 : (((current + delta) % length) + length) % length;

/**
 * Resolves a palette link to a same-origin path, or `undefined` for anything else
 * (another origin, `javascript:` and so on), so option data can never navigate off-site.
 */
export const sameOriginPath = (href: string, origin: string) => {
  try {
    const url = new URL(href, origin);
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : undefined;
  } catch {
    return undefined;
  }
};

/** One palette option, as the build writes it to the palette index. */
export interface PaletteOptionData {
  title: string;
  href?: string;
  /** A built-in action: `search`, `copy`, `download`, `theme`, `terminal` or `shortcuts`. */
  action?: string;
  /** What `copy` copies. */
  value?: string;
  /** Announced once the action is done. */
  done?: string;
  /** A short visual hint, such as a path or a key. */
  hint?: string;
  keywords?: string;
}

/** Translated strings the palette only needs once its index has loaded. */
export const paletteTextKeys = [
  "answer",
  "answerName",
  "answerCopy",
  "answerCopied",
  "answerCopyFailed",
  "answerOpen",
  "answerSwatch",
] as const;

/**
 * Everything the palette lists, fetched from `/palette.json` the first time it's warmed rather than
 * written into every page. Group labels stay in the page, so groups are matched by `id`.
 */
export interface PaletteIndex {
  groups: { id: string; options: PaletteOptionData[] }[];
  text: Record<(typeof paletteTextKeys)[number], string>;
  answers: QuickAnswerMessages;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStrings = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === "string");

const optionKeys = new Set(["title", "href", "action", "value", "done", "hint", "keywords"]);

const isOption = (value: unknown): value is PaletteOptionData =>
  isStrings(value) && typeof value["title"] === "string" && Object.keys(value).every((key) => optionKeys.has(key));

/**
 * Checks a fetched palette index has the shape the palette renders, so a truncated or stale
 * response shows the error state instead of a half-built list. Returns undefined otherwise.
 */
export const parsePaletteIndex = (value: unknown): PaletteIndex | undefined => {
  if (!isRecord(value) || !Array.isArray(value["groups"])) return undefined;
  const groupsValid = value["groups"].every(
    (group: unknown) =>
      isRecord(group) &&
      typeof group["id"] === "string" &&
      Array.isArray(group["options"]) &&
      group["options"].every(isOption),
  );
  const { text, answers } = value;
  if (!groupsValid || !isStrings(text) || !paletteTextKeys.every((key) => key in text)) return undefined;
  const answersValid =
    isRecord(answers) &&
    isStrings(answers["cron"]) &&
    Object.entries(answers).every(([key, item]) => key === "cron" || typeof item === "string");
  if (!answersValid) return undefined;
  return value as unknown as PaletteIndex;
};
