import { describe, expect, it } from "vitest";

import { decode, encode, findIssues, parseUrl, readable, setParams, setPart } from "../../src/lib/url-tool";

const parsed = (input: string) => {
  const result = parseUrl(input);
  if (!result.ok) throw new Error(`${input} did not parse`);
  return result;
};

describe("parseUrl", () => {
  it("splits a URL into its parts", () => {
    const { url, issues } = parsed("https://ann:s3cret@Example.com:8443/a/b%20c?q=caf%C3%A9&tag=x&tag=y#top");
    expect(url).toEqual({
      href: "https://ann:s3cret@example.com:8443/a/b%20c?q=caf%C3%A9&tag=x&tag=y#top",
      origin: "https://example.com:8443",
      protocol: "https:",
      username: "ann",
      password: "s3cret",
      host: "example.com:8443",
      hostname: "example.com",
      port: "8443",
      pathname: "/a/b%20c",
      search: "?q=caf%C3%A9&tag=x&tag=y",
      hash: "#top",
      params: [
        ["q", "café"],
        ["tag", "x"],
        ["tag", "y"],
      ],
    });
    expect(issues).toEqual([]);
  });

  it("drops a default port and normalises the host", () => {
    expect(parsed("HTTP://EXAMPLE.com:80/").url).toMatchObject({ port: "", host: "example.com", protocol: "http:" });
    expect(parsed("https://münchen.de/").url.hostname).toBe("xn--mnchen-3ya.de");
  });

  it("adds https:// when the protocol is missing", () => {
    const result = parsed("example.com/path?x=1");
    expect(result.url.href).toBe("https://example.com/path?x=1");
    expect(result.issues).toEqual(["missingProtocol"]);
    expect(parsed("//cdn.example.com/a.js").url.href).toBe("https://cdn.example.com/a.js");
    expect(parsed("localhost:4321/tools/").url.origin).toBe("https://localhost:4321");
  });

  it("gives opaque URLs a null origin", () => {
    expect(parsed("mailto:hi@example.com").url).toMatchObject({ origin: "null", pathname: "hi@example.com" });
    expect(parsed("tel:+441234").issues).toEqual([]);
  });

  it("reports empty and invalid input", () => {
    expect(parseUrl("  ")).toEqual({ ok: false, reason: "empty", issues: [] });
    expect(parseUrl("https://exa mple.com")).toEqual({ ok: false, reason: "invalid", issues: ["spaces"] });
    expect(parseUrl("http://[::1")).toMatchObject({ ok: false, reason: "invalid" });
  });
});

describe("findIssues", () => {
  it("flags spaces", () => {
    expect(findIssues("https://example.com/my file.pdf")).toEqual(["spaces"]);
  });

  it("flags a # that cuts a query value short", () => {
    expect(findIssues("https://x.dev/?colour=#fff")).toEqual(["hashInQuery"]);
    expect(findIssues("https://x.dev/?a=1&colour=#fff&size=2")).toEqual(["hashInQuery"]);
    expect(findIssues("https://x.dev/?a=1#section")).toEqual([]);
    expect(findIssues("https://x.dev/#a=1")).toEqual([]);
  });

  it("flags malformed percent-escapes", () => {
    expect(findIssues("https://x.dev/100%")).toEqual(["badEscape"]);
    expect(findIssues("https://x.dev/%zz")).toEqual(["badEscape"]);
    expect(findIssues("https://x.dev/%2F")).toEqual([]);
  });

  it("flags several at once", () => {
    expect(findIssues("x.dev/a b?c=#d")).toEqual(["missingProtocol", "spaces", "hashInQuery"]);
    expect(findIssues("")).toEqual([]);
  });
});

describe("editing", () => {
  const href = "https://example.com/a?x=1#h";

  it("sets each part and rebuilds the URL", () => {
    expect(setPart(href, "hostname", "example.org").url.href).toBe("https://example.org/a?x=1#h");
    expect(setPart(href, "port", "8080").url.host).toBe("example.com:8080");
    expect(setPart(href, "pathname", "/b c").url.href).toBe("https://example.com/b%20c?x=1#h");
    expect(setPart(href, "hash", "#top").url.hash).toBe("#top");
    expect(setPart(href, "hash", "").url.href).toBe("https://example.com/a?x=1");
    expect(setPart(href, "username", "ann").url.href).toBe("https://ann@example.com/a?x=1#h");
    expect(setPart(href, "password", "p@ss").url.password).toBe("p%40ss");
    expect(setPart(href, "protocol", "http").url.protocol).toBe("http:");
  });

  it("says when the URL API ignores a value", () => {
    expect(setPart(href, "port", "abc")).toMatchObject({ applied: false });
    expect(setPart(href, "protocol", "mailto")).toMatchObject({ applied: false });
    expect(setPart(href, "protocol", "HTTPS:")).toMatchObject({ applied: true });
    expect(setPart(href, "hash", "h")).toMatchObject({ applied: true });
  });

  it("replaces the query from rows, dropping empty ones", () => {
    const url = setParams(href, [
      ["q", "a b&c"],
      ["", ""],
      ["flag", ""],
    ]);
    expect(url.search).toBe("?q=a+b%26c&flag=");
    expect(url.params).toEqual([
      ["q", "a b&c"],
      ["flag", ""],
    ]);
    expect(setParams(href, []).href).toBe("https://example.com/a#h");
  });
});

describe("escapes", () => {
  it("decodes and encodes components", () => {
    expect(decode("caf%C3%A9%20%26")).toBe("café &");
    expect(decode("%E0%A4%A")).toBeUndefined();
    expect(encode("café & co/?")).toBe("caf%C3%A9%20%26%20co%2F%3F");
  });

  it("makes a URL readable without making it ambiguous", () => {
    expect(readable("https://x.dev/caf%C3%A9?q=a%26b%20c")).toBe("https://x.dev/café?q=a%26b c");
    expect(readable("https://x.dev/%E0%A4%A")).toBe("https://x.dev/%E0%A4%A");
  });

  // Bug hunt: the Decode button parses the readable URL again, and decoding %25, a line break or a
  // backslash changed the URL: `%2525` became `%25` (a different value), a newline was stripped and
  // `\` became a path separator.
  it.each([
    "https://x.dev/?next=%2Fa%3Fq%3D50%2525",
    "https://x.dev/?q=a%0Ab",
    "https://x.dev/a%5Cb",
    "https://x.dev/%E2%9C%93%2F%25?q=%E2%9C%93",
  ])("reads %s back as the same URL", (href) => {
    expect(parsed(readable(href)).url.href).toBe(href);
    expect(parsed(readable(href)).url.params).toEqual(parsed(href).url.params);
  });

  it("still decodes what can safely be decoded around kept escapes", () => {
    expect(readable("https://x.dev/%E2%9C%93%25%E2%9C%93")).toBe("https://x.dev/✓%25✓");
  });
});
