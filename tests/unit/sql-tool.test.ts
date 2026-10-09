import { describe, expect, it } from "vitest";

import { formatSql, type SqlOptions, tokenize, usesBackslashes } from "../../src/lib/sql-tool";

const pretty: SqlOptions = { keywordCase: "upper", indent: "2", minify: false };
const format = (sql: string, options: Partial<SqlOptions> = {}) => formatSql(sql, { ...pretty, ...options }).output;
const texts = (sql: string, backslashes = false) =>
  tokenize(sql, backslashes)
    .filter((token) => token.type !== "space")
    .map((token) => token.text);

describe("tokenize", () => {
  it("reads strings with doubled quotes and prefixes", () => {
    expect(texts("'it''s' N'x' E'a\\'b' X'ff' U&'d' B'01'")).toEqual([
      "'it''s'",
      "N'x'",
      "E'a\\'b'",
      "X'ff'",
      "U&'d'",
      "B'01'",
    ]);
    expect(tokenize("'a'")[0]).toEqual({ type: "string", text: "'a'", closed: true });
  });

  it("reads backslash escapes only when asked", () => {
    expect(texts(String.raw`'a\'b'`)).toEqual([String.raw`'a\'`, "b'"]);
    expect(texts(String.raw`'a\'b'`, true)).toEqual([String.raw`'a\'b'`]);
    expect(texts(String.raw`"a\"b"`, true)).toEqual([String.raw`"a\"b"`]);
    expect(texts("`a\\`", true)).toEqual(["`a\\`"]);
  });

  it("reads quoted names in every style", () => {
    expect(tokenize('"my ""col"""')[0]).toMatchObject({ type: "quoted", text: '"my ""col"""' });
    expect(texts("`a``b` [x]]y] [z]")).toEqual(["`a``b`", "[x]]y]", "[z]"]);
  });

  it("reads dollar-quoted strings and positional parameters", () => {
    expect(texts("$$ it's $x$ $$ $fn$ a $$ b $fn$ $1 $2")).toEqual(["$$ it's $x$ $$", "$fn$ a $$ b $fn$", "$1", "$2"]);
    expect(tokenize("$q$ open")[0]).toMatchObject({ type: "string", closed: false });
  });

  it("reads line and block comments, nested ones included", () => {
    expect(texts("a -- one\r\nb # two\nc /* x /* y */ z */ d")).toEqual([
      "a",
      "-- one",
      "b",
      "# two",
      "c",
      "/* x /* y */ z */",
      "d",
    ]);
    expect(tokenize("/* open /* */")[0]).toMatchObject({ type: "block-comment", closed: false });
    expect(tokenize("-- end")[0]).toMatchObject({ type: "line-comment", text: "-- end" });
  });

  it("reads numbers, names and dots", () => {
    expect(tokenize("1 .5 1.5e-3 0xFF 2.").map((token) => token.type)).toEqual([
      "number",
      "space",
      "number",
      "space",
      "number",
      "space",
      "number",
      "space",
      "number",
    ]);
    expect(texts("t.5 a.b @var @@global ünïcödé_1 $x")).toEqual([
      "t",
      ".",
      "5",
      "a",
      ".",
      "b",
      "@var",
      "@@global",
      "ünïcödé_1",
      "$",
      "x",
    ]);
  });

  it("splits operators as PostgreSQL does", () => {
    expect(texts("a=-1 b<->c d@-@e f<=>g h::int i->>'k' j||k l*-2 m!=-3")).toEqual([
      "a",
      "=",
      "-",
      "1",
      "b",
      "<->",
      "c",
      "d",
      "@-@",
      "e",
      "f",
      "<=>",
      "g",
      "h",
      "::",
      "int",
      "i",
      "->>",
      "'k'",
      "j",
      "||",
      "k",
      "l",
      "*",
      "-",
      "2",
      "m",
      "!=-",
      "3",
    ]);
    expect(texts("a--b\nc /*x*/")).toEqual(["a", "--b", "c", "/*x*/"]);
    expect(texts("a=/*x*/b")).toEqual(["a", "=", "/*x*/", "b"]);
  });

  it("keeps punctuation and anything unknown as single tokens", () => {
    expect(tokenize("(a, b); ¶ 😀").map((token) => token.type)).toEqual([
      "open",
      "word",
      "comma",
      "space",
      "word",
      "close",
      "semicolon",
      "space",
      "other",
      "space",
      "other",
    ]);
    expect(texts("a\u00A0b")).toEqual(["a", "\u00A0", "b"]);
  });

  it("flags anything left open", () => {
    expect(tokenize("'open")[0]).toMatchObject({ type: "string", closed: false });
    expect(tokenize('"open')[0]).toMatchObject({ type: "quoted", closed: false });
  });
});

