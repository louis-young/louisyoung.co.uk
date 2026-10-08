// The package root also exports a Node stream helper that breaks in browsers; the core function is pure.
import readingTime from "reading-time/lib/reading-time";

const fencedCode = /```[\s\S]*?```/gu;
const importsAndJsx = /^(?:import .*|<\/?[A-Z][^>]*>)$/gmu;

/**
 * Words, fenced code lines and reading time in whole minutes. Code is read more slowly than
 * prose, so each fenced code line counts as roughly a sentence rather than as words.
 */
export const readingStats = (body: string, wordsPerMinute = 230) => {
  const codeBlocks = body.match(fencedCode) ?? [];
  const codeLines = codeBlocks.reduce((total, block) => total + block.split("\n").length - 2, 0);
  const prose = body.replace(fencedCode, " ").replace(importsAndJsx, " ");
  const { words } = readingTime(prose, { wordsPerMinute });
  const minutes = (words + codeLines * 6) / wordsPerMinute;
  return { words, codeLines, codeBlocks: codeBlocks.length, minutes: Math.max(1, Math.round(minutes)) };
};

/** Reading time in whole minutes. See `readingStats`. */
export const estimateReadingTime = (body: string, wordsPerMinute = 230): number =>
  readingStats(body, wordsPerMinute).minutes;
