// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import type { IdSource } from "../../src/lib/uuid-tool";
import { initUuid } from "../../src/scripts/tool-uuid";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const messages = {
  copied: "Copied",
  "generated-v4-one": "{count} v4 UUID.",
  "generated-v4-other": "{count} v4 UUIDs.",
  "generated-v7-one": "{count} v7 UUID.",
  "generated-v7-other": "{count} v7 UUIDs.",
  "generated-ulid-one": "{count} ULID.",
  "generated-ulid-other": "{count} ULIDs.",
  "inspect-empty": "Paste one.",
  "inspect-invalid": "Not an ID.",
  "inspect-overflow": "Too big.",
  "status-uuid": "A UUID.",
  "status-ulid": "A ULID.",
  "status-nil": "Nil.",
  "status-max": "Max.",
  "kind-uuid": "UUID",
  "kind-ulid": "ULID",
  "variant-ncs": "NCS",
  "variant-rfc": "RFC",
  "variant-microsoft": "Microsoft",
  "variant-future": "Future",
  version1: "1 (time)",
  version4: "4 (random)",
  version7: "7 (Unix time)",
  "version-unknown": "{version} (unknown)",
};

const rowKeys = ["kind", "version", "variant", "time", "uuid", "ulid"];

/** Bytes that count up from 0, and a fixed time. */
const source = (): IdSource => {
  let next = 0;
  return { now: () => 1_760_000_000_000, random: (length) => Uint8Array.from({ length }, () => next++ % 256) };
};

