import { afterEach, describe, expect, it } from "vitest";

import { describeCron, nextRuns, parseCron, runs, type CronMessages, type CronSchedule } from "../../src/lib/cron-tool";

const messages: CronMessages = {
  at: "At {times}",
  everyMinute: "Every minute",
  everyMinutes: "Every {step} minutes",
  minuteOne: "At minute {list}",
  minuteOther: "At minutes {list}",
  during: "during {list}",
  dayOne: "on day {list} of the month",
  dayOther: "on days {list} of the month",
  months: "in {list}",
  days: "on {list}",
  weekdays: "on weekdays",
  weekends: "at weekends",
  either: "{first} or {second}",
};

const listFormat = new Intl.ListFormat("en-GB", { type: "conjunction" });
const names = {
  months: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  list: (items: string[]) => listFormat.format(items),
};

const schedule = (expression: string): CronSchedule => {
  const result = parseCron(expression);
  if (!("schedule" in result)) throw new Error(`${expression} did not parse`);
  return result.schedule;
};

const describe_ = (expression: string) => describeCron(schedule(expression), messages, names);

describe("parseCron", () => {
  it("expands wildcards, lists, ranges and steps", () => {
    const { values } = schedule("*/15 9-17/4 1,15 * 1-5");
    expect(values.minute).toEqual([0, 15, 30, 45]);
    expect(values.hour).toEqual([9, 13, 17]);
    expect(values.dayOfMonth).toEqual([1, 15]);
    expect(values.month).toHaveLength(12);
    expect(values.dayOfWeek).toEqual([1, 2, 3, 4, 5]);
  });

  it("reads a stepped single value as running to the end of the field", () => {
    expect(schedule("5/20 * * * *").values.minute).toEqual([5, 25, 45]);
  });

  it("accepts month and day names in any case, and 7 as Sunday", () => {
    const { values } = schedule("0 0 * jan,Mar-MAY sun,7,Fri");
    expect(values.month).toEqual([1, 3, 4, 5]);
    expect(values.dayOfWeek).toEqual([0, 5]);
    expect(schedule("0 0 * * 5-7").values.dayOfWeek).toEqual([0, 5, 6]);
  });

  it("de-duplicates and sorts overlapping items", () => {
    expect(schedule("30,0-10/5,5 * * * *").values.minute).toEqual([0, 5, 10, 30]);
  });

  it("tracks whether each day field is restricted", () => {
    expect(schedule("0 0 * * *").restricted).toEqual({ dayOfMonth: false, dayOfWeek: false });
    expect(schedule("0 0 */2 * 1").restricted).toEqual({ dayOfMonth: false, dayOfWeek: true });
    expect(schedule("0 0 1 * 1").restricted).toEqual({ dayOfMonth: true, dayOfWeek: true });
  });

  it.each([
    ["@yearly", "0 0 1 1 *"],
    ["@annually", "0 0 1 1 *"],
    ["@monthly", "0 0 1 * *"],
    ["@weekly", "0 0 * * 0"],
    ["@daily", "0 0 * * *"],
    ["@midnight", "0 0 * * *"],
    [" @HOURLY ", "0 * * * *"],
  ])("expands the %s macro", (macro, expanded) => {
    expect(Object.values(schedule(macro).source).join(" ")).toBe(expanded);
  });

  it("tolerates extra whitespace between fields", () => {
    expect(schedule("  0\t9   * *  1 ").source.dayOfWeek).toBe("1");
  });

  it("reports blank input and the wrong number of fields", () => {
    expect(parseCron("   ")).toEqual({ error: "empty", count: 0 });
    expect(parseCron("* * * *")).toEqual({ error: "count", count: 4 });
    expect(parseCron("0 0 * * * *")).toEqual({ error: "count", count: 6 });
    expect(parseCron("@reboot")).toEqual({ error: "count", count: 1 });
  });

  it.each([
    ["60 * * * *", "minute", "range", "60"],
    ["* 24 * * *", "hour", "range", "24"],
    ["* * 0 * *", "dayOfMonth", "range", "0"],
    ["* * 32 * *", "dayOfMonth", "range", "32"],
    ["* * * 13 *", "month", "range", "13"],
    ["* * * 1-13 *", "month", "range", "1-13"],
    ["* * * * 8", "dayOfWeek", "range", "8"],
    ["1,,2 * * * *", "minute", "empty", "1,,2"],
    ["* * * * mon,", "dayOfWeek", "empty", "mon,"],
    ["*/0 * * * *", "minute", "step", "*/0"],
    ["* 17-9 * * *", "hour", "order", "17-9"],
    ["* * * dec-jan *", "month", "order", "dec-jan"],
    ["? * * * *", "minute", "syntax", "?"],
    ["* * * * monday", "dayOfWeek", "syntax", "monday"],
    ["* * * jan-foo *", "month", "syntax", "jan-foo"],
    ["* * mon * *", "dayOfMonth", "syntax", "mon"],
    ["1-2-3 * * * *", "minute", "syntax", "1-2-3"],
    ["*/x * * * *", "minute", "syntax", "*/x"],
  ])("rejects %j in the %s field", (expression, field, reason, value) => {
    expect(parseCron(expression)).toMatchObject({ errors: [{ field, reason, value }] });
  });

  it("reports every invalid field at once, with the field limits", () => {
    const result = parseCron("61 25 * * *");
    expect(result).toEqual({
      source: { minute: "61", hour: "25", dayOfMonth: "*", month: "*", dayOfWeek: "*" },
      errors: [
        { field: "minute", reason: "range", value: "61", min: 0, max: 59 },
        { field: "hour", reason: "range", value: "25", min: 0, max: 23 },
      ],
    });
  });
});

