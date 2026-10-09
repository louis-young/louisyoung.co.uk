type TokenType =
  | "space"
  | "line-comment"
  | "block-comment"
  | "string"
  | "quoted"
  | "number"
  | "word"
  | "operator"
  | "open"
  | "close"
  | "comma"
  | "semicolon"
  | "dot"
  | "other";

export interface Token {
  type: TokenType;
  text: string;
  /** False for a string, quoted name or comment that runs to the end of the input. */
  closed: boolean;
}

export type KeywordCase = "upper" | "lower" | "preserve";
export type SqlIndent = "2" | "4" | "tab";

export interface SqlOptions {
  keywordCase: KeywordCase;
  indent: SqlIndent;
  minify: boolean;
}

export interface SqlResult {
  output: string;
  statements: number;
  /** A string, quoted name or comment never closes, so everything after it is left as typed. */
  unterminated: boolean;
  /** Formatting would have changed a token, so the input is returned untouched. Never expected. */
  unchanged: boolean;
}

const spaceChars = /[ \t\n\r\f\v]+/y;
const numberPattern = /0x[0-9a-f]+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/iy;
const wordPattern = /(?:[\p{L}_]|@+(?=[\p{L}\p{N}_]))[\p{L}\p{N}\p{M}_$]*/uy;
const dollarTag = /\$(?:[A-Za-z_]\w*)?\$/y;
const parameter = /\$\d+/y;
const operatorChars = "+-*/<>=~!@%^&|?:";
/** A one-letter prefix that makes `'…'` a special string: E'…' (escapes), N'…', X'…', B'…', R'…'. */
const stringPrefix = /(?:[EeNnXxBbRr]|[Uu]&)'/y;

const sticky = (pattern: RegExp, text: string, index: number) => {
  pattern.lastIndex = index;
  return pattern.exec(text)?.[0];
};

/**
 * Splits SQL into tokens. Anything that could be a string, quoted name or comment is read as one
 * as greedily as possible, because those are copied out unchanged: if it runs to the end of the
 * input, the rest is copied unchanged too. With `backslashes`, `\'` escapes a quote (MySQL);
 * otherwise only a doubled quote does (standard SQL).
 */
export const tokenize = (sql: string, backslashes = false): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  const push = (type: TokenType, end: number, closed = true) => {
    tokens.push({ type, text: sql.slice(i, end), closed });
    i = end;
  };
  /** Finds the end of a quoted run starting at `start`, which is just past the opening quote. */
  const quoted = (start: number, close: string, escapes: boolean) => {
    let j = start;
    while (j < sql.length) {
      const character = sql[j];
      if (escapes && character === "\\") j += 2;
      else if (character === close) {
        if (sql[j + 1] !== close) return { end: j + 1, closed: true };
        j += 2;
      } else j++;
    }
    return { end: sql.length, closed: false };
  };
  const lineEnd = (start: number) => {
    const end = sql.slice(start).search(/[\r\n]/u);
    return end === -1 ? sql.length : start + end;
  };
  const previous = () => tokens.findLast((token) => token.type !== "space");

  while (i < sql.length) {
    const character = sql[i]!;
    const two = sql.slice(i, i + 2);
    const space = sticky(spaceChars, sql, i);
    if (space) {
      push("space", i + space.length);
      continue;
    }
    if (two === "--" || character === "#") {
      push("line-comment", lineEnd(i));
      continue;
    }
    if (two === "/*") {
      // Nested comments (PostgreSQL) are read as nested: being greedy only ever copies more verbatim.
      let depth = 0;
      let j = i;
      while (j < sql.length) {
        const pair = sql.slice(j, j + 2);
        if (pair === "/*") {
          depth++;
          j += 2;
        } else if (pair === "*/") {
          depth--;
          j += 2;
          if (depth === 0) break;
        } else j++;
      }
      push("block-comment", j, depth === 0);
      continue;
    }
    const prefix = sticky(stringPrefix, sql, i);
    if (prefix || character === "'") {
      const start = i + (prefix?.length ?? 1);
      const escapes = backslashes || /^e/iu.test(prefix ?? "");
      const { end, closed } = quoted(start, "'", escapes);
      push("string", end, closed);
      continue;
    }
    if (character === '"' || character === "`" || character === "[") {
      const close = character === "[" ? "]" : character;
      const { end, closed } = quoted(i + 1, close, backslashes && character === '"');
      push("quoted", end, closed);
      continue;
    }
    const tag = sticky(dollarTag, sql, i);
    if (tag) {
      const close = sql.indexOf(tag, i + tag.length);
      if (close === -1) push("string", sql.length, false);
      else push("string", close + tag.length);
      continue;
    }
    const param = sticky(parameter, sql, i);
    if (param) {
      push("word", i + param.length);
      continue;
    }
    const before = previous()?.type;
    const afterName = before === "word" || before === "quoted" || before === "close";
    const number = character === "." && afterName ? undefined : sticky(numberPattern, sql, i);
    if (number) {
      push("number", i + number.length);
      continue;
    }
    const word = sticky(wordPattern, sql, i);
    if (word) {
      push("word", i + word.length);
      continue;
    }
    if (operatorChars.includes(character)) {
      let j = i;
      while (j < sql.length && operatorChars.includes(sql[j]!) && !["--", "/*"].includes(sql.slice(j, j + 2))) j++;
      // As PostgreSQL reads them: `=-1` is `=` then `-1`, but `<->` and `@-@` stay whole.
      while (j - i > 1 && "+-".includes(sql[j - 1]!) && !/[~!@%^&|?]/u.test(sql.slice(i, j))) j--;
      push("operator", j);
      continue;
    }
    const single: Record<string, TokenType> = { "(": "open", ")": "close", ",": "comma", ";": "semicolon", ".": "dot" };
    push(single[character] ?? "other", i + String.fromCodePoint(sql.codePointAt(i)!).length);
  }
  return tokens;
};

