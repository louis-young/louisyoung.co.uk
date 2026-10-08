import {
  cronFields,
  describeCron,
  nextRuns,
  parseCron,
  runs,
  type CronField,
  type CronFieldError,
  type CronMessages,
  type CronZone,
} from "../lib/cron-tool";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

const list = new Intl.ListFormat("en-GB", { type: "conjunction" });
const format = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
const names = {
  months: Array.from({ length: 12 }, (_, i) => format({ month: "long" }).format(Date.UTC(2023, i, 1))),
  // 1 January 2023 was a Sunday, so day 1 + i of that month is weekday i.
  days: Array.from({ length: 7 }, (_, i) => format({ weekday: "long" }).format(Date.UTC(2023, 0, 1 + i))),
  list: (items: string[]) => list.format(items),
};

const messageKeys: (keyof CronMessages)[] = [
  "at",
  "everyMinute",
  "everyMinutes",
  "minuteOne",
  "minuteOther",
  "during",
  "dayOne",
  "dayOther",
  "months",
  "days",
  "weekdays",
  "weekends",
  "either",
];

const errorKeys: Record<CronFieldError["reason"], string> = {
  empty: "errorEmpty",
  syntax: "errorSyntax",
  range: "errorRange",
  order: "errorOrder",
  step: "errorStep",
};

const runFormat = (timeZone?: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });

/** The cron expression explainer on /tools/cron/. */
export const initCron = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-cron]");
  if (!tool) return;
  const input = tool.querySelector<HTMLInputElement>("[data-input]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const runsBody = tool.querySelector<HTMLElement>("[data-runs]")!;
  const runsSection = tool.querySelector<HTMLElement>("[data-runs-section]")!;
  const never = tool.querySelector<HTMLElement>("[data-never]")!;
  const zoneName = tool.querySelector<HTMLElement>("[data-zone-name]")!;
  const message = (key: string) => tool.dataset[key] ?? "";
  const messages = Object.fromEntries(messageKeys.map((key) => [key, message(key)])) as unknown as CronMessages;
  const localZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  const local = runFormat();
  const utc = runFormat("UTC");
  zoneName.textContent = `(${localZone})`;

  const row = (field: CronField) => tool.querySelector<HTMLElement>(`[data-field="${field}"]`)!;
  const setField = (field: CronField, written: string, detail: string, invalid: boolean) => {
    const item = row(field);
    item.querySelector("[data-written]")!.textContent = written;
    item.querySelector("[data-detail]")!.textContent = detail;
    item.toggleAttribute("data-invalid", invalid);
  };

  const update = () => {
    const zone = (tool.querySelector<HTMLInputElement>('[name="zone"]:checked')?.value ?? "utc") as CronZone;
    const result = parseCron(input.value);
    runsBody.replaceChildren();
    never.hidden = true;
    runsSection.hidden = !("schedule" in result);
    status.toggleAttribute("data-invalid", !("schedule" in result));
    input.setAttribute("aria-invalid", String(!("schedule" in result)));

    if ("error" in result) {
      status.textContent =
        result.error === "empty" ? message("errorBlank") : fill(message("errorCount"), { count: result.count });
      for (const field of cronFields) setField(field, "", "", false);
      return;
    }
    if ("errors" in result) {
      status.textContent = message("errorFields");
      for (const field of cronFields) {
        const error = result.errors.find((item) => item.field === field);
        const detail = error ? fill(message(errorKeys[error.reason]), { ...error }) : "";
        setField(field, result.source[field] ?? "", detail, error !== undefined);
      }
      return;
    }

    const { schedule } = result;
    status.textContent = describeCron(schedule, messages, names);
    for (const field of cronFields) {
      const values = schedule.values[field];
      const label = (value: number) =>
        field === "month"
          ? (names.months[value - 1] ?? "")
          : field === "dayOfWeek"
            ? (names.days[value] ?? "")
            : String(value);
      const every =
        schedule.source[field] === "*"
          ? message("every")
          : list.format(runs(values).map(([from, to]) => (from === to ? label(from) : `${label(from)}–${label(to)}`)));
      setField(field, schedule.source[field], every, false);
    }
    const upcoming = nextRuns(schedule, new Date(), 5, zone);
    never.hidden = upcoming.length > 0;
    for (const run of upcoming) {
      const tr = document.createElement("tr");
      for (const text of [local.format(run), utc.format(run)]) {
        const cell = document.createElement("td");
        cell.textContent = text;
        tr.append(cell);
      }
      runsBody.append(tr);
    }
  };

  for (const example of tool.querySelectorAll<HTMLButtonElement>("[data-example]")) {
    example.addEventListener("click", () => {
      input.value = example.dataset["example"] ?? "";
      update();
    });
  }
  tool.addEventListener("input", update);
  tool.addEventListener("change", update);
  update();
};
