type TimestampFormat = "seconds" | "milliseconds" | "iso" | "rfc2822";

export type TimestampResult =
  | {
      date: Date;
      format: TimestampFormat;
      /** True when an ISO 8601 date-time gave no offset and was read as UTC. */
      assumedUtc: boolean;
    }
  | { error: "empty" | "invalid" | "range" | "weekday" };

/** The largest absolute time a Date can hold: ±100,000,000 days from 1970. */
const maxTime = 8.64e15;

/**
 * Bare numbers below this are read as seconds and the rest as milliseconds. 1e11 seconds is the
 * year 5138, while 1e11 milliseconds is March 1973, so real timestamps fall clearly either side.
 */
const millisecondThreshold = 1e11;

const iso =
  /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/iu;

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** RFC 2822 §4.3 obsolete zone names, in hours from UTC. */
const zones: Record<string, number> = {
  UT: 0,
  GMT: 0,
  Z: 0,
  EST: -5,
  EDT: -4,
  CST: -6,
  CDT: -5,
  MST: -7,
  MDT: -6,
  PST: -8,
  PDT: -7,
};

const rfc2822 =
  /^(?:([a-z]{3}),\s*)?(\d{1,2})\s+([a-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+([+-]\d{4}|[a-z]{1,3})$/iu;

const daysInMonth = (year: number, month: number) => {
  // setUTCFullYear, unlike Date.UTC, doesn’t read years 0 to 99 as 1900 to 1999.
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
};

/** Builds a UTC time from parts, or undefined if any part is out of range. */
const utc = (parts: { year: number; month: number; day: number; hour: number; minute: number; second: number }) => {
  const { year, month, day, hour, minute, second } = parts;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return undefined;
  if (hour > 23 || minute > 59 || second > 59) return undefined;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
};

const offsetMinutes = (offset: string) => {
  const sign = offset.startsWith("-") ? -1 : 1;
  const digits = offset.slice(1).replace(":", "");
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2) || "0");
  return hours > 23 || minutes > 59 ? undefined : sign * (hours * 60 + minutes);
};

const finish = (time: number | undefined, format: TimestampFormat, assumedUtc = false): TimestampResult => {
  if (time === undefined || Number.isNaN(time)) return { error: "invalid" };
  if (Math.abs(time) > maxTime) return { error: "range" };
  return { date: new Date(time), format, assumedUtc };
};

const parseIso = (match: RegExpExecArray) => {
  const [, year = "", month = "", day = "", hour, minute, second, fraction, offset] = match;
  const base = utc({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour ?? 0),
    minute: Number(minute ?? 0),
    second: Number(second ?? 0),
  });
  const zone = offset === undefined || offset.toUpperCase() === "Z" ? 0 : offsetMinutes(offset);
  if (base === undefined || zone === undefined) return finish(undefined, "iso");
  const milliseconds = Number((fraction ?? "").padEnd(3, "0").slice(0, 3));
  // A date with no time is a whole UTC day by definition, so only a date-time “assumes” UTC.
  return finish(base + milliseconds - zone * 60_000, "iso", offset === undefined && hour !== undefined);
};

const title = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

const parseRfc2822 = (match: RegExpExecArray): TimestampResult => {
  const [, weekday, day = "", month = "", year = "", hour = "", minute = "", second, zone = ""] = match;
  const monthIndex = months.indexOf(title(month));
  const named = zones[zone.toUpperCase()];
  const offset = /^[+-]/u.test(zone) ? offsetMinutes(zone) : named === undefined ? undefined : named * 60;
  if (monthIndex === -1 || offset === undefined) return { error: "invalid" };
  const base = utc({
    year: Number(year),
    month: monthIndex + 1,
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second ?? 0),
  });
  if (base === undefined) return { error: "invalid" };
  if (weekday !== undefined) {
    const index = days.indexOf(title(weekday));
    if (index === -1) return { error: "invalid" };
    // The weekday belongs to the written (local) date, so check it before applying the offset.
    if (new Date(base).getUTCDay() !== index) return { error: "weekday" };
  }
  return finish(base - offset * 60_000, "rfc2822");
};

/**
 * Reads a Unix timestamp (seconds or milliseconds, told apart by size), an ISO 8601 date or
 * date-time, or an RFC 2822 date such as an email’s `Date:` header.
 */
export const parseTimestamp = (input: string): TimestampResult => {
  const text = input.trim();
  if (text === "") return { error: "empty" };
  if (/^[+-]?\d+(?:\.\d+)?$/u.test(text)) {
    const value = Number(text);
    const isSeconds = Math.abs(value) < millisecondThreshold;
    return finish(Math.round(isSeconds ? value * 1000 : value), isSeconds ? "seconds" : "milliseconds");
  }
  const isoMatch = iso.exec(text);
  if (isoMatch) return parseIso(isoMatch);
  const rfcMatch = rfc2822.exec(text);
  if (rfcMatch) return parseRfc2822(rfcMatch);
  return { error: "invalid" };
};

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** Every format the converter writes. RFC 2822 is undefined for years it can’t express. */
export const formatTimestamp = (date: Date) => {
  const time = date.getTime();
  const year = date.getUTCFullYear();
  const rfc =
    year < 0 || year > 9999
      ? undefined
      : `${days[date.getUTCDay()] ?? ""}, ${pad(date.getUTCDate())} ${months[date.getUTCMonth()] ?? ""} ${pad(year, 4)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`;
  return {
    seconds: String(Math.floor(time / 1000)),
    milliseconds: String(time),
    iso: date.toISOString(),
    rfc2822: rfc,
  };
};

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.348_214],
  ["month", 12],
];

/** The largest sensible unit for the gap between two times, for Intl.RelativeTimeFormat. */
export const relativeTime = (date: Date, now: Date): [number, Intl.RelativeTimeFormatUnit] => {
  let value = (date.getTime() - now.getTime()) / 1000;
  for (const [unit, size] of units) {
    if (Math.abs(value) < size) return [Math.round(value) || 0, unit];
    value /= size;
  }
  return [Math.round(value) || 0, "year"];
};

/** The same instant written for a time zone, with its UTC offset, e.g. “Thu 8 Oct 2026, 10:00:00 GMT+1”. */
export const formatInZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
    timeZoneName: "shortOffset",
  }).format(date);