const setup = (inspect = "") => {
  const attributes = Object.entries(messages)
    .map(([key, value]) => `data-${key}="${value}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-uuid ${attributes}>
      <input type="radio" name="k" value="v4" checked data-kind />
      <input type="radio" name="k" value="v7" data-kind />
      <input type="radio" name="k" value="ulid" data-kind />
      <input type="number" value="3" data-count />
      <input type="checkbox" data-uppercase />
      <button disabled data-generate>Generate</button>
      <button disabled data-copy-all><span data-copy-label>Copy all</span></button>
      <textarea data-output></textarea>
      <p data-status></p>
      <input data-inspect value="${inspect}" />
      <p data-inspect-status></p>
      <dl>${rowKeys.map((key) => `<div data-row="${key}"><dd><code data-value></code></dd></div>`).join("")}</dl>
    </div>`;
  initUuid(document, source());
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const input = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;
  const lines = () => document.querySelector<HTMLTextAreaElement>("[data-output]")!.value.split("\n");
  const choose = (value: string) => {
    const radio = input(`[data-kind][value="${value}"]`);
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const type = (value: string) => {
    input("[data-inspect]").value = value;
    input("[data-inspect]").dispatchEvent(new Event("input", { bubbles: true }));
  };
  const rows = () => {
    const shown: Record<string, string> = {};
    for (const row of document.querySelectorAll<HTMLElement>("[data-row]")) {
      if (!row.hidden) shown[row.dataset["row"] ?? ""] = row.querySelector("[data-value]")!.textContent;
    }
    return shown;
  };
  return { get, input, lines, choose, type, rows };
};

describe("UUID tool", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initUuid();
    }).not.toThrow();
  });

  it("generates IDs on load and enables its buttons", () => {
    const { get, lines } = setup();
    expect(lines()).toEqual([
      "00010203-0405-4607-8809-0a0b0c0d0e0f",
      "10111213-1415-4617-9819-1a1b1c1d1e1f",
      "20212223-2425-4627-a829-2a2b2c2d2e2f",
    ]);
    expect(get("[data-status]").textContent).toBe("3 v4 UUIDs.");
    expect(document.querySelector<HTMLButtonElement>("[data-generate]")!.disabled).toBe(false);
    expect(document.querySelector<HTMLButtonElement>("[data-copy-all]")!.disabled).toBe(false);
  });

  it("switches kind, case and count", () => {
    const { get, input, lines, choose } = setup();
    choose("v7");
    expect(lines().every((line) => line.startsWith("0199c82c-c000-7"))).toBe(true);
    expect(get("[data-status]").textContent).toBe("3 v7 UUIDs.");
    input("[data-uppercase]").checked = true;
    input("[data-uppercase]").dispatchEvent(new Event("change", { bubbles: true }));
    expect(lines()[0]).toMatch(/^0199C82C-C000-7[0-9A-F]{3}-/u);
    choose("ulid");
    expect(lines()[0]).toMatch(/^01K742SG00[0-9A-HJKMNP-TV-Z]{16}$/u);
    input("[data-count]").value = "1";
    input("[data-count]").dispatchEvent(new Event("change", { bubbles: true }));
    expect(lines()).toHaveLength(1);
    expect(get("[data-status]").textContent).toBe("1 ULID.");
    input("[data-count]").value = "5000";
    input("[data-count]").dispatchEvent(new Event("change", { bubbles: true }));
    expect(input("[data-count]").value).toBe("1000");
    expect(lines()).toHaveLength(1000);
    expect(get("[data-status]").textContent).toBe("1,000 ULIDs.");
  });

  it("generates more on demand and copies them", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get, lines } = setup();
    const first = lines();
    get("[data-generate]").click();
    expect(lines()).not.toEqual(first);
    get("[data-copy-all]").click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(lines().join("\n"));
    });
  });

  it("uses crypto.getRandomValues by default", () => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(255) });
    document.body.innerHTML = `
      <div data-uuid data-generated-v4-other="{count}">
        <input type="radio" value="v4" checked data-kind /><input type="number" value="2" data-count />
        <input type="checkbox" data-uppercase /><button data-generate></button><button data-copy-all></button>
        <textarea data-output></textarea><p data-status></p>
        <input data-inspect /><p data-inspect-status></p>
      </div>`;
    initUuid();
    expect(document.querySelector<HTMLTextAreaElement>("[data-output]")!.value).toBe(
      "ffffffff-ffff-4fff-bfff-ffffffffffff\nffffffff-ffff-4fff-bfff-ffffffffffff",
    );
  });

  it("inspects UUIDs and ULIDs", () => {
    const { get, type, rows } = setup("0199c82c-c000-7a3b-9c4d-5e6f7a8b9c0d");
    expect(get("[data-inspect-status]").textContent).toBe("A UUID.");
    expect(rows()).toEqual({
      kind: "UUID",
      version: "7 (Unix time)",
      variant: "RFC",
      time: "2025-10-09T08:53:20.000Z",
      uuid: "0199c82c-c000-7a3b-9c4d-5e6f7a8b9c0d",
    });
    type("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(get("[data-inspect-status]").textContent).toBe("A ULID.");
    expect(rows()).toEqual({
      kind: "ULID",
      time: "2016-07-30T23:54:10.259Z",
      uuid: "01563e3a-b5d3-d676-4c61-efb99302bd5b",
      ulid: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    });
    type("f47ac10b-58cc-4372-a567-0e02b2c3d479");
    expect(rows()).toMatchObject({ version: "4 (random)" });
    expect(rows()).not.toHaveProperty("time");
    type("00000000-0000-0000-0000-000000000000");
    expect(get("[data-inspect-status]").textContent).toBe("Nil.");
    expect(rows()).toEqual({ kind: "UUID", uuid: "00000000-0000-0000-0000-000000000000" });
    type("00000000-0000-9000-8000-000000000001");
    expect(rows()).toMatchObject({ version: "9 (unknown)" });
    type("00000000-0000-1000-c000-000000000001");
    expect(rows()).toMatchObject({ variant: "Microsoft" });
    expect(rows()).not.toHaveProperty("version");
  });

  it("explains what it can’t inspect", () => {
    const { get, input, type, rows } = setup("nope");
    expect(get("[data-inspect-status]").textContent).toBe("Not an ID.");
    expect(get("[data-inspect-status]").hasAttribute("data-invalid")).toBe(true);
    expect(input("[data-inspect]").getAttribute("aria-invalid")).toBe("true");
    expect(rows()).toEqual({});
    type("8ZZZZZZZZZZZZZZZZZZZZZZZZZ");
    expect(get("[data-inspect-status]").textContent).toBe("Too big.");
    type("");
    expect(get("[data-inspect-status]").textContent).toBe("Paste one.");
    expect(input("[data-inspect]").getAttribute("aria-invalid")).toBe("false");
  });
});
