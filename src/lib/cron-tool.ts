export const cronFields = ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"] as const;
export type CronField = (typeof cronFields)[number];

export interface CronFieldError {
  field: CronField;
  /**
   * `empty`: nothing between commas; `syntax`: not a value, range or step; `range`: a number outside
   * the field’s limits; `order`: a range that runs backwards; `step`: a step of zero.
   */
  reason: "empty" | "syntax" | "range" | "order" | "step";
  /** The offending comma-separated item, or the whole field when it is empty. */
  value: string;
  min: number;
  max: number;
}

export interface CronSchedule {
  /** The five fields as written (after expanding a macro such as `@daily`). */
  source: Record<CronField, string>;
  /** The sorted, de-duplicated values each field allows. Day of week uses 0 (Sunday) to 6. */
  values: Record<CronField, number[]>;
  /**
   * Cron (like the classic Unix daemon) treats a day field that starts with `*` as unrestricted. When both day
   * fields are restricted, a day matches if either does.
   */
  restricted: { dayOfMonth: boolean; dayOfWeek: boolean };
}

export type CronResult =
  | { schedule: CronSchedule }
  | { errors: CronFieldError[]; source: Partial<Record<CronField, string>> }
  | { error: "empty" | "count"; count: number };

const limits: Record<CronField, [number, number]> = {
  minute: [0, 59],
  hour: [0, 23],
  dayOfMonth: [1, 31],
  month: [1, 12],
  // 7 is accepted as a second Sunday and folded into 0.
  dayOfWeek: [0, 7],
};

const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const macros: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const item = /^(\*|[a-z0-9]+(?:-[a-z0-9]+)?)(?:\/(\d+))?$/u;

/** Reads a number or, for months and days of the week, a three-letter English name. */
const atom = (field: CronField, text: string) => {
  if (/^\d+$/u.test(text)) return Number(text);
  const names = field === "month" ? monthNames : field === "dayOfWeek" ? dayNames : [];
  const index = names.indexOf(text);
  if (index === -1) return undefined;
  return field === "month" ? index + 1 : index;
};

const parseField = (field: CronField, text: string): { values: number[] } | { error: CronFieldError } => {
  const [min, max] = limits[field];
  const fail = (reason: CronFieldError["reason"], value: string) => ({ error: { field, reason, value, min, max } });
  const values = new Set<number>();
  for (const part of text.split(",")) {
    if (part === "") return fail("empty", text);
    const match = item.exec(part.toLowerCase());
    if (!match) return fail("syntax", part);
    const [, base = "", stepText] = match;
    const step = stepText === undefined ? 1 : Number(stepText);
    if (step === 0) return fail("step", part);
    let start = min;
    let end = max;
    if (base !== "*") {
      const [from = "", to] = base.split("-");
      const first = atom(field, from);
      const last = to === undefined ? undefined : atom(field, to);
      if (first === undefined || (to !== undefined && last === undefined)) return fail("syntax", part);
      if (first < min || first > max || (last !== undefined && (last < min || last > max))) {
        return fail("range", part);
      }
      if (last !== undefined && last < first) return fail("order", part);
      start = first;
      // `5/15` means “from 5, every 15”, so a stepped single value runs to the end of the field.
      end = last ?? (stepText === undefined ? first : max);
    }
    for (let value = start; value <= end; value += step) values.add(field === "dayOfWeek" ? value % 7 : value);
  }
  return { values: [...values].sort((a, b) => a - b) };
};

/** Parses a five-field cron expression, or one of the `@daily`-style macros. */
export const parseCron = (expression: string): CronResult => {
  const trimmed = expression.trim().toLowerCase();
  if (trimmed === "") return { error: "empty", count: 0 };
  const parts = (macros[trimmed] ?? expression.trim()).split(/\s+/u);
  if (parts.length !== cronFields.length) return { error: "count", count: parts.length };
  const source = Object.fromEntries(cronFields.map((field, i) => [field, parts[i] ?? ""])) as Record<CronField, string>;
  const errors: CronFieldError[] = [];
  const values: Partial<Record<CronField, number[]>> = {};
  for (const field of cronFields) {
    const result = parseField(field, source[field]);
    if ("error" in result) errors.push(result.error);
    else values[field] = result.values;
  }
  if (errors.length > 0) return { errors, source };
  return {
    schedule: {
      source,
      values: values as Record<CronField, number[]>,
      restricted: { dayOfMonth: !source.dayOfMonth.startsWith("*"), dayOfWeek: !source.dayOfWeek.startsWith("*") },
    },
  };
};

/** Groups sorted numbers into runs of consecutive values: [1,2,3,5] → [[1,3],[5,5]]. */
export const runs = (values: number[]): [number, number][] => {
  const result: [number, number][] = [];
  for (const value of values) {
    const last = result.at(-1);
    if (last && value === last[1] + 1) last[1] = value;
    else result.push([value, value]);
  }
  return result;
};

/** The sentence fragments the description is built from, so the words can be translated. */
export interface CronMessages {
  /** `{times}` */
  at: string;
  everyMinute: string;
  /** `{step}` */
  everyMinutes: string;
  /** `{list}` */
  minuteOne: string;
  /** `{list}` */
  minuteOther: string;
  /** `{list}` */
  during: string;
  /** `{list}` */
  dayOne: string;
  /** `{list}` */
  dayOther: string;
  /** `{list}` */
  months: string;
  /** `{list}` */
  days: string;
  weekdays: string;
  weekends: string;
  /** `{first}`, `{second}` */
  either: string;
}

