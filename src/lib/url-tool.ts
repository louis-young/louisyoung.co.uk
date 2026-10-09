/** Parsing, editing and checking URLs with the WHATWG URL API. */

/** The parts of a URL the tool lets you edit, as `URL` property names. */
export type EditablePart = "protocol" | "username" | "password" | "hostname" | "port" | "pathname" | "hash";

export type Param = readonly [name: string, value: string];

export interface ParsedUrl {
  href: string;
  origin: string;
  protocol: string;
  username: string;
  password: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  /** Query parameters, decoded, in order (names can repeat). */
  params: Param[];
}

export type UrlIssue = "missingProtocol" | "spaces" | "hashInQuery" | "badEscape";

export type UrlResult =
  { ok: true; url: ParsedUrl; issues: UrlIssue[] } | { ok: false; reason: "empty" | "invalid"; issues: UrlIssue[] };

const scheme = /^[a-z][a-z\d+.-]*:/iu;
/** `localhost:3000` and `example.com:8080` look like a scheme to the parser but are a host and port. */
const hostAndPort = /^(?:localhost|[^/:]*\.[^/:]*):\d/iu;

const describe = (url: URL): ParsedUrl => ({
  href: url.href,
  // Opaque origins (`data:`, `mailto:`) serialise as "null".
  origin: url.origin,
  protocol: url.protocol,
  username: url.username,
  password: url.password,
  host: url.host,
  hostname: url.hostname,
  port: url.port,
  pathname: url.pathname,
  search: url.search,
  hash: url.hash,
  params: [...url.searchParams],
});

/** Common mistakes in what was typed, whether or not it parses. */
export const findIssues = (input: string): UrlIssue[] => {
  const text = input.trim();
  if (text === "") return [];
  const issues: UrlIssue[] = [];
  if (!scheme.test(text) || hostAndPort.test(text)) issues.push("missingProtocol");
  if (/\s/u.test(text)) issues.push("spaces");
  const query = text.indexOf("?");
  const fragment = text.indexOf("#");
  // `?colour=#fff&size=2`: the # ends the query early, so the value is empty and the rest becomes the fragment.
  if (query !== -1 && fragment > query) {
    const rest = text.slice(fragment + 1);
    if (text[fragment - 1] === "=" || /[=&]/u.test(rest)) issues.push("hashInQuery");
  }
  if (/%(?![\da-f]{2})/iu.test(text)) issues.push("badEscape");
  return issues;
};

/** Parses `input`, adding `https://` if it has no protocol but parses with one. */
export const parseUrl = (input: string): UrlResult => {
  const text = input.trim();
  const issues = findIssues(text);
  if (text === "") return { ok: false, reason: "empty", issues };
  const candidate = issues.includes("missingProtocol") ? `https:${text.startsWith("//") ? "" : "//"}${text}` : text;
  return URL.canParse(candidate)
    ? { ok: true, url: describe(new URL(candidate)), issues }
    : { ok: false, reason: "invalid", issues };
};

const strip = (part: EditablePart, value: string) => {
  if (part === "protocol") return value.replace(/:$/u, "").toLowerCase();
  if (part === "hash") return value.replace(/^#/u, "");
  return value;
};

/**
 * Sets one part of `href`. The URL API quietly ignores values it can't use (a port of `abc`, or
 * switching `https:` to `mailto:`), so `applied` says whether the value took.
 */
export const setPart = (href: string, part: EditablePart, value: string) => {
  const url = new URL(href);
  url[part] = value;
  const result = describe(url);
  const applied = result.href !== href || strip(part, result[part]) === strip(part, value);
  return { url: result, applied };
};

/** Replaces the query with `params`, encoded the way forms encode them; empty rows are dropped. */
export const setParams = (href: string, params: readonly Param[]) => {
  const url = new URL(href);
  const kept = params.filter(([name, value]) => name !== "" || value !== "");
  url.search = new URLSearchParams(kept.map(([name, value]) => [name, value])).toString();
  return describe(url);
};

/** Decodes percent-escapes, or returns undefined if one is malformed. */
export const decode = (text: string) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return undefined;
  }
};

/** Percent-encodes everything but unreserved characters. */
export const encode = (text: string) => encodeURIComponent(text);

/** The URL with escapes decoded wherever that keeps it unambiguous (`%2F`, `%26` and friends stay). */
export const readable = (href: string) => {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
};