describe("runs", () => {
  it("groups consecutive values", () => {
    expect(runs([])).toEqual([]);
    expect(runs([1, 2, 3, 5, 7, 8])).toEqual([
      [1, 3],
      [5, 5],
      [7, 8],
    ]);
  });
});

describe("describeCron", () => {
  it.each([
    ["0 9 * * 1-5", "At 09:00 on weekdays"],
    ["0 0 * * sat,sun", "At 00:00 at weekends"],
    ["30 9,17 * * *", "At 09:30 and 17:30"],
    ["* * * * *", "Every minute"],
    ["*/15 * * * *", "Every 15 minutes"],
    ["0-59/30 * * * *", "Every 30 minutes"],
    ["*/15 9-17 * * *", "Every 15 minutes during 09:00–17:59"],
    ["*/7 * * * *", "At minutes 0, 7, 14, 21, 28, 35, 42, 49 and 56"],
    ["0 * * * *", "At minute 0"],
    [
      "5 */2 * * *",
      "At minute 5 during 00:00–00:59, 02:00–02:59, 04:00–04:59, 06:00–06:59, 08:00–08:59, 10:00–10:59, 12:00–12:59, 14:00–14:59, 16:00–16:59, 18:00–18:59, 20:00–20:59 and 22:00–22:59",
    ],
    ["0-14,30 * * * *", "At minutes 0–14 and 30"],
    ["* 9 * * *", "Every minute during 09:00–09:59"],
    ["30 2 1 * *", "At 02:30 on day 1 of the month"],
    ["0 0 1,15-17 * *", "At 00:00 on days 1 and 15–17 of the month"],
    ["0 12 1 jan,jul *", "At 12:00 on day 1 of the month in January and July"],
    ["0 0 * * mon,wed-fri", "At 00:00 on Monday and Wednesday–Friday"],
    ["0 0 13 * 5", "At 00:00 on day 13 of the month or on Friday"],
    ["0 0 * 6-8 *", "At 00:00 in June–August"],
    ["@daily", "At 00:00"],
  ])("describes %j as %j", (expression, description) => {
    expect(describe_(expression)).toBe(description);
  });
});

describe("nextRuns", () => {
  const from = new Date("2026-10-08T10:20:30Z"); // A Thursday.
  const iso = (dates: Date[]) => dates.map((date) => date.toISOString());

  afterEach(() => {
    delete process.env["TZ"];
  });

  it("lists the next runs in UTC, strictly after the start", () => {
    expect(iso(nextRuns(schedule("*/15 * * * *"), from, 3))).toEqual([
      "2026-10-08T10:30:00.000Z",
      "2026-10-08T10:45:00.000Z",
      "2026-10-08T11:00:00.000Z",
    ]);
    expect(iso(nextRuns(schedule("0 9 * * 1-5"), from, 3))).toEqual([
      "2026-10-09T09:00:00.000Z",
      "2026-10-12T09:00:00.000Z",
      "2026-10-13T09:00:00.000Z",
    ]);
    expect(iso(nextRuns(schedule("30 10 8 10 *"), new Date("2026-10-08T10:30:00Z"), 1))).toEqual([
      "2027-10-08T10:30:00.000Z",
    ]);
  });

  it("matches either day field when both are restricted, and both otherwise", () => {
    expect(iso(nextRuns(schedule("0 0 13 * 5"), from, 3))).toEqual([
      "2026-10-09T00:00:00.000Z",
      "2026-10-13T00:00:00.000Z",
      "2026-10-16T00:00:00.000Z",
    ]);
    expect(iso(nextRuns(schedule("0 0 */2 * 5"), from, 2))).toEqual([
      "2026-10-09T00:00:00.000Z",
      "2026-10-23T00:00:00.000Z",
    ]);
  });

  it("finds leap days and gives up on impossible dates", () => {
    expect(iso(nextRuns(schedule("0 0 29 2 *"), from, 2))).toEqual([
      "2028-02-29T00:00:00.000Z",
      "2032-02-29T00:00:00.000Z",
    ]);
    expect(nextRuns(schedule("0 0 30 2 *"), from, 5)).toEqual([]);
  });

  it("reads the schedule in local time, skipping times lost to daylight saving", () => {
    process.env["TZ"] = "Europe/London";
    // Clocks went forward at 01:00 on 29 March 2026, so 01:30 didn’t exist that day.
    const spring = new Date("2026-03-28T12:00:00Z");
    expect(iso(nextRuns(schedule("30 1 * * *"), spring, 2, "local"))).toEqual([
      "2026-03-30T00:30:00.000Z",
      "2026-03-31T00:30:00.000Z",
    ]);
    expect(iso(nextRuns(schedule("0 9 * * *"), from, 1, "local"))).toEqual(["2026-10-09T08:00:00.000Z"]);
  });
});