export interface CronNames {
  /** Twelve month names, January first. */
  months: string[];
  /** Seven day names, Sunday first. */
  days: string[];
  /** Joins a list with the locale’s “and”. */
  list: (items: string[]) => string;
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => values[name] ?? match);

const pad = (value: number) => String(value).padStart(2, "0");
const time = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;
const span = ([from, to]: [number, number], name: (value: number) => string) =>
  from === to ? name(from) : `${name(from)}–${name(to)}`;
const isAll = (field: CronField, values: number[]) => {
  const [min, max] = limits[field];
  return values.length === (field === "dayOfWeek" ? 7 : max - min + 1);
};

/** A plain-language description of a schedule, e.g. “At 09:00 on weekdays”. */
export const describeCron = (schedule: CronSchedule, messages: CronMessages, names: CronNames) => {
  const { values, source, restricted } = schedule;
  const { minute: minutes, hour: hours } = values;
  const list = (field: CronField, name: (value: number) => string) =>
    names.list(runs(values[field]).map((run) => span(run, name)));
  const clauses: string[] = [];

  if (minutes.length === 1 && !isAll("hour", hours) && hours.length <= 6) {
    clauses.push(fill(messages.at, { times: names.list(hours.map((hour) => time(hour, minutes[0] ?? 0))) }));
  } else {
    const step = /^(?:\*|0-59)\/(\d+)$/u.exec(source.minute)?.[1];
    if (isAll("minute", minutes)) clauses.push(messages.everyMinute);
    else if (step !== undefined && 60 % Number(step) === 0) clauses.push(fill(messages.everyMinutes, { step }));
    else {
      const template = minutes.length === 1 ? messages.minuteOne : messages.minuteOther;
      clauses.push(fill(template, { list: list("minute", String) }));
    }
    if (!isAll("hour", hours)) {
      const during = runs(hours).map(([from, to]) => `${time(from, 0)}–${time(to, 59)}`);
      clauses.push(fill(messages.during, { list: names.list(during) }));
    }
  }

  const dayClauses: string[] = [];
  if (restricted.dayOfMonth) {
    const template = values.dayOfMonth.length === 1 ? messages.dayOne : messages.dayOther;
    dayClauses.push(fill(template, { list: list("dayOfMonth", String) }));
  }
  if (restricted.dayOfWeek) {
    const days = values.dayOfWeek.join();
    if (days === "1,2,3,4,5") dayClauses.push(messages.weekdays);
    else if (days === "0,6") dayClauses.push(messages.weekends);
    else dayClauses.push(fill(messages.days, { list: list("dayOfWeek", (day) => names.days[day] ?? "") }));
  }
  const [first = "", second] = dayClauses;
  if (second === undefined) clauses.push(first);
  else clauses.push(fill(messages.either, { first, second }));

  if (!isAll("month", values.month)) {
    clauses.push(fill(messages.months, { list: list("month", (month) => names.months[month - 1] ?? "") }));
  }
  return clauses.filter(Boolean).join(" ");
};

export type CronZone = "utc" | "local";

const fields = (date: Date, zone: CronZone) =>
  zone === "utc"
    ? [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes()]
    : [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()];

const make = (zone: CronZone, ...[year, month, day, hour, minute]: number[]) =>
  zone === "utc"
    ? new Date(Date.UTC(year ?? 0, month ?? 0, day ?? 1, hour ?? 0, minute ?? 0))
    : new Date(year ?? 0, month ?? 0, day ?? 1, hour ?? 0, minute ?? 0);

/** Days searched before deciding a schedule never runs. Covers 29 February across a century gap. */
const horizon = 366 * 9;

/**
 * The next `count` times the schedule fires strictly after `from`, reading the schedule’s fields
 * in UTC or in the runtime’s local time zone. Local times skipped by a daylight-saving change
 * never fire. Returns fewer than `count` if the schedule can’t fire (e.g. 30 February).
 */
export const nextRuns = (schedule: CronSchedule, from: Date, count: number, zone: CronZone = "utc") => {
  const { values, restricted } = schedule;
  const allowed = (field: CronField, value: number) => values[field].includes(value);
  const [year = 0, month = 0, day = 1] = fields(from, zone);
  const result: Date[] = [];
  for (let offset = 0; offset < horizon && result.length < count; offset++) {
    // Noon is never skipped by a daylight-saving change, so it identifies the day safely.
    const noon = make(zone, year, month, day + offset, 12, 0);
    const [y = 0, m = 0, d = 1] = fields(noon, zone);
    const weekday = zone === "utc" ? noon.getUTCDay() : noon.getDay();
    if (!allowed("month", m + 1)) continue;
    const domMatch = allowed("dayOfMonth", d);
    const dowMatch = allowed("dayOfWeek", weekday);
    const dayMatch = restricted.dayOfMonth && restricted.dayOfWeek ? domMatch || dowMatch : domMatch && dowMatch;
    if (!dayMatch) continue;
    for (const hour of values.hour) {
      for (const minute of values.minute) {
        const run = make(zone, y, m, d, hour, minute);
        if (run.getTime() <= from.getTime() || fields(run, zone).join() !== [y, m, d, hour, minute].join()) continue;
        result.push(run);
        if (result.length === count) return result;
      }
    }
  }
  return result;
};
