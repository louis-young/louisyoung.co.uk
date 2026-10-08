import { describe, expect, it, vi } from "vitest";

import { formatInZone, formatTimestamp, parseTimestamp, relativeTime } from "../../src/lib/timestamp-tool";

const instant = "2026-10-08T09:00:00.000Z";

const parsed = (input: string) => {
  const result = parseTimestamp(input);
  if (!("date" in result)) throw new Error(`${input} failed: ${result.error}`);
  return { ...result, iso: result.date.toISOString() };
};

describe("parseTimestamp", () => {
  it("tells Unix seconds from milliseconds by size", () => {
    expect(parsed("1791450000")).toMatchObject({ iso: instant, format: "seconds" });
    expect(parsed("1791450000000")).toMatchObject({ iso: instant, format: "milliseconds" });
    expect(parsed(" 0 ")).toMatchObject({ iso: "1970-01-01T00:00:00.000Z", format: "seconds" });
    expect(parsed("-86400")).toMatchObject({ iso: "1969-12-31T00:00:00.000Z", format: "seconds" });
    expect(parsed("1791450000.5")).toMatchObject({ iso: "2026-10-08T09:00:00.500Z", format: "seconds" });
    expect(parsed("+99999999999")).toMatchObject({ format: "seconds" });
    expect(parsed("100000000000")).toMatchObject({ iso: "1973-03-03T09:46:40.000Z", format: "milliseconds" });
  });

  it.each([
    ["2026-10-08T09:00:00Z", instant, false],
    ["2026-10-08t09:00:00z", instant, false],
    ["2026-10-08T10:00:00+01:00", instant, false],
    ["2026-10-08T04:30:00-0430", instant, false],
    ["2026-10-08T18:00+09", instant, false],
    ["2026-10-08 09:00:00", instant, true],
    ["2026-10-08T09:00", instant, true],
    ["2026-10-08T09:00:00.123456Z", "2026-10-08T09:00:00.123Z", false],
    ["2026-10-08T09:00:00,5Z", "2026-10-08T09:00:00.500Z", false],
    ["2026-10-08", "2026-10-08T00:00:00.000Z", false],
    ["0001-01-01", "0001-01-01T00:00:00.000Z", false],
    ["+275760-09-13T00:00:00Z", "+275760-09-13T00:00:00.000Z", false],
    ["2024-02-29T00:00:00Z", "2024-02-29T00:00:00.000Z", false],
  ])("reads ISO 8601 %j", (input, iso, assumedUtc) => {
    expect(parsed(input)).toMatchObject({ iso, format: "iso", assumedUtc });
  });

  it.each([
    ["Thu, 08 Oct 2026 09:00:00 +0000", instant],
    ["thu, 8 oct 2026 10:00:00 +0100", instant],
    ["08 Oct 2026 09:00 GMT", instant],
    ["Thu, 08 Oct 2026 05:00:00 EDT", instant],
    ["Thu, 08 Oct 2026 01:00:00 PST", instant],
    ["Thu, 08 Oct 2026 09:00:00 UT", instant],
    ["Thu, 08 Oct 2026 09:00:00 Z", instant],
    ["Thu, 08 Oct 2026 04:00:00 EST", instant],
    ["Thu, 08 Oct 2026 04:00:00 CDT", instant],
    ["Thu, 08 Oct 2026 03:00:00 CST", instant],
    ["Thu, 08 Oct 2026 03:00:00 MDT", instant],
    ["Thu, 08 Oct 2026 02:00:00 MST", instant],
    ["Thu, 08 Oct 2026 02:00:00 PDT", instant],
  ])("reads RFC 2822 %j", (input, iso) => {
    expect(parsed(input)).toMatchObject({ iso, format: "rfc2822", assumedUtc: false });
  });

  it("checks the weekday against the written date, before the offset", () => {
    expect(parsed("Fri, 09 Oct 2026 01:00:00 +0900").iso).toBe("2026-10-08T16:00:00.000Z");
    expect(parseTimestamp("Fri, 08 Oct 2026 09:00:00 +0000")).toEqual({ error: "weekday" });
  });

  it.each([
    "yesterday",
    "2026-13-01",
    "2026-02-30",
    "2023-02-29",
    "2026-10-08T24:00:00Z",
    "2026-10-08T09:60Z",
    "2026-10-08T09:00:60Z",
    "2026-10-08T09:00+24:00",
    "2026-10-08T09:00+01:60",
    "2026-10-08T09:00:00.Z",
    "1e10",
    "Xyz, 08 Oct 2026 09:00:00 +0000",
    "Thu, 08 Okt 2026 09:00:00 +0000",
    "Thu, 08 Oct 2026 09:00:00 BST",
    "Thu, 08 Oct 2026 09:00:00 +2500",
    "Thu, 32 Oct 2026 09:00:00 +0000",
    "Thu, 08 Oct 2026 25:00:00 +0000",
  ])("rejects %j", (input) => {
    expect(parseTimestamp(input)).toEqual({ error: "invalid" });
  });

  it("reports empty input and dates beyond the Date range", () => {
    expect(parseTimestamp("  ")).toEqual({ error: "empty" });
    expect(parseTimestamp("8640000000000001")).toEqual({ error: "range" });
    expect(parseTimestamp("-8640000000000001")).toEqual({ error: "range" });
    expect(parseTimestamp("+275760-09-13T00:00:00.001Z")).toEqual({ error: "range" });
    expect(parsed("8640000000000000")).toMatchObject({ iso: "+275760-09-13T00:00:00.000Z" });
  });
});

