import { execFileSync } from "node:child_process";

import { site } from "../site.config";
import type { FeedItem } from "./feeds";

/** The kinds of change worth telling readers about. Everything else is housekeeping. */
export type ChangeKind = "feature" | "fix" | "performance" | "accessibility";

export interface Commit {
  hash: string;
  date: Date;
  author: string;
  subject: string;
}

export interface Change {
  hash: string;
  date: Date;
  kind: ChangeKind;
  scope: string | undefined;
  /** The commit subject, capitalised, without the trailing `(#123)`. */
  subject: string;
  pullRequest: number | undefined;
  breaking: boolean;
}

export interface Month {
  /** `YYYY-MM`, in UTC. */
  key: string;
  /** Midnight UTC on the first of the month. */
  date: Date;
  changes: Change[];
}

export interface History {
  changes: Change[];
  /** False when git, or part of its history, was unavailable (e.g. a shallow clone). */
  complete: boolean;
}

const field = "\x1f";
const record = "\x1e";

/** `git log --format`: hash, committer date, author name and subject, unit- and record-separated. */
export const logFormat = "%H%x1f%cI%x1f%an%x1f%s%x1e";

export const parseLog = (output: string): Commit[] =>
  output.split(record).flatMap((chunk) => {
    const [hash = "", date = "", author = "", subject = ""] = chunk.trim().split(field);
    const parsed = new Date(date);
    return /^[0-9a-f]{7,64}$/u.test(hash) && !Number.isNaN(parsed.getTime())
      ? [{ hash, date: parsed, author, subject: subject.trim() }]
      : [];
  });

const header = /^(?<type>[a-z0-9]+)(?:\((?<scope>[^()]+)\))?(?<breaking>!)?: (?<subject>\S.*)$/u;
const pullRequestSuffix = /\s*\(#(?<number>\d+)\)$/u;
const kinds: Partial<Record<string, ChangeKind>> = {
  feat: "feature",
  fix: "fix",
  perf: "performance",
  a11y: "accessibility",
};
const accessibilityScopes = new Set(["a11y", "accessibility"]);

/** Automated commits (Dependabot, the visual-baseline workflow) are not changes to the site. */
const isBot = (commit: Commit) => /\[bot\]$/iu.test(commit.author) || /\bbaselines?\b/iu.test(commit.subject);

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Turns `feat(scope): subject (#123)` into a change. Housekeeping types (`chore`, `test`, `ci`,
 * `build`, `docs`, `style`, `refactor`…), non-conventional subjects and bots return undefined.
 */
export const parseCommit = (commit: Commit): Change | undefined => {
  if (isBot(commit)) return undefined;
  const match = header.exec(commit.subject)?.groups;
  if (!match) return undefined;
  const type = kinds[match["type"]!];
  if (!type) return undefined;
  const scope = match["scope"]?.trim().toLowerCase();
  const raw = match["subject"]!;
  const number = pullRequestSuffix.exec(raw)?.groups?.["number"];
  return {
    hash: commit.hash,
    date: commit.date,
    kind: scope && accessibilityScopes.has(scope) ? "accessibility" : type,
    scope: scope && !accessibilityScopes.has(scope) ? scope : undefined,
    subject: capitalise(raw.replace(pullRequestSuffix, "").trim()),
    pullRequest: number ? Number(number) : undefined,
    breaking: Boolean(match["breaking"]),
  };
};

const monthKey = (date: Date) => date.toISOString().slice(0, 7);

/** Groups changes by calendar month (UTC), newest month and newest change first. */
export const groupByMonth = (changes: readonly Change[]): Month[] => {
  const months = new Map<string, Change[]>();
  for (const change of [...changes].sort((a, b) => b.date.getTime() - a.date.getTime())) {
    const key = monthKey(change.date);
    months.set(key, [...(months.get(key) ?? []), change]);
  }
  return [...months].map(([key, items]) => ({ key, date: new Date(`${key}-01T00:00:00Z`), changes: items }));
};

const pullRequestUrl = (number: number) => `${site.repository}/pull/${number}`;

const commitUrl = (hash: string) => `${site.repository}/commit/${hash}`;

/** Every commit on the default branch, for when the build could not see them all. */
export const commitsUrl = `${site.repository}/commits/${site.defaultBranch}/`;

export const changeUrl = (change: Pick<Change, "hash" | "pullRequest">) =>
  change.pullRequest === undefined ? commitUrl(change.hash) : pullRequestUrl(change.pullRequest);

export const changelogFeedItems = (changes: readonly Change[], label: (kind: ChangeKind) => string): FeedItem[] =>
  changes.map((change) => ({
    title: change.subject,
    description: `${label(change.kind)}: ${change.subject}`,
    url: changeUrl(change),
    published: change.date,
    tags: [label(change.kind)],
  }));

type Git = (args: readonly string[]) => string;

const git: Git = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 10_000,
    maxBuffer: 16 * 1024 * 1024,
  });

/**
 * Reads the site's history from git at build time. Never throws: without git (or without its
 * history) the changelog is empty, and a shallow clone (Vercel clones 10 commits deep) is marked
 * incomplete so the page can link to the full history on GitHub instead.
 */
export const readHistory = (run: Git = git, limit = 500): History => {
  let commits: Commit[];
  try {
    commits = parseLog(
      run(["log", "--first-parent", "--no-merges", `--max-count=${limit}`, `--format=${logFormat}`, "HEAD"]),
    );
  } catch {
    return { changes: [], complete: false };
  }
  let shallow: boolean;
  try {
    shallow = run(["rev-parse", "--is-shallow-repository"]).trim() !== "false";
  } catch {
    shallow = true;
  }
  return {
    changes: commits.flatMap((commit) => parseCommit(commit) ?? []),
    complete: !shallow && commits.length < limit,
  };
};

let cached: History | undefined;

/** The history for this build, read once and shared by the page and its feed. */
export const getHistory = () => (cached ??= readHistory());
