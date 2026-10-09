// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initChmod } from "../../src/scripts/tool-chmod";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const messages = {
  copied: "Copied",
  owner: "Owner",
  group: "Group",
  other: "Others",
  read: "read",
  write: "write",
  execute: "execute",
  setuid: "Setuid",
  setgid: "Setgid",
  sticky: "Sticky",
  can: "{who} can {list}.",
  nothing: "{who} can’t do anything.",
  "special-on": "Special bits: {list}.",
  "octal-hint": "Three or four digits.",
  "symbolic-hint": "Nine characters.",
  "error-octal": "Bad octal.",
  "error-symbolic": "Bad symbolic.",
};

const bits = [0o400, 0o200, 0o100, 0o40, 0o20, 0o10, 0o4, 0o2, 0o1, 0o4000, 0o2000, 0o1000];

const setup = (mode = 0o755) => {
  const attributes = Object.entries(messages)
    .map(([key, text]) => `data-${key}="${text}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-chmod ${attributes}>
      ${bits.map((bit) => `<input type="checkbox" data-bit="${bit}" ${mode & bit ? "checked" : ""} />`).join("")}
      ${["special", "owner", "group", "other"].map((name) => `<span data-digit="${name}"></span>`).join("")}
      <input data-octal value="" /><p data-octal-message></p>
      <input data-symbolic value="" /><p data-symbolic-message></p>
      <p data-status></p>
      <input data-file value="deploy.sh" />
      <code data-command></code>
      <button type="button" data-copy><span data-copy-label>Copy</span></button>
    </div>`;
  initChmod();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const input = (selector: string) => get(selector) as HTMLInputElement;
  const type = (selector: string, value: string) => {
    input(selector).value = value;
    input(selector).dispatchEvent(new Event("input", { bubbles: true }));
  };
  const toggle = (bit: number) => {
    const check = input(`[data-bit="${bit}"]`);
    check.checked = !check.checked;
    check.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const digits = () =>
    ["special", "owner", "group", "other"].map((name) => get(`[data-digit="${name}"]`).textContent).join("");
  return { get, input, type, toggle, digits };
};

describe("chmod calculator", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initChmod();
    }).not.toThrow();
  });

  it("starts from the ticked boxes", () => {
    const { get, input, digits } = setup();
    expect(input("[data-octal]").value).toBe("755");
    expect(input("[data-symbolic]").value).toBe("rwxr-xr-x");
    expect(digits()).toBe("0755");
    expect(get("[data-command]").textContent).toBe("chmod 755 deploy.sh");
    expect(get("[data-status]").textContent).toBe(
      "Owner can read, write and execute. Group can read and execute. Others can read and execute.",
    );
  });

  it("updates both text forms when a box is ticked", () => {
    const { get, input, toggle, digits } = setup();
    toggle(0o4000);
    toggle(0o1);
    toggle(0o4);
    expect(input("[data-octal]").value).toBe("4750");
    expect(input("[data-symbolic]").value).toBe("rwsr-x---");
    expect(digits()).toBe("4750");
    expect(get("[data-status]").textContent).toBe(
      "Owner can read, write and execute. Group can read and execute. Others can’t do anything. Special bits: Setuid.",
    );
  });

  it("reads octal into the boxes and the symbolic form", () => {
    const { input, type, get } = setup();
    type("[data-octal]", "1777");
    expect(input('[data-bit="512"]').checked).toBe(true);
    expect(input("[data-symbolic]").value).toBe("rwxrwxrwt");
    expect(input("[data-octal]").value).toBe("1777");
    type("[data-octal]", "79");
    expect(input("[data-octal]").getAttribute("aria-invalid")).toBe("true");
    expect(get("[data-octal-message]").textContent).toBe("Bad octal.");
    expect(get("[data-octal-message]").hasAttribute("data-invalid")).toBe(true);
    expect(input("[data-symbolic]").value).toBe("rwxrwxrwt");
    type("[data-octal]", "644");
    expect(get("[data-octal-message]").textContent).toBe("Three or four digits.");
    expect(input("[data-octal]").getAttribute("aria-invalid")).toBe("false");
  });

  it("reads symbolic into the boxes and octal", () => {
    const { input, type, get } = setup();
    type("[data-symbolic]", "-rw-r-----");
    expect(input("[data-octal]").value).toBe("640");
    expect(input('[data-bit="64"]').checked).toBe(false);
    type("[data-symbolic]", "rwz");
    expect(input("[data-symbolic]").getAttribute("aria-invalid")).toBe("true");
    expect(get("[data-symbolic-message]").textContent).toBe("Bad symbolic.");
    type("[data-symbolic]", "rwxrwsr-x");
    expect(input("[data-octal]").value).toBe("2775");
    expect(get("[data-status]").textContent).toContain("Special bits: Setgid.");
  });

  it("names the file in the command and copies it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get, type } = setup(0o600);
    type("[data-file]", "my key");
    expect(get("[data-command]").textContent).toBe("chmod 600 'my key'");
    get("[data-copy]").click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("chmod 600 'my key'");
    });
    expect(get("[data-copy-label]").textContent).toBe("Copied");
  });
});
