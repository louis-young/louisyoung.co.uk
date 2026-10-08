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
