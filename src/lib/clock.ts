/** "10:05", in 24-hour time, for a given IANA time zone. */
export const formatLocalTime = (date: Date, timeZone: string, locale = "en-GB") =>
  new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(date);

/** Milliseconds until the next minute boundary, so a clock can tick exactly on the minute. */
export const msToNextMinute = (date: Date) => 60_000 - (date.getTime() % 60_000);
