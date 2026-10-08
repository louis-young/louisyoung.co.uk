import { describe, expect, it, vi } from "vitest";

import { fetchRepositories, getRepositories, parseRepositories } from "../../src/lib/github";

const repo = (name: string, stars: number, pushed: string, extra: Record<string, unknown> = {}) => ({
  name,
  description: `${name} description`,
  html_url: `https://github.com/louis-young/${name}`,
  language: "TypeScript",
  stargazers_count: stars,
  pushed_at: pushed,
  fork: false,
  archived: false,
  ...extra,
});

const sample = [
  repo("old", 5, "2020-01-01T00:00:00Z"),
  repo("popular", 50, "2021-01-01T00:00:00Z"),
  repo("recent", 5, "2026-01-01T00:00:00Z", { description: null, language: null }),
  repo("forked", 500, "2026-01-01T00:00:00Z", { fork: true }),
  repo("archived", 500, "2026-01-01T00:00:00Z", { archived: true }),
  repo("louisyoung.co.uk", 1, "2026-01-01T00:00:00Z"),
  { name: "broken" },
];

describe("parseRepositories", () => {
  it("drops forks, archives, exclusions and malformed entries, then sorts by stars and recency", () => {
    const parsed = parseRepositories(sample, ["louisyoung.co.uk"]);
    expect(parsed.map((item) => item.name)).toEqual(["popular", "recent", "old"]);
    expect(parsed[1]).toMatchObject({ description: "", language: undefined, stars: 5 });
    expect(parsed[0]!.pushedAt).toBeInstanceOf(Date);
  });

  it("limits the result and tolerates non-arrays", () => {
    expect(parseRepositories(sample, [], 2)).toHaveLength(2);
    expect(parseRepositories({ message: "rate limited" })).toEqual([]);
  });
});

describe("fetchRepositories", () => {
  it("calls the GitHub API with a token when given one", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(sample)));
    const result = await fetchRepositories("louis young", { fetch, token: "abc", limit: 1 });
    expect(result.map((item) => item.name)).toEqual(["popular"]);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/users/louis%20young/repos?per_page=100&sort=pushed");
    expect(init.headers).toMatchObject({ Authorization: "Bearer abc" });
  });

  it("returns nothing on an error response or a network failure", async () => {
    expect(
      await fetchRepositories("x", { fetch: vi.fn().mockResolvedValue(new Response("", { status: 403 })) }),
    ).toEqual([]);
    expect(await fetchRepositories("x", { fetch: vi.fn().mockRejectedValue(new Error("offline")) })).toEqual([]);
  });
});

describe("getRepositories", () => {
  it("skips the network outside Vercel builds", async () => {
    expect(await getRepositories("louis-young", {})).toEqual([]);
  });
});