describe("usesBackslashes", () => {
  it("assumes standard SQL unless MySQL escapes are the only reading that closes", () => {
    expect(usesBackslashes("select 'a'")).toBe(false);
    expect(usesBackslashes(String.raw`select 'C:\', 'D:\'`)).toBe(false);
    expect(usesBackslashes(String.raw`select 'it\'s', 'x  y'`)).toBe(true);
    expect(usesBackslashes(String.raw`select 'open\'`)).toBe(false);
  });
});

describe("formatSql", () => {
  it("lays out a query with a CTE, joins, CASE, a subquery and every clause", () => {
    const sql =
      "with recent as (select id, name from users where created_at > now() - interval '7 days') " +
      "select r.id, count(*) as total, case when count(*) > 10 then 'vip' else 'lead' end as segment " +
      "from recent r left outer join orders o on o.user_id = r.id cross join plans p " +
      "where r.name like 'A%' and r.id between 1 and 100 or r.id in (select id from admins) " +
      "group by r.id having count(*) > 1 order by total desc limit 10 offset 5;";
    expect(format(sql)).toBe(
      [
        "WITH",
        "  recent AS (",
        "    SELECT",
        "      id,",
        "      name",
        "    FROM",
        "      users",
        "    WHERE",
        "      created_at > now() - interval '7 days'",
        "  )",
        "SELECT",
        "  r.id,",
        "  count(*) AS total,",
        "  CASE",
        "    WHEN count(*) > 10 THEN 'vip'",
        "    ELSE 'lead'",
        "  END AS segment",
        "FROM",
        "  recent r",
        "  LEFT OUTER JOIN orders o ON o.user_id = r.id",
        "  CROSS JOIN plans p",
        "WHERE",
        "  r.name LIKE 'A%'",
        "  AND r.id BETWEEN 1 AND 100",
        "  OR r.id IN (",
        "    SELECT",
        "      id",
        "    FROM",
        "      admins",
        "  )",
        "GROUP BY",
        "  r.id",
        "HAVING",
        "  count(*) > 1",
        "ORDER BY",
        "  total DESC",
        "LIMIT",
        "  10",
        "OFFSET",
        "  5;",
      ].join("\n"),
    );
  });

  it("lays out INSERT, UPDATE and DELETE", () => {
    expect(format("insert into t (a, b) values (1, 'x'), (2, 'y'); update t set a=1, b = 2 where id=3")).toBe(
      [
        "INSERT INTO",
        "  t (a, b)",
        "VALUES",
        "  (1, 'x'),",
        "  (2, 'y');",
        "",
        "UPDATE",
        "  t",
        "SET",
        "  a = 1,",
        "  b = 2",
        "WHERE",
        "  id = 3",
      ].join("\n"),
    );
    expect(format("delete from t where a is distinct from b returning *")).toBe(
      "DELETE FROM\n  t\nWHERE\n  a IS DISTINCT FROM b\nRETURNING\n  *",
    );
    expect(format("insert into t select * from u")).toBe("INSERT INTO\n  t\nSELECT\n  *\nFROM\n  u");
  });

  it("indents subqueries in FROM and set operations", () => {
    expect(format("select * from (select a from t) as sub union all select 1")).toBe(
      [
        "SELECT",
        "  *",
        "FROM",
        "  (",
        "    SELECT",
        "      a",
        "    FROM",
        "      t",
        "  ) AS sub",
        "UNION ALL",
        "SELECT",
        "  1",
      ].join("\n"),
    );
  });

  it("nests CASE and keeps CASE inside a function call on one line", () => {
    expect(
      format("select case x when 1 then case when y then 'a' end else 'b' end, coalesce(case when z then 1 end, 0)"),
    ).toBe(
      [
        "SELECT",
        "  CASE x",
        "    WHEN 1 THEN CASE",
        "      WHEN y THEN 'a'",
        "    END",
        "    ELSE 'b'",
        "  END,",
        "  coalesce(CASE WHEN z THEN 1 END, 0)",
      ].join("\n"),
    );
  });

  it("keeps clause words inside function calls inline", () => {
    expect(format("select extract(year from d), row_number() over (partition by a order by b) from t")).toBe(
      "SELECT\n  extract(year FROM d),\n  row_number() OVER (PARTITION BY a ORDER BY b)\nFROM\n  t",
    );
  });

  it("puts AND and OR on their own lines only in WHERE and HAVING", () => {
    expect(format("select a and b from t join u on t.id = u.id and t.x = 1 where (a or b) and c")).toBe(
      "SELECT\n  a AND b\nFROM\n  t\n  JOIN u ON t.id = u.id AND t.x = 1\nWHERE\n  (a OR b)\n  AND c",
    );
  });

  it("spaces binary operators but not unary ones, casts or dots", () => {
    expect(format("select a+b, -1, a*-2, t.*, x::int, a||b, a = -1, f(*), a.b from t where x>=1")).toBe(
      "SELECT\n  a + b,\n  -1,\n  a * -2,\n  t.*,\n  x::int,\n  a || b,\n  a = -1,\n  f(*),\n  a.b\nFROM\n  t\nWHERE\n  x >= 1",
    );
  });

  it("keeps the space, or not, before a parenthesis", () => {
    expect(format("select count (*), count(*) from t")).toBe("SELECT\n  count (*),\n  count(*)\nFROM\n  t");
  });

  it("changes keyword case only", () => {
    const sql = "Select Name, \"Select\", 'select', `from`, [where] From Users u Where u.id = 1";
    expect(format(sql, { keywordCase: "lower" })).toBe(
      "select\n  Name,\n  \"Select\",\n  'select',\n  `from`,\n  [where]\nfrom\n  Users u\nwhere\n  u.id = 1",
    );
    expect(format(sql, { keywordCase: "preserve" })).toBe(
      "Select\n  Name,\n  \"Select\",\n  'select',\n  `from`,\n  [where]\nFrom\n  Users u\nWhere\n  u.id = 1",
    );
  });

  it("leaves words that are only sometimes keywords alone", () => {
    expect(format("select end, offset, returning, full, ilike, t.select, t.from from t")).toBe(
      "SELECT\n  end,\n  offset,\n  returning,\n  full,\n  ilike,\n  t.select,\n  t.from\nFROM\n  t",
    );
    expect(format("select a from t full outer join u on true where a ilike 'x' limit 1 offset 2")).toBe(
      "SELECT\n  a\nFROM\n  t\n  FULL OUTER JOIN u ON TRUE\nWHERE\n  a ILIKE 'x'\nLIMIT\n  1\nOFFSET\n  2",
    );
  });

  it("uses the indent asked for", () => {
    expect(format("select a from t", { indent: "4" })).toBe("SELECT\n    a\nFROM\n    t");
    expect(format("select a from t", { indent: "tab" })).toBe("SELECT\n\ta\nFROM\n\tt");
  });

  it("minifies to one line per statement", () => {
    expect(format("select a , b\nfrom t\nwhere x = - 1 and y = (1 + 2);\nselect 'a  b'", { minify: true })).toBe(
      "SELECT a,b FROM t WHERE x=- 1 AND y=(1+2);\nSELECT 'a  b'",
    );
    expect(format("select a = -1, b - -1, * from t", { minify: true })).toBe("SELECT a=-1,b- -1,* FROM t");
  });

  it("keeps comments, and breaks the line after a line comment", () => {
    expect(format("select a -- first\n, b /* second */ from t # mysql\nwhere x = 1")).toBe(
      "SELECT\n  a -- first\n  , b /* second */\nFROM\n  t # mysql\nWHERE\n  x = 1",
    );
    expect(format("-- report\nselect /* all */ * from t")).toBe("-- report\nSELECT /* all */\n  *\nFROM\n  t");
    expect(format("select a from t\n-- the end")).toBe("SELECT\n  a\nFROM\n  t\n  -- the end");
    expect(format("select a, -- why\nb from t", { minify: true })).toBe("SELECT a,-- why\nb FROM t");
    expect(format("select a group -- x\nby a")).toBe("SELECT\n  a\nGROUP -- x\n  BY a");
  });

  it("treats GO on its own line as a batch separator", () => {
    expect(format("select 1\nGO\nselect 2")).toBe("SELECT\n  1\nGO\n\nSELECT\n  2");
    expect(formatSql("select 1\ngo\nselect 2;", pretty).statements).toBe(2);
    expect(format("select go from t")).toBe("SELECT\n  go\nFROM\n  t");
  });

  it("counts statements and handles empty input", () => {
    expect(formatSql("", pretty)).toEqual({ output: "", statements: 0, unterminated: false, unchanged: false });
    expect(formatSql("select 1; ; select 2;", pretty).statements).toBe(2);
  });

  it("leaves an unclosed string or comment, and everything after it, as typed", () => {
    const result = formatSql("select a,   'open  string\nfrom   t", pretty);
    expect(result.unterminated).toBe(true);
    expect(result.output).toBe("SELECT\n  a,\n  'open  string\nfrom   t");
  });

  it("survives unbalanced parentheses", () => {
    expect(format("select (a from t) ) where x")).toBe("SELECT\n  (a FROM t))\nWHERE\n  x");
    expect(format("select ((select 1)")).toBe("SELECT\n  ((\n    SELECT\n      1\n  )");
  });
});

