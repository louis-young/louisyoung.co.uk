import { describe, expect, it } from "vitest";

import { caseNames, convertAll, convertCase, splitWords } from "../../src/lib/case-tool";

describe("splitWords", () => {
  it.each([
    ["parseHTTPResponse", ["parse", "HTTP", "Response"]],
    ["XMLHttpRequest", ["XML", "Http", "Request"]],
    ["getURLs", ["get", "URLs"]],
    ["userIDs list", ["user", "IDs", "list"]],
    ["base64Encode", ["base64", "Encode"]],
    ["HTML5Parser", ["HTML5", "Parser"]],
    ["v2.1.0-beta", ["v2", "1", "0", "beta"]],
    ["1st place 2FA 3DModel", ["1st", "place", "2FA", "3D", "Model"]],
    ["snake_case-and kebab.case/path", ["snake", "case", "and", "kebab", "case", "path"]],
    ["  lots   of\tspace  ", ["lots", "of", "space"]],
    ["don’t can't", ["dont", "cant"]],
    ["Crème brûlée", ["Crème", "brûlée"]],
    ["ÆON straße", ["ÆON", "straße"]],
    ["日本語Text", ["日本語", "Text"]],
    ["Ελληνικά Λέξη", ["Ελληνικά", "Λέξη"]],
    ["été", ["été"]],
    ["!!! ---", []],
  ])("splits %j", (text, words) => {
    expect(splitWords(text)).toEqual(words);
  });
});

describe("convertCase", () => {
  it("writes every case", () => {
    expect(convertAll("parseHTTPResponse")).toEqual({
      camel: "parseHttpResponse",
      pascal: "ParseHttpResponse",
      snake: "parse_http_response",
      screaming: "PARSE_HTTP_RESPONSE",
      kebab: "parse-http-response",
      title: "Parse HTTP Response",
      sentence: "Parse HTTP response",
      dot: "parse.http.response",
      path: "parse/http/response",
      slug: "parse-http-response",
    });
    expect(Object.keys(convertAll(""))).toEqual([...caseNames]);
  });

  it("keeps small words lower case inside a title", () => {
    expect(convertCase("the lord of the rings", "title")).toBe("The Lord of the Rings");
    expect(convertCase("what it is for", "title")).toBe("What It Is For");
  });

  it("doesn’t treat shouting as acronyms", () => {
    expect(convertCase("HELLO WORLD", "title")).toBe("Hello World");
    expect(convertCase("HELLO WORLD", "sentence")).toBe("Hello world");
    expect(convertCase("use the API", "sentence")).toBe("Use the API");
    expect(convertCase("API keys", "sentence")).toBe("API keys");
    expect(convertCase("I am here", "sentence")).toBe("I am here");
  });

  it("handles Unicode letters", () => {
    expect(convertCase("Straße der Einheit", "screaming")).toBe("STRASSE_DER_EINHEIT");
    expect(convertCase("Crème brûlée", "camel")).toBe("crèmeBrûlée");
    expect(convertCase("ελληνικά λέξη", "pascal")).toBe("ΕλληνικάΛέξη");
  });

  it("strips diacritics and anything else from slugs", () => {
    expect(convertCase("Crème Brûlée & Co.", "slug")).toBe("creme-brulee-and-co");
    expect(convertCase("Straße, Æsir, Øresund, Łódź, Þór, Ðá", "slug")).toBe("strasse-aesir-oresund-lodz-thor-da");
    expect(convertCase("日本語 Text", "slug")).toBe("text");
    expect(convertCase("ﬁve ½ ½", "slug")).toBe("five-1-2-1-2");
    expect(convertCase("Rock & Roll & co", "slug")).toBe("rock-and-roll-and-co");
  });

  it("converts each line on its own, keeping blank lines", () => {
    expect(convertCase("first name\n\nlast-name\r\nuserID", "snake")).toBe("first_name\n\nlast_name\nuser_id");
  });

  it("joins digits as they come", () => {
    expect(convertCase("version 2 beta", "camel")).toBe("version2Beta");
    expect(convertCase("version 2 beta", "kebab")).toBe("version-2-beta");
  });
});
