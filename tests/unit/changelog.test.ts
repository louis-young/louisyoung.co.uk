import { describe, expect, it } from "vitest";

import {
  changeUrl,
  changelogFeedItems,
  commitsUrl,
  getHistory,
  groupByMonth,
  logFormat,
  parseCommit,
  parseLog,
  readHistory,
  type Change,
  type Commit,
} from "../../src/lib/changelog";

const commit = (subject: string, overrides: Partial<Commit> = {}): Commit => ({
  hash: "c6d708bbb05aa5819ec595d9955262ce14f6a47a",
  date: new Date("2026-10-08T21:21:27Z"),
  author: "Louis Young",
  subject,
  ...overrides,
});

const line = (hash: string, date: string, author: string, subject: string) =>
  `${hash}\x1f${date}\x1f${author}\x1f${subject}\x1e\n`;

const change = (date: string, subject = "Something"): Change => ({
  hash: "abc1234",
  date: new Date(date),
  kind: "feature",
  scope: undefined,
  subject,
  pullRequest: undefined,
  breaking: false,
});

describe("parseLog", () => {
  it("splits git log output into commits", () => {
    const output =
      line("abc1234", "2026-10-08T21:21:27+00:00", "Louis Young", "feat: one (#1)") +
      line("def5678", "2026-09-01T10:00:00+01:00", "github-actions[bot]", "test(visual): update baselines");
    expect(parseLog(output)).toEqual([
      { hash: "abc1234", date: new Date("2026-10-08T21:21:27Z"), author: "Louis Young", subject: "feat: one (#1)" },
      {
        hash: "def5678",
        date: new Date("2026-09-01T09:00:00Z"),
        author: "github-actions[bot]",
        subject: "test(visual): update baselines",
      },
    ]);
  });

  it("ignores empty output and malformed records", () => {
    expect(parseLog("")).toEqual([]);
    expect(parseLog("fatal: not a git repository\n")).toEqual([]);
    expect(parseLog(line("abc1234", "not a date", "A", "feat: x"))).toEqual([]);
  });

  it("asks git for the fields it parses", () => {
    expect(logFormat).toBe("%H%x1f%cI%x1f%an%x1f%s%x1e");
  });
});

describe("parseCommit", () => {
  it("parses a scoped feature with a pull request", () => {
    expect(parseCommit(commit("feat(tools): add a json formatter (#123)"))).toEqual({
      hash: "c6d708bbb05aa5819ec595d9955262ce14f6a47a",
      date: new Date("2026-10-08T21:21:27Z"),
      kind: "feature",
      scope: "tools",
      subject: "Add a json formatter",
      pullRequest: 123,
      breaking: false,
    });
  });

  it("parses fixes, performance work and breaking changes", () => {
    expect(parseCommit(commit("fix: keep the header sticky"))).toMatchObject({
      kind: "fix",
      scope: undefined,
      subject: "Keep the header sticky",
      pullRequest: undefined,
    });
    expect(parseCommit(commit("perf(og)!: cache fonts (#9)"))).toMatchObject({
      kind: "performance",
      scope: "og",
      breaking: true,
      pullRequest: 9,
    });
  });

  it("treats a11y as accessibility, as a type or a scope", () => {
    expect(parseCommit(commit("fix(a11y): label the search field"))).toMatchObject({
      kind: "accessibility",
      scope: undefined,
    });
    expect(parseCommit(commit("feat(Accessibility): add skip links"))).toMatchObject({ kind: "accessibility" });
    expect(parseCommit(commit("a11y: raise contrast"))).toMatchObject({ kind: "accessibility" });
  });

  it.each(["chore", "test", "ci", "build", "docs", "style", "refactor", "revert"])("skips %s commits", (type) => {
    expect(parseCommit(commit(`${type}: tidy up`))).toBeUndefined();
  });

  it("skips non-conventional subjects and merge commits", () => {
    expect(parseCommit(commit("Update dependencies"))).toBeUndefined();
    expect(parseCommit(commit("Merge pull request #6 from louis-young/dependabot"))).toBeUndefined();
    expect(parseCommit(commit("feat:missing space"))).toBeUndefined();
  });

  it("hides bots and visual-baseline commits", () => {
    expect(parseCommit(commit("fix: bump react", { author: "dependabot[bot]" }))).toBeUndefined();
    expect(parseCommit(commit("feat: refresh visual baselines"))).toBeUndefined();
  });
});

