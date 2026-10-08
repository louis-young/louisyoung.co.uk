import { describe, expect, it } from "vitest";

import { formatDate, formatMessage, isoDate, useTranslations } from "../../src/i18n";
import { enGB } from "../../src/i18n/en-GB";
import { pseudoLocalise, pseudoMessages } from "../../src/i18n/pseudo";

describe("formatMessage", () => {
  it("interpolates named values", () => {
    expect(formatMessage("en-GB", "Hello {name}", { name: "Louis" })).toBe("Hello Louis");
  });

  it("formats numbers with the locale", () => {
    expect(formatMessage("en-GB", "{n} things", { n: 12345 })).toBe("12,345 things");
  });

  it("leaves unknown placeholders intact so missing values are visible", () => {
    expect(formatMessage("en-GB", "Hello {name}")).toBe("Hello {name}");
  });

  it.each([
    [0, "0 articles"],
    [1, "1 article"],
    [2, "2 articles"],
    [1000, "1,000 articles"],
  ])("pluralises %d as %s", (count, expected) => {
    expect(formatMessage("en-GB", "{count, plural, one {# article} other {# articles}}", { count })).toBe(expected);
  });

  it("prefers exact matches over plural categories", () => {
    expect(formatMessage("en-GB", "{count, plural, =0 {none} one {# item} other {# items}}", { count: 0 })).toBe(
      "none",
    );
  });
});

describe("useTranslations", () => {
  it("translates catalogue keys", () => {
    const t = useTranslations("en-GB");
    expect(t("nav.search")).toBe("Search");
    expect(t("article.readingTime", { minutes: 4 })).toBe("4 min read");
    expect(t("tags.count", { count: 1 })).toBe("1 article");
  });

  it("defaults to the site locale", () => {
    expect(useTranslations()("nav.search")).toBe("Search");
  });

  it("renders the pseudo-locale for every key", () => {
    const t = useTranslations("en-XA");
    for (const key of Object.keys(enGB) as (keyof typeof enGB)[]) {
      expect(t(key, { count: 2, minutes: 3, tag: "react", year: "2026" })).toMatch(/^⟦.*⟧$/u);
    }
  });
});

describe("pseudo-localisation", () => {
  it("accents letters, pads length and brackets the result", () => {
    const result = pseudoLocalise("Search");
    expect(result.startsWith("⟦Šéáŕçĥ")).toBe(true);
    expect(result.length).toBeGreaterThan("Search".length * 1.3);
  });

  it("preserves ICU placeholders and plural syntax", () => {
    const pseudo = pseudoLocalise("{count, plural, one {# article} other {# articles}}");
    expect(pseudo).toContain("{count, plural, one {# article} other {# articles}}");
    expect(formatMessage("en-XA", pseudo, { count: 2 })).toContain("2 articles");
  });

  it("covers every key in the source catalogue", () => {
    expect(Object.keys(pseudoMessages(enGB))).toEqual(Object.keys(enGB));
  });
});

describe("dates", () => {
  const date = new Date("2021-02-15T00:00:00Z");

  it("formats long British dates in UTC regardless of host timezone", () => {
    expect(formatDate(date, "en-GB")).toBe("15 February 2021");
    expect(formatDate(new Date("2021-02-15T23:30:00Z"))).toBe("15 February 2021");
  });

  it("uses British formatting for the pseudo-locale", () => {
    expect(formatDate(date, "en-XA")).toBe("15 February 2021");
  });

  it("produces ISO calendar dates for datetime attributes", () => {
    expect(isoDate(date)).toBe("2021-02-15");
  });
});