/** Every token’s text, with keyword case ignored, so a format that changes anything else fails. */
const fingerprint = (sql: string) =>
  tokenize(sql, usesBackslashes(sql))
    .filter((token) => token.type !== "space")
    .map((token) => `${token.type}:${token.type === "word" ? token.text.toUpperCase() : token.text}`);

const corpus = [
  "select 'a  b', 'select  from', '', '''', 'line\nbreak\n  indented', 'tab\there' from t",
  String.raw`select 'it\'s', "say \"hi\"", 'x  y' from t where a = 'b  c'`,
  String.raw`select 'C:\', 'D:\  E' from t`,
  `select "Weird  Name", "with ""quotes""", \`back  tick\`, [bracket  name], [a]]b] from "My Table"`,
  "select $$ dollar  'quoted' -- not a comment $$, $tag$ a $$ b $tag$, $1 from t",
  "select E'esc\\'aped  ', N'national  ', X'DEADBEEF', U&'d\\0061t' from t",
  "select a -- comment  with   spaces\nfrom t /* block\n   comment  */ where /* x */ b = 1 # hash  comment\n",
  "select /* nested /* inner */ still */ 1",
  "SELECT a, b FROM t WHERE c IN (SELECT d FROM u WHERE e = 'select from where') ORDER BY 1",
  'with x as (select 1 as "select") select * from x',
  "select case when a = 'when  then' then 'else  end' else \"case\" end from t",
  "insert into t (\"a  b\", `c`) values ('d  e', 'f''g'), ($1, :name), (?, @p)",
  "update t set a = 'b  c', \"d e\" = 1 where f = '-- not a comment'",
  "delete from t where a = '/* not a comment */' and b = 1",
  "select a::text, b->>'k  ey', c#>>'{a,b}', d @> '{\"x\": 1}' from t",
  "select 1 from t where a = 'unterminated  string\nand more  text",
  "select * from t where a = 1 -- trailing comment without newline",
  "select\ta\r\nfrom\r\nt\r\nwhere\tb\u00A0= 1",
  "SELECT a FROM t WHERE x = 'ünïcödé  text' AND y = '😀  emoji'",
  "select 1;\nselect '2  ';\n\nselect 3",
  "select a from t\nGO\nselect 'go  on'",
];

