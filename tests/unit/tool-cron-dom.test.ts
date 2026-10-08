// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initCron } from "../../src/scripts/tool-cron";

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

const messages = {
  at: "At {times}",
  "every-minute": "Every minute",
  "every-minutes": "Every {step} minutes",
  "minute-one": "At minute {list}",
  "minute-other": "At minutes {list}",
  during: "during {list}",
  "day-one": "on day {list} of the month",
  "day-other": "on days {list} of the month",
  months: "in {list}",
  days: "on {list}",
  weekdays: "on weekdays",
  weekends: "at weekends",
  either: "{first} or {second}",
  every: "Every value",
  "error-blank": "Type one.",
  "error-count": "Needs five; this has {count}.",
  "error-fields": "Fix the fields.",
  "error-empty": "Empty item.",
  "error-syntax": "“{value}” is wrong.",
  "error-range": "“{value}” is outside {min} to {max}.",
  "error-order": "“{value}” runs backwards.",
  "error-step": "“{value}” needs a step.",
};

const fields = ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"];

const setup = (value: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T10:20:00Z"));
  const attributes = Object.entries(messages)
    .map(([key, text]) => `data-${key}="${text}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-cron ${attributes}>
      <input data-input value="${value}" />
      <button type="button" data-example="@daily">@daily</button>
      <input type="radio" name="zone" value="utc" checked />
      <input type="radio" name="zone" value="local" />
      <p data-status></p>
      <table><tbody>
        ${fields.map((field) => `<tr data-field="${field}"><th></th><td><code data-written></code></td><td data-detail></td></tr>`).join("")}
      </tbody></table>
      <section data-runs-section>
        <p data-never hidden></p>
        <span data-zone-name></span>
        <table><tbody data-runs></tbody></table>
      </section>
    </div>`;
  initCron();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const detail = (field: string) => get(`[data-field="${field}"] [data-detail]`).textContent;
  const written = (field: string) => get(`[data-field="${field}"] [data-written]`).textContent;
  const runs = () => [...document.querySelectorAll("[data-runs] tr")].map((row) => row.lastElementChild?.textContent);
  return { get, detail, written, runs, input: get("[data-input]") as HTMLInputElement };
};

const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("cron explainer", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initCron();
    }).not.toThrow();
  });

  it("describes the schedule, breaks down each field and lists the next runs", () => {
    const { get, detail, written, runs, input } = setup("0 9 * * 1-5");
    expect(get("[data-status]").textContent).toBe("At 09:00 on weekdays");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(written("dayOfWeek")).toBe("1-5");
    expect(detail("dayOfWeek")).toBe("Monday–Friday");
    expect(detail("hour")).toBe("9");
    expect(detail("month")).toBe("Every value");
    expect(get("[data-zone-name]").textContent).toMatch(/^\(.+\)$/u);
    // ICU versions differ on the comma after the weekday.
    expect(runs()).toHaveLength(5);
    expect(runs()[0]).toMatch(/^Fri,? 9 Oct 2026, 09:00$/u);
    expect(runs()[1]).toMatch(/^Mon,? 12 Oct 2026, 09:00$/u);
    expect(get("[data-never]").hidden).toBe(true);
  });

  it("names months and lists values", () => {
    const { detail } = setup("0,30 12 1 jan,jul *");
    expect(detail("month")).toBe("January and July");
    expect(detail("minute")).toBe("0 and 30");
  });

  it("reads the schedule in local time when asked", () => {
    const { get, runs } = setup("0 9 * * *");
    const local = get('[name="zone"][value="local"]') as HTMLInputElement;
    local.checked = true;
    local.dispatchEvent(new Event("change", { bubbles: true }));
    expect(runs()).toHaveLength(5);
  });

  it("says when a schedule never runs", () => {
    const { get, runs } = setup("0 0 30 2 *");
    expect(get("[data-never]").hidden).toBe(false);
    expect(runs()).toEqual([]);
  });

  it("explains each invalid field", () => {
    const { get, detail, written, input } = setup("61 17-9 * * mon,");
    expect(get("[data-status]").textContent).toBe("Fix the fields.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(detail("minute")).toBe("“61” is outside 0 to 59.");
    expect(detail("hour")).toBe("“17-9” runs backwards.");
    expect(detail("dayOfWeek")).toBe("Empty item.");
    expect(detail("month")).toBe("");
    expect(written("hour")).toBe("17-9");
    expect(get('[data-field="minute"]').hasAttribute("data-invalid")).toBe(true);
    expect(get("[data-runs-section]").hidden).toBe(true);
    type(input, "*/0 x * * *");
    expect(detail("minute")).toBe("“*/0” needs a step.");
    expect(detail("hour")).toBe("“x” is wrong.");
  });

  it("counts fields and prompts for blank input", () => {
    const { get, input, written } = setup("* * *");
    expect(get("[data-status]").textContent).toBe("Needs five; this has 3.");
    expect(written("minute")).toBe("");
    type(input, " ");
    expect(get("[data-status]").textContent).toBe("Type one.");
  });

  it("fills in an example", () => {
    const { get, input } = setup("");
    get("[data-example]").click();
    expect(input.value).toBe("@daily");
    expect(get("[data-status]").textContent).toBe("At 00:00");
  });
});
