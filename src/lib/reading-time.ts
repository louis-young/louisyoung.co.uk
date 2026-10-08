import readingTime from "reading-time";

const fencedCode = /```[\s\S]*?```/gu;
const importsAndJsx = /^(?:import .*|<\/?[A-Z][^>]*>)$/gmu;

/**
 * Estimates reading time in whole minutes. Code is read more slowly than prose, so each
 * fenced code line counts as roughly a sentence rather than being ignored or counted as words.
 */
export const estimateReadingTime = (body: string, wordsPerMinute = 230): number => {
  const codeLines = (body.match(fencedCode) ?? []).reduce((total, block) => total + block.split("\n").length - 2, 0);
  const prose = body.replace(fencedCode, " ").replace(importsAndJsx, " ");
  const { words } = readingTime(prose, { wordsPerMinute });
  const minutes = (words + codeLines * 6) / wordsPerMinute;
  return Math.max(1, Math.round(minutes));
};