const allOptions: SqlOptions[] = (["upper", "lower", "preserve"] as const).flatMap((keywordCase) =>
  (["2", "4", "tab"] as const).flatMap((indent) => [true, false].map((minify) => ({ keywordCase, indent, minify }))),
);

describe("formatSql never changes what a query means", () => {
  it.each(corpus)("keeps every token of %j", (sql) => {
    for (const options of allOptions) {
      const result = formatSql(sql, options);
      expect(result.unchanged, JSON.stringify(options)).toBe(false);
      expect(fingerprint(result.output), JSON.stringify(options)).toEqual(fingerprint(sql));
    }
  });

  it.each(corpus)("copies strings, quoted names and comments byte for byte in %j", (sql) => {
    const verbatim = (text: string) =>
      tokenize(text, usesBackslashes(text))
        .filter((token) => ["string", "quoted", "line-comment", "block-comment"].includes(token.type))
        .map((token) => token.text);
    for (const options of allOptions) expect(verbatim(formatSql(sql, options).output)).toEqual(verbatim(sql));
  });

  // Bug hunt: two MySQL strings with escaped quotes also close when read as standard SQL, which
  // put the spaces and words inside them between tokens, where formatting changed them.
  it("keeps MySQL strings whole when standard SQL would also close them", () => {
    const sql = String.raw`INSERT INTO t VALUES ('it\'s   a select', 'don\'t')`;
    for (const options of allOptions) {
      const output = formatSql(sql, options).output;
      expect(output, JSON.stringify(options)).toContain(String.raw`'it\'s   a select'`);
    }
    expect(format(sql)).toBe(`INSERT INTO\n  t\nVALUES\n  (${String.raw`'it\'s   a select', 'don\'t'`})`);
  });

  it.each(corpus)("is stable when run twice on %j", (sql) => {
    const once = format(sql);
    expect(format(once)).toBe(once);
  });

  it("keeps every token of thousands of random queries", () => {
    const pieces = [
      "select",
      "from",
      "where",
      "and",
      "or",
      "between",
      "case",
      "when",
      "then",
      "else",
      "end",
      "join",
      "left",
      "on",
      "group",
      "order",
      "by",
      "union",
      "all",
      "insert",
      "into",
      "values",
      "update",
      "set",
      "delete",
      "with",
      "as",
      "limit",
      "offset",
      "(",
      ")",
      ",",
      ";",
      ".",
      "*",
      "-",
      "+",
      "=",
      "<>",
      "::",
      "a",
      "b1",
      "t",
      "1",
      "2.5",
      "'s  q'",
      "''",
      "'it''s'",
      '"q  i"',
      "`b  t`",
      "[x  y]",
      "$$ d  q $$",
      "-- line  c\n",
      "/* blk  c */",
      "# hash\n",
      "$1",
      "@v",
      "\n",
      " ",
      "  ",
      "go",
      "E'e\\'s'",
      "'\\'",
    ];
    let seed = 42;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let run = 0; run < 2000; run++) {
      const length = 1 + Math.floor(random() * 30);
      const sql = Array.from({ length }, () => {
        const piece = pieces[Math.floor(random() * pieces.length)]!;
        return random() < 0.7 ? `${piece} ` : piece;
      }).join("");
      const options = allOptions[run % allOptions.length]!;
      const result = formatSql(sql, options);
      expect(result.unchanged, `${JSON.stringify(sql)} ${JSON.stringify(options)}`).toBe(false);
      expect(fingerprint(result.output), JSON.stringify(sql)).toEqual(fingerprint(sql));
    }
  });
});