describe("formatTimestamp", () => {
  it("writes every format", () => {
    expect(formatTimestamp(new Date(instant))).toEqual({
      seconds: "1791450000",
      milliseconds: "1791450000000",
      iso: instant,
      rfc2822: "Thu, 08 Oct 2026 09:00:00 +0000",
    });
  });

  it("rounds seconds down, even before 1970", () => {
    expect(formatTimestamp(new Date(-1500))).toMatchObject({ seconds: "-2", milliseconds: "-1500" });
    expect(formatTimestamp(new Date(1999))).toMatchObject({ seconds: "1" });
  });

  it("pads small years and leaves RFC 2822 out for years it can’t write", () => {
    expect(formatTimestamp(new Date("0099-01-05T00:00:00Z")).rfc2822).toBe("Mon, 05 Jan 0099 00:00:00 +0000");
    expect(formatTimestamp(new Date("+010000-01-01T00:00:00Z")).rfc2822).toBeUndefined();
    expect(formatTimestamp(new Date("-000001-01-01T00:00:00Z")).rfc2822).toBeUndefined();
  });
});

describe("relativeTime", () => {
  const now = new Date(instant);
  const at = (seconds: number) => relativeTime(new Date(now.getTime() + seconds * 1000), now);

  it.each([
    [0, [0, "second"]],
    [-0.4, [0, "second"]],
    [30, [30, "second"]],
    [-59, [-59, "second"]],
    [90, [2, "minute"]],
    [-3 * 3600, [-3, "hour"]],
    [-3 * 86_400, [-3, "day"]],
    [10 * 86_400, [1, "week"]],
    [45 * 86_400, [1, "month"]],
    [-400 * 86_400, [-1, "year"]],
    [-30 * 365 * 86_400, [-30, "year"]],
  ])("describes %d seconds away", (seconds, expected) => {
    expect(at(seconds)).toEqual(expected);
  });
});

describe("formatInZone", () => {
  // ICU versions differ on the comma after the weekday.
  it("writes the instant for a time zone with its offset", () => {
    const date = new Date(instant);
    expect(formatInZone(date, "UTC")).toMatch(/^Thu,? 8 Oct 2026, 09:00:00 GMT$/u);
    expect(formatInZone(date, "Europe/London")).toMatch(/^Thu,? 8 Oct 2026, 10:00:00 GMT\+1$/u);
    expect(formatInZone(date, "Asia/Tokyo")).toMatch(/^Thu,? 8 Oct 2026, 18:00:00 GMT\+9$/u);
    expect(formatInZone(date, "America/New_York")).toMatch(/^Thu,? 8 Oct 2026, 05:00:00 GMT-4$/u);
  });

  it("writes a zero offset as plain GMT whichever way ICU spells it", () => {
    const icu = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function () {
      return { format: () => "Thu, 8 Oct 2026, 09:00:00 GMT+0" } as unknown as Intl.DateTimeFormat;
    });
    expect(formatInZone(new Date(instant), "UTC")).toBe("Thu, 8 Oct 2026, 09:00:00 GMT");
    icu.mockRestore();
  });
});
