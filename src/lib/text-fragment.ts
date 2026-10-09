/**
 * Text fragments (`#:~:text=`) link to a passage, not just a page: supporting browsers scroll to
 * and highlight it. https://wicg.github.io/scroll-to-text-fragment/
 */

/** The text around and inside a selection, as plain strings read from the page. */
export interface QuoteContext {
  /** Text of the selection's first block before the selection. */
  before: string;
  /** The selected text in its first block (all of it, when it stays in one block). */
  start: string;
  /** The selected text in its last block, when the selection spans several. */
  end?: string | undefined;
  /** Text of the selection's last block after the selection. */
  after: string;
}

/** Selections longer than this many words link by their first and last words instead. */
const maxExactWords = 8;
const edgeWords = 4;
const contextWords = 3;

const wordChar = /[\p{L}\p{N}_]/u;
const leadingWord = /^[\p{L}\p{N}_]+/u;
const trailingWord = /[\p{L}\p{N}_]+$/u;

const collapse = (text: string) => text.replace(/\s+/gu, " ").trim();
const words = (text: string) => collapse(text).split(" ").filter(Boolean);

/**
 * Percent-encodes one term of a text directive. `encodeURIComponent` already escapes `&` and
 * `,`, but `-` is also syntax (it marks a prefix or suffix), so it is escaped too.
 */
export const encodeTerm = (term: string) => encodeURIComponent(term).replaceAll("-", "%2D");

/**
 * Browsers only match whole words, so a selection that starts or ends mid-word is widened to
 * the word's edges, taking the rest of the word from the surrounding text.
 */
export const snapToWords = ({ before, start, end, after }: QuoteContext): QuoteContext => {
  let head = start;
  let tail = end ?? start;
  let prefix = before;
  let suffix = after;
  if (wordChar.test(head.at(0) ?? "")) {
    const partial = trailingWord.exec(prefix)?.[0] ?? "";
    prefix = prefix.slice(0, prefix.length - partial.length);
    head = partial + head;
    if (end === undefined) tail = head;
  }
  if (wordChar.test(tail.at(-1) ?? "")) {
    const partial = leadingWord.exec(suffix)?.[0] ?? "";
    suffix = suffix.slice(partial.length);
    tail += partial;
    if (end === undefined) head = tail;
  }
  return end === undefined
    ? { before: prefix, start: head, after: suffix }
    : { before: prefix, start: head, end: tail, after: suffix };
};

/**
 * Builds the value of a `text=` directive: `[prefix-,]textStart[,textEnd][,-suffix]`. Short
 * selections in one block are matched exactly; longer ones, or ones that cross blocks, by their
 * first and last few words. Up to three words either side disambiguate repeated phrases.
 * Returns an empty string when there is nothing to link to.
 */
export const textDirective = (context: QuoteContext): string => {
  const snapped = snapToWords(context);
  const head = words(snapped.start);
  const tail = snapped.end === undefined ? head : words(snapped.end);
  if (head.length === 0 || tail.length === 0) return "";

  const exact = snapped.end === undefined && head.length <= maxExactWords;
  const textStart = exact ? head : head.slice(0, edgeWords);
  const textEnd = exact ? [] : tail.slice(-edgeWords);
  const prefix = words(snapped.before).slice(-contextWords);
  const suffix = words(snapped.after).slice(0, contextWords);

  const term = (parts: string[]) => encodeTerm(parts.join(" "));
  return [
    prefix.length > 0 ? `${term(prefix)}-` : undefined,
    term(textStart),
    textEnd.length > 0 ? term(textEnd) : undefined,
    suffix.length > 0 ? `-${term(suffix)}` : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(",");
};

/** The page URL, without any fragment, pointing at the quoted passage. */
export const quoteUrl = (pageUrl: string, context: QuoteContext): string => {
  const url = new URL(pageUrl);
  url.hash = "";
  const directive = textDirective(context);
  return directive ? `${url.href}#:~:text=${directive}` : url.href;
};

/**
 * Formats a quote as a Markdown blockquote with an attribution line. Paragraph breaks in the
 * selection are kept; other whitespace is collapsed. Square brackets in the title are escaped
 * so the link survives.
 */
export const markdownQuote = (text: string, attribution: (link: string) => string, title: string, url: string) => {
  const paragraphs = text.split(/\n+/u).map(collapse).filter(Boolean);
  const link = `[${title.replace(/[[\]]/gu, (bracket) => `\\${bracket}`)}](${url})`;
  return [...paragraphs.map((paragraph) => `> ${paragraph}`), `> ${attribution(link)}`].join("\n>\n");
};