const isUnclosed = (tokens: Token[]) => tokens.some((token) => !token.closed);

/**
 * Whether `\'` escapes a quote. Standard SQL is assumed unless reading it that way leaves a string
 * open and reading backslashes as escapes (MySQL) closes everything.
 */
export const usesBackslashes = (sql: string) =>
  sql.includes("\\") && isUnclosed(tokenize(sql)) && !isUnclosed(tokenize(sql, true));

/** Reserved in every major dialect, so their case can change without renaming anything. */
const reserved = new Set(
  (
    "ALL AND AS ASC BETWEEN BY CASE CHECK CONSTRAINT CREATE CROSS DEFAULT DELETE DESC DISTINCT DROP ELSE " +
    "EXCEPT EXISTS FALSE FOREIGN FROM GROUP HAVING IN INDEX INNER INSERT INTERSECT INTO IS JOIN KEY LEFT LIKE " +
    "LIMIT NATURAL NOT NULL ON OR ORDER OUTER OVER PARTITION PRIMARY RECURSIVE REFERENCES RIGHT SELECT SET " +
    "TABLE THEN TRUE UNION UNIQUE UPDATE USING VALUES WHEN WHERE WINDOW WITH ALTER"
  ).split(" "),
);
/** Keywords only in the right place: elsewhere they can be names (`end`, `offset`, `returning`). */
const contextual = new Set(["END", "OFFSET", "RETURNING", "FULL", "ILIKE"]);
const joinWords = new Set(["INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "NATURAL"]);
const operandKeywords = new Set(["NULL", "TRUE", "FALSE", "END"]);
const spacedOperators = new Set(["=", "<>", "!=", "<", ">", "<=", ">=", "+", "-", "*", "/", "%", "||"]);
/** Words that carry on a clause keyword on the same line: GROUP BY, INSERT INTO, UNION ALL. */
const continuations: Record<string, string[]> = {
  GROUP: ["BY"],
  ORDER: ["BY"],
  INSERT: ["INTO"],
  DELETE: ["FROM"],
  SELECT: ["DISTINCT", "ALL"],
  UNION: ["ALL", "DISTINCT"],
  INTERSECT: ["ALL", "DISTINCT"],
  EXCEPT: ["ALL", "DISTINCT"],
  WITH: ["RECURSIVE"],
};
const setOperators = new Set(["UNION", "INTERSECT", "EXCEPT"]);
const blockStarters = new Set(["SELECT", "WITH", "VALUES"]);
const selfDelimiting = new Set<TokenType>(["open", "close", "comma", "semicolon"]);

interface Item extends Token {
  /** The whitespace before this token in the input: none, spaces, or a line break. */
  gap: "" | " " | "\n";
}

interface CaseFrame {
  indent: number;
  inline: number;
  multiline: boolean;
}

interface Block {
  /** Indent of clause keywords. */
  base: number;
  /** Indent of the line the block’s `(` is on, where its `)` goes. */
  closeIndent: number;
  clause: string;
  kind: string;
  /** Depth of ordinary parentheses (function calls, lists) inside this block. */
  inline: number;
  cases: CaseFrame[];
  /** Paren depths with a BETWEEN waiting for its AND. */
  between: number[];
  /** Nothing has been written in this block yet. */
  fresh: boolean;
}

const newBlock = (base: number, closeIndent: number): Block => ({
  base,
  closeIndent,
  clause: "",
  kind: "",
  inline: 0,
  cases: [],
  between: [],
  fresh: true,
});

const indentUnits: Record<SqlIndent, string> = { "2": "  ", "4": "    ", tab: "\t" };

const sameTokens = (a: Token[], b: Token[]) => {
  const significant = (tokens: Token[]) => tokens.filter((token) => token.type !== "space");
  const left = significant(a);
  const right = significant(b);
  return (
    left.length === right.length &&
    left.every((token, i) => {
      const other = right[i]!;
      if (token.type !== other.type) return false;
      if (token.text === other.text) return true;
      const upper = token.text.toUpperCase();
      return (
        token.type === "word" && upper === other.text.toUpperCase() && (reserved.has(upper) || contextual.has(upper))
      );
    })
  );
};

/** Formats SQL read one way: with or without backslash escapes. */
const formatReading = (sql: string, options: SqlOptions, backslashes: boolean) => {
  const tokens = tokenize(sql, backslashes);
  const items: Item[] = [];
  let gap: Item["gap"] = "";
  for (const token of tokens) {
    if (token.type === "space") gap = token.text.includes("\n") || token.text.includes("\r") ? "\n" : " ";
    else {
      items.push({ ...token, gap });
      gap = "";
    }
  }
  const unit = indentUnits[options.indent];
  const pad = (level: number) => unit.repeat(Math.max(0, level));

  const upperAt = (i: number) => (items[i]?.type === "word" ? items[i].text.toUpperCase() : "");
  const isComment = (item: Item | undefined) => item?.type === "line-comment" || item?.type === "block-comment";
  const nextCode = (i: number) => {
    let j = i + 1;
    while (isComment(items[j])) j++;
    return j;
  };
  const previousCode = (i: number) => {
    let j = i - 1;
    while (isComment(items[j])) j--;
    return j;
  };
  /** A word on its own line, such as SQL Server’s `GO` batch separator. */
  const isBatchSeparator = (i: number) =>
    upperAt(i) === "GO" &&
    (i === 0 || items[i]!.gap === "\n") &&
    (i === items.length - 1 || items[i + 1]!.gap === "\n");

  let blocks = [newBlock(0, 0)];
  const block = () => blocks.at(-1)!;
  let output = "";
  let lineIndent = 0;
  let pending: number | undefined;
  let statements = 0;
  let statementOpen = false;
  /** The keyword each item was read as, so later decisions agree with earlier ones. */
  const keywords: string[] = [];

  const isOperand = (j: number) => {
    const item = items[j];
    if (!item) return false;
    if (item.type === "word") return !keywords[j] || operandKeywords.has(keywords[j]);
    return ["number", "string", "quoted", "close"].includes(item.type);
  };
  const isBinary = (j: number) =>
    items[j]?.type === "operator" && spacedOperators.has(items[j].text) && isOperand(previousCode(j));

  const keywordAt = (i: number): string => {
    const upper = upperAt(i);
    if (!upper || (!reserved.has(upper) && !contextual.has(upper))) return "";
    if (items[previousCode(i)]?.type === "dot" || items[nextCode(i)]?.type === "dot") return "";
    const current = block();
    switch (upper) {
      case "END":
        return current.cases.length > 0 ? upper : "";
      case "OFFSET":
        return ["LIMIT", "ORDER"].includes(current.clause) ? upper : "";
      case "RETURNING":
        return ["INSERT", "UPDATE", "DELETE"].includes(current.kind) ? upper : "";
      case "FULL":
        return ["JOIN", "OUTER"].includes(upperAt(nextCode(i))) ? upper : "";
      case "ILIKE":
        return isOperand(previousCode(i)) ? upper : "";
      default:
        return upper;
    }
  };

  const atStatementStart = (i: number) => {
    const p = previousCode(i);
    const current = block();
    if (p < 0 || current.fresh) return true;
    const item = items[p]!;
    return (
      item.type === "semicolon" ||
      isBatchSeparator(p) ||
      (item.type === "close" && current.clause === "WITH" && current.inline === 0)
    );
  };

  const startsClause = (i: number, word: string) => {
    const next = nextCode(i);
    const before = keywords[previousCode(i)] ?? "";
    switch (word) {
      case "SELECT":
      case "WHERE":
      case "HAVING":
      case "LIMIT":
      case "VALUES":
      case "UNION":
      case "INTERSECT":
      case "OFFSET":
      case "RETURNING":
        return true;
      case "FROM":
        return before !== "DISTINCT";
      case "GROUP":
      case "ORDER":
        return upperAt(next) === "BY";
      case "EXCEPT":
        return items[next]?.type !== "open" || blockStarters.has(upperAt(nextCode(next)));
      case "INSERT":
      case "UPDATE":
      case "DELETE":
      case "WITH":
        return atStatementStart(i);
      case "SET":
        return atStatementStart(i) || before === "UPDATE" || block().clause === "UPDATE";
      default:
        return false;
    }
  };

  const startsJoin = (i: number, word: string) => {
    if (word === "JOIN") return !joinWords.has(keywords[previousCode(i)] ?? "");
    if (!joinWords.has(word) || joinWords.has(keywords[previousCode(i)] ?? "")) return false;
    let j = nextCode(i);
    while (joinWords.has(upperAt(j))) j = nextCode(j);
    return upperAt(j) === "JOIN";
  };

  /** Whether removing the whitespace between two tokens keeps them as the same two tokens. */
  const canJoin = (a: Item, b: Item) => {
    const joined = tokenize(a.text + b.text, backslashes);
    return joined.length === 2 && joined[0]!.text === a.text && joined[1]!.text === b.text;
  };
  const tight = (a: Item, b: Item) => (b.gap === "" || canJoin(a, b) ? "" : " ");

  const inlineGap = (i: number) => {
    const item = items[i]!;
    const previous = items[i - 1]!;
    if (options.minify) {
      if (item.gap === "") return "";
      const canTighten =
        selfDelimiting.has(item.type) || selfDelimiting.has(previous.type) || isBinary(i) || isBinary(i - 1);
      return canTighten ? tight(previous, item) : " ";
    }
    if (item.type === "comma" || item.type === "semicolon" || item.type === "close" || previous.type === "open") {
      return tight(previous, item);
    }
    if (isBinary(i) || isBinary(i - 1) || previous.type === "comma") return " ";
    return item.gap === "" ? "" : " ";
  };

  const keywordText = (item: Item, keyword: string) => {
    if (!keyword || options.keywordCase === "preserve") return item.text;
    return options.keywordCase === "upper" ? item.text.toUpperCase() : item.text.toLowerCase();
  };

  let previousKeyword = "";
  let commaLeads = false;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const previous = items[i - 1];
    const current = block();
    const comment = isComment(item);
    const keyword = comment ? "" : keywordAt(i);
    keywords[i] = keyword;
    const top = current.cases.at(-1);
    const structural = current.inline === 0 && current.cases.length === 0;
    const continues = Boolean(keyword) && (continuations[previousKeyword]?.includes(keyword) ?? false);
    const clause = !continues && Boolean(keyword) && structural && startsClause(i, keyword);
    const batch = isBatchSeparator(i);
    let breakAt: number | undefined;
    let separator = "";

    if (!previous) separator = "";
    else if (previous.type === "semicolon" || isBatchSeparator(i - 1)) separator = options.minify ? "\n" : "\n\n";
    else if (batch) separator = "\n";
    else if (options.minify) separator = previous.type === "line-comment" ? "\n" : inlineGap(i);
    else if (comment) {
      if (item.gap === "\n") breakAt = pending ?? lineIndent;
      else separator = item.gap;
    } else if (continues) separator = " ";
    else if (clause) breakAt = current.base;
    else if (keyword && structural && startsJoin(i, keyword)) breakAt = current.base + 1;
    else if (
      (keyword === "AND" || keyword === "OR") &&
      structural &&
      ["WHERE", "HAVING"].includes(current.clause) &&
      current.between.at(-1) !== 0
    ) {
      breakAt = current.base + 1;
    } else if (
      top?.multiline &&
      top.inline === current.inline &&
      (keyword === "WHEN" || keyword === "ELSE" || keyword === "END")
    ) {
      breakAt = keyword === "END" ? top.indent : top.indent + 1;
    } else if (item.type === "close" && current.inline === 0 && blocks.length > 1) breakAt = current.closeIndent;
    else if (pending !== undefined) breakAt = pending;
    else if (previous.type === "comma" && structural && !commaLeads) breakAt = current.base + 1;
    else separator = inlineGap(i);
    // A line comment runs to the end of its line, so whatever follows it must start a new one.
    if (previous?.type === "line-comment" && breakAt === undefined && !separator.includes("\n")) {
      breakAt = pending ?? lineIndent;
    }

    if (breakAt === undefined) {
      if (separator.includes("\n")) lineIndent = 0;
      output += separator;
    } else {
      lineIndent = breakAt;
      output += `\n${pad(breakAt)}`;
    }
    if (breakAt !== undefined && !comment) pending = undefined;
    // A comma that starts its line (after a line comment) leads the next item on that line.
    commaLeads = item.type === "comma" && breakAt !== undefined;
    output += keywordText(item, keyword);

    // Update the structure for what comes next.
    if (comment) continue;
    current.fresh = false;
    if (item.type === "semicolon" || batch) {
      if (statementOpen) statements++;
      statementOpen = false;
      blocks = [newBlock(0, 0)];
      pending = undefined;
    } else statementOpen = true;
    if (item.type === "open") {
      const next = nextCode(i);
      const starter = blockStarters.has(upperAt(next)) && items[nextCode(next)]?.type !== "dot";
      if (starter && !options.minify) blocks.push(newBlock(lineIndent + 1, lineIndent));
      else current.inline++;
    } else if (item.type === "close") {
      if (current.inline > 0) {
        current.inline--;
        current.cases = current.cases.filter((frame) => frame.inline <= current.inline);
        current.between = current.between.filter((depth) => depth <= current.inline);
      } else if (blocks.length > 1) blocks.pop();
    } else if (keyword === "CASE") {
      current.cases.push({
        indent: lineIndent,
        inline: current.inline,
        multiline: current.inline === 0 && !options.minify,
      });
    } else if (keyword === "END" && current.cases.length > 0) current.cases.pop();
    else if (keyword === "BETWEEN") current.between.push(current.inline);
    else if (keyword === "AND" && current.between.at(-1) === current.inline) current.between.pop();
    else if (clause) {
      current.clause = keyword;
      if (["INSERT", "UPDATE", "DELETE"].includes(keyword)) current.kind = keyword;
      if (!options.minify) pending = setOperators.has(keyword) ? current.base : current.base + 1;
    }
    previousKeyword = keyword;
  }
  if (statementOpen) statements++;
  return { output, statements };
};

/** Formats SQL. Only whitespace and the case of keywords ever change; the result is checked for that. */
export const formatSql = (sql: string, options: SqlOptions): SqlResult => {
  const preferred = usesBackslashes(sql);
  // When reading `\'` either way closes every string, the dialect is only a guess, so the result
  // has to keep every token under both readings: what one calls spaces between words can be inside
  // a string to the other.
  const readings = sql.includes("\\") && !isUnclosed(tokenize(sql, !preferred)) ? [preferred, !preferred] : [preferred];
  const keepsTokens = (output: string) =>
    readings.every((backslashes) => sameTokens(tokenize(sql, backslashes), tokenize(output, backslashes)));
  const unterminated = isUnclosed(tokenize(sql, preferred));
  const results = readings.map((backslashes) => formatReading(sql, options, backslashes));
  const kept = results.find((result) => keepsTokens(result.output));
  const { statements } = results[0]!;
  return kept
    ? { output: kept.output, statements: kept.statements, unterminated, unchanged: false }
    : { output: sql, statements, unterminated, unchanged: true };
};