describe("groupByMonth", () => {
  it("groups by UTC month, newest first", () => {
    const months = groupByMonth([
      change("2026-09-30T23:30:00Z", "late september"),
      change("2026-10-08T10:00:00Z", "october, later"),
      change("2026-10-01T00:00:00Z", "october, earlier"),
    ]);
    expect(months.map((month) => month.key)).toEqual(["2026-10", "2026-09"]);
    expect(months[0]!.date.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(months[0]!.changes.map((item) => item.subject)).toEqual(["october, later", "october, earlier"]);
  });

  it("returns nothing for no changes", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("links", () => {
  it("links to the pull request when there is one, else the commit", () => {
    expect(changeUrl({ hash: "abc1234", pullRequest: 35 })).toBe(
      "https://github.com/louis-young/louisyoung.co.uk/pull/35",
    );
    expect(changeUrl({ hash: "abc1234", pullRequest: undefined })).toBe(
      "https://github.com/louis-young/louisyoung.co.uk/commit/abc1234",
    );
    expect(commitsUrl).toBe("https://github.com/louis-young/louisyoung.co.uk/commits/master/");
  });
});

describe("changelogFeedItems", () => {
  it("turns changes into feed entries labelled by kind", () => {
    const [item] = changelogFeedItems([{ ...change("2026-10-08T10:00:00Z", "Add tools"), pullRequest: 35 }], (kind) =>
      kind.toUpperCase(),
    );
    expect(item).toEqual({
      title: "Add tools",
      description: "FEATURE: Add tools",
      url: "https://github.com/louis-young/louisyoung.co.uk/pull/35",
      published: new Date("2026-10-08T10:00:00Z"),
      tags: ["FEATURE"],
    });
  });
});

describe("readHistory", () => {
  const log =
    line("abc1234", "2026-10-08T21:21:27+00:00", "Louis Young", "feat: tools (#35)") +
    line("def5678", "2026-10-07T21:21:27+00:00", "Louis Young", "chore: tidy");

  it("reads the log and reports a full history", () => {
    const calls: (readonly string[])[] = [];
    const history = readHistory((args) => {
      calls.push(args);
      return args[0] === "log" ? log : "false\n";
    });
    expect(history.complete).toBe(true);
    expect(history.changes.map((item) => item.subject)).toEqual(["Tools"]);
    expect(calls[0]).toContain("--first-parent");
  });

  it("marks a shallow clone as incomplete but keeps what it has", () => {
    const history = readHistory((args) => (args[0] === "log" ? log : "true\n"));
    expect(history).toMatchObject({ complete: false, changes: [{ pullRequest: 35 }] });
  });

  it("marks a history cut off by the limit as incomplete", () => {
    expect(readHistory((args) => (args[0] === "log" ? log : "false"), 2).complete).toBe(false);
  });

  it("degrades to an empty, incomplete history when git is missing", () => {
    expect(
      readHistory(() => {
        throw new Error("spawnSync git ENOENT");
      }),
    ).toEqual({ changes: [], complete: false });
  });

  it("treats an unanswerable shallow check as incomplete", () => {
    const history = readHistory((args) => {
      if (args[0] === "log") return log;
      throw new Error("unknown option");
    });
    expect(history.complete).toBe(false);
    expect(history.changes).toHaveLength(1);
  });

  it("reads this repository without throwing, and caches the result", () => {
    const history = getHistory();
    expect(Array.isArray(history.changes)).toBe(true);
    expect(getHistory()).toBe(history);
  });
});
