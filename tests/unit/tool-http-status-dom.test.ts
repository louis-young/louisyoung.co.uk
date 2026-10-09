// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { initHttpStatus } from "../../src/scripts/tool-http-status";

afterEach(() => {
  document.body.innerHTML = "";
});

const codes = [
  [200, "OK The request succeeded."],
  [301, "Moved Permanently The resource has moved for good."],
  [404, "Not Found The server has nothing at this URL."],
  [410, "Gone The resource has been removed for good."],
] as const;

const setup = () => {
  document.body.innerHTML = `
    <div data-http data-count-none="None" data-count-one="1 code" data-count-other="{count} codes">
      <input data-search />
      ${["all", "2", "3", "4"].map((value) => `<input type="radio" name="http-class" value="${value}" ${value === "all" ? "checked" : ""} />`).join("")}
      <p data-status></p>
      ${[2, 3, 4]
        .map(
          (group) => `<section data-group="${group}"><ul>
            ${codes
              .filter(([code]) => Math.floor(code / 100) === group)
              .map(([code, text]) => `<li data-code="${code}">${code} ${text}</li>`)
              .join("")}
          </ul></section>`,
        )
        .join("")}
    </div>`;
  initHttpStatus();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const visible = () =>
    [...document.querySelectorAll<HTMLElement>("[data-code]")]
      .filter((item) => !item.hidden)
      .map((item) => Number(item.dataset["code"]));
  const search = (value: string) => {
    const input = get("[data-search]") as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const pick = (value: string) => {
    const radio = get(`[name="http-class"][value="${value}"]`) as HTMLInputElement;
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  };
  return { get, visible, search, pick };
};

describe("HTTP status reference", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initHttpStatus();
    }).not.toThrow();
  });

  it("shows every code and counts them", () => {
    const { get, visible } = setup();
    expect(visible()).toEqual([200, 301, 404, 410]);
    expect(get("[data-status]").textContent).toBe("4 codes");
  });

  it("filters by number or words and hides empty groups", () => {
    const { get, visible, search } = setup();
    search("4");
    expect(visible()).toEqual([404, 410]);
    expect(get('[data-group="2"]').hidden).toBe(true);
    expect(get('[data-group="4"]').hidden).toBe(false);
    search("for good");
    expect(visible()).toEqual([301, 410]);
    search("nothing");
    expect(visible()).toEqual([404]);
    expect(get("[data-status]").textContent).toBe("1 code");
    search("teapot");
    expect(visible()).toEqual([]);
    expect(get("[data-status]").textContent).toBe("None");
  });

  it("filters by class, together with the search", () => {
    const { visible, search, pick } = setup();
    pick("3");
    expect(visible()).toEqual([301]);
    search("good");
    expect(visible()).toEqual([301]);
    pick("4");
    expect(visible()).toEqual([410]);
    pick("all");
    expect(visible()).toEqual([301, 410]);
  });
});
