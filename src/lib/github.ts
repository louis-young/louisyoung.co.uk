export interface Repository {
  name: string;
  description: string;
  url: string;
  language: string | undefined;
  stars: number;
  pushedAt: Date;
}

interface ApiRepository {
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
}

const isApiRepository = (value: unknown): value is ApiRepository =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ApiRepository).name === "string" &&
  typeof (value as ApiRepository).html_url === "string" &&
  typeof (value as ApiRepository).pushed_at === "string";

/** Keeps original, active repositories and orders them by stars, then by most recent push. */
export const parseRepositories = (json: unknown, exclude: readonly string[] = [], limit = 6): Repository[] =>
  (Array.isArray(json) ? json : [])
    .filter(isApiRepository)
    .filter((repo) => !repo.fork && !repo.archived && !exclude.includes(repo.name))
    .map((repo) => ({
      name: repo.name,
      description: repo.description ?? "",
      url: repo.html_url,
      language: repo.language ?? undefined,
      stars: repo.stargazers_count,
      pushedAt: new Date(repo.pushed_at),
    }))
    .sort((a, b) => b.stars - a.stars || b.pushedAt.getTime() - a.pushedAt.getTime())
    .slice(0, limit);

interface FetchOptions {
  fetch?: typeof globalThis.fetch;
  token?: string | undefined;
  exclude?: readonly string[];
  limit?: number;
}

/**
 * Fetches public repositories at build time. Any failure (offline, rate limited) returns an
 * empty list, so a build never breaks because GitHub is unavailable.
 */
export const fetchRepositories = async (user: string, options: FetchOptions = {}): Promise<Repository[]> => {
  const { fetch = globalThis.fetch, token, exclude, limit } = options;
  try {
    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return [];
    return parseRepositories(await response.json(), exclude, limit);
  } catch {
    return [];
  }
};

let cached: Promise<Repository[]> | undefined;

/**
 * Repositories for the site build. Only Vercel builds fetch live data: CI and local builds
 * stay deterministic (and offline-safe) for visual regression tests.
 */
export const getRepositories = (user: string, env: Record<string, string | undefined> = process.env) =>
  (cached ??= env["VERCEL"]
    ? fetchRepositories(user, { token: env["GITHUB_TOKEN"], exclude: ["louisyoung.co.uk", user] })
    : Promise.resolve([]));
