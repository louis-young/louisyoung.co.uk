// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { initSemver } from "../../src/scripts/tool-semver";

afterEach(() => {
  document.body.innerHTML = "";
});

const messages = {
  describe: "Matches {description}.",
  "at-least": "at least {version}",
  above: "above {version}",
  "at-most": "at most {version}",
  below: "below {version}",
  exactly: "exactly {version}",
  any: "any version",
  none: "no version",
  or: ", or ",
  count: "{count} of {total} match",
  "no-versions": "Add versions.",
  "no-match": "None",
  match: "Matches",
  miss: "No match",
  prerelease: "Pre-release excluded",
  invalid: "Not a valid version",
  "error-empty": "Type a range.",
  "error-syntax": "“{token}” is wrong.",
};

const setup = (range: string, versions: string) => {
  const attributes = Object.entries(messages)
    .map(([key, text]) => `data-${key}="${text}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-semver ${attributes}>
      <input data-range value="${range}" />
      <button type="button" data-example="~1.2">~1.2</button>
      <textarea data-versions>${versions}</textarea>
      <p data-status></p>
      <div data-facts><code data-expanded></code><p data-highest></p></div>
      <section data-results-section><p data-count-status></p><ul data-results></ul></section>
    </div>`;
  initSemver();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const results = () =>
    [...document.querySelectorAll<HTMLElement>("[data-results] li")].map((item) => [
      item.querySelector("code")?.textContent,
      item.dataset["result"],
      item.querySelector(".semver__badge")?.textContent,
    ]);
  const type = (selector: string, value: string) => {
    const input = get(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return { get, results, type };
};

describe("semver range checker", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initSemver();
    }).not.toThrow();
  });

  it("explains the range, checks each version and finds the highest match", () => {
    const { get, results } = setup("^1.2.3 || 3.0.0", "1.2.2\n1.4.0\n1.9.9-rc.1\nv1.10.1\nlatest");
    expect(get("[data-status]").textContent).toBe("Matches at least 1.2.3 and below 2.0.0, or exactly 3.0.0.");
    expect(get("[data-range]").getAttribute("aria-invalid")).toBe("false");
    expect(get("[data-expanded]").textContent).toBe(">=1.2.3 <2.0.0 || 3.0.0");
    expect(get("[data-highest]").textContent).toBe("v1.10.1");
    expect(get("[data-count-status]").textContent).toBe("2 of 5 match");
    expect(results()).toEqual([
      ["1.2.2", "miss", "No match"],
      ["1.4.0", "match", "Matches"],
      ["1.9.9-rc.1", "prerelease", "Pre-release excluded"],
      ["v1.10.1", "match", "Matches"],
      ["latest", "invalid", "Not a valid version"],
    ]);
  });

  it("says when nothing matches or there’s nothing to check", () => {
    const { get, type } = setup("^2", "1.0.0");
    expect(get("[data-highest]").textContent).toBe("None");
    expect(get("[data-count-status]").textContent).toBe("0 of 1 match");
    type("[data-versions]", "\n  \n");
    expect(get("[data-count-status]").textContent).toBe("Add versions.");
  });

  it("flags a bad or blank range and hides the results", () => {
    const { get, type } = setup("^1 || banana", "1.0.0");
    expect(get("[data-status]").textContent).toBe("“banana” is wrong.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    expect(get("[data-range]").getAttribute("aria-invalid")).toBe("true");
    expect(get("[data-facts]").hidden).toBe(true);
    expect(get("[data-results-section]").hidden).toBe(true);
    type("[data-range]", "");
    expect(get("[data-status]").textContent).toBe("Type a range.");
    type("[data-range]", "*");
    expect(get("[data-status]").textContent).toBe("Matches any version.");
    expect(get("[data-results-section]").hidden).toBe(false);
  });

  it("fills in an example", () => {
    const { get } = setup("", "1.2.9");
    get("[data-example]").click();
    expect((get("[data-range]") as HTMLInputElement).value).toBe("~1.2");
    expect(get("[data-status]").textContent).toBe("Matches at least 1.2.0 and below 1.3.0.");
  });
});
