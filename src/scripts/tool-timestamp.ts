import { formatInZone, formatTimestamp, parseTimestamp, relativeTime } from "../lib/timestamp-tool";
import { copyText } from "./tool-copy";

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => values[name] ?? match);

const errorKeys = {
  empty: "errorEmpty",
  invalid: "errorInvalid",
  range: "errorRange",
  weekday: "errorWeekday",
} as const;

const relative = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

/** The timestamp converter on /tools/timestamp/. */
export const initTimestamp = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-timestamp]");
  if (!tool) return;
  const input = tool.querySelector<HTMLInputElement>("[data-input]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const results = tool.querySelector<HTMLElement>("[data-results]")!;
  const relativeOutput = tool.querySelector<HTMLElement>("[data-relative]")!;
  const message = (key: string) => tool.dataset[key] ?? "";
  const localZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localName = tool.querySelector<HTMLElement>("[data-local-zone]");
  if (localName) localName.textContent = `(${localZone})`;
  const value = (selector: string) => tool.querySelector<HTMLElement>(`${selector} [data-value]`)!;

  const update = () => {
    const result = parseTimestamp(input.value);
    const failed = "error" in result;
    input.setAttribute("aria-invalid", String(failed && result.error !== "empty"));
    status.toggleAttribute("data-invalid", failed);
    results.hidden = failed;
    if (failed) {
      status.textContent = message(errorKeys[result.error]);
      return;
    }
    const { date, format, assumedUtc } = result;
    const read = fill(message("readAs"), { format: message(format) });
    status.textContent = assumedUtc ? `${read} ${message("assumedUtc")}` : read;
    const formats = formatTimestamp(date);
    for (const key of ["seconds", "milliseconds", "iso", "rfc2822"] as const) {
      const text = formats[key];
      const row = tool.querySelector<HTMLElement>(`[data-format="${key}"]`)!;
      row.querySelector("[data-value]")!.textContent = text ?? message("unavailable");
      row.querySelector<HTMLButtonElement>("[data-copy]")!.disabled = text === undefined;
    }
    relativeOutput.textContent = relative.format(...relativeTime(date, new Date()));
    for (const row of tool.querySelectorAll<HTMLElement>("[data-zone]")) {
      const zone = row.dataset["zone"] === "local" ? localZone : (row.dataset["zone"] ?? "UTC");
      row.querySelector("[data-value]")!.textContent = formatInZone(date, zone);
    }
  };

  tool.querySelector("[data-now]")!.addEventListener("click", () => {
    input.value = String(Math.floor(Date.now() / 1000));
    update();
  });
  for (const button of tool.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    button.addEventListener("click", () => {
      const text = value(`[data-format="${button.dataset["copy"] ?? ""}"]`).textContent;
      void copyText(button, text, message("copied"));
    });
  }
  input.addEventListener("input", update);
  if (input.value.trim() === "") input.value = String(Math.floor(Date.now() / 1000));
  update();
};
