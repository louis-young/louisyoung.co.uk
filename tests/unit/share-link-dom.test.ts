// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { encodeShareState, SHARE_PREFIX } from "../../src/lib/share-state";
import { applyShareState, initShareLink, readShareState } from "../../src/scripts/share-link";

afterEach(() => {
  document.body.innerHTML = "";
  history.replaceState(null, "", "/tools/regex/");
  vi.unstubAllGlobals();
});

const markup = `
  <div data-tool>
    <input data-share="pattern" value="a+" />
    <textarea data-share="text">aaa</textarea>
    <input type="checkbox" data-share="g" checked />
    <input type="radio" name="view" value="split" data-share="view" checked />
    <input type="radio" name="view" value="unified" data-share="view" />
    <select data-share="indent"><option value="2">2</option><option value="4">4</option></select>
    <output data-result></output>
  </div>
  <button type="button" disabled data-share-link data-copied="Copied" data-manual="Copy it by hand"
    data-too-long="Too long" data-restored="Restored"></button>
  <p role="status" data-share-status></p>`;

const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const field = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;
const area = (selector: string) => document.querySelector<HTMLTextAreaElement>(selector)!;
const choice = (selector: string) => document.querySelector<HTMLSelectElement>(selector)!;

const hashFor = (state: Parameters<typeof encodeShareState>[0]) => {
  const result = encodeShareState(state);
  if (!result.ok) throw new Error("too long");
  return result.hash;
};

/** Mirrors a tool that recalculates on input. */
const watchTool = () => {
  const seen = vi.fn();
  get("[data-tool]").addEventListener("input", seen);
  return seen;
};

describe("share link DOM helper", () => {
  it("reads text, checkboxes, the checked radio and selects", () => {
    document.body.innerHTML = markup;
    expect(readShareState()).toEqual({ pattern: "a+", text: "aaa", g: true, view: "split", indent: "2" });
  });

  it("restores values as plain values, never markup, and fires input events", () => {
    document.body.innerHTML = markup;
    const seen = watchTool();
    const restored = applyShareState({
      pattern: "<img src=x onerror=alert(1)>",
      text: "<b>bold</b>",
      g: false,
      view: "unified",
      indent: "4",
    });
    expect(restored).toBe(true);
    expect(field('[data-share="pattern"]').value).toBe("<img src=x onerror=alert(1)>");
    expect(area('[data-share="text"]').value).toBe("<b>bold</b>");
    expect(document.querySelector("img, b")).toBeNull();
    expect(field('[data-share="g"]').checked).toBe(false);
    expect(field('[value="unified"]').checked).toBe(true);
    expect(choice('[data-share="indent"]').value).toBe("4");
    expect(seen).toHaveBeenCalledTimes(5);
  });

  it("ignores unknown keys, wrong types, missing options and radios that don't exist", () => {
    document.body.innerHTML = markup;
    expect(applyShareState({ nope: "x", g: "yes", pattern: true, indent: "8", view: "sideways" })).toBe(false);
    expect(readShareState()).toEqual({ pattern: "a+", text: "aaa", g: true, view: "split", indent: "2" });
  });

  it("restores from the fragment on load and says so", () => {
    document.body.innerHTML = markup;
    history.replaceState(null, "", `/tools/regex/${hashFor({ pattern: "b+" })}`);
    initShareLink();
    expect(field('[data-share="pattern"]').value).toBe("b+");
    expect(get("[data-share-status]").textContent).toBe("Restored");
  });

  it("leaves the page alone for other fragments or malformed links", () => {
    document.body.innerHTML = markup;
    history.replaceState(null, "", `/tools/regex/${SHARE_PREFIX}!!!`);
    initShareLink();
    expect(field('[data-share="pattern"]').value).toBe("a+");
    expect(get("[data-share-status]").textContent).toBe("");
  });

  it("copies a link with the state in the fragment and puts it in the address bar", async () => {
    document.body.innerHTML = markup;
    history.replaceState(null, "", "/tools/regex/?ref=x");
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    initShareLink();
    field('[data-share="pattern"]').value = "c+";
    get("[data-share-link]").click();
    await vi.waitFor(() => {
      expect(get("[data-share-status]").textContent).toBe("Copied");
    });
    const hash = hashFor({ pattern: "c+", text: "aaa", g: true, view: "split", indent: "2" });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/tools/regex/${hash}`);
    expect(window.location.hash).toBe(hash);
    expect(window.location.search).toBe("?ref=x");
  });

  it("points at the address bar when the clipboard is blocked", async () => {
    document.body.innerHTML = markup;
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    initShareLink();
    get("[data-share-link]").click();
    await vi.waitFor(() => {
      expect(get("[data-share-status]").textContent).toBe("Copy it by hand");
    });
    expect(get("[data-share-status]").hasAttribute("data-error")).toBe(false);
  });

  it("explains when the inputs are too big for a link", () => {
    document.body.innerHTML = markup;
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    initShareLink();
    area('[data-share="text"]').value = "x".repeat(10_000);
    get("[data-share-link]").click();
    expect(get("[data-share-status]").textContent).toBe("Too long");
    expect(get("[data-share-status]").hasAttribute("data-error")).toBe(true);
    expect(writeText).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("keeps the button disabled until its click handler is attached", () => {
    document.body.innerHTML = markup;
    expect(get("[data-share-link]")).toHaveProperty("disabled", true);
    initShareLink();
    expect(get("[data-share-link]")).toHaveProperty("disabled", false);
  });

  it("does nothing on a page without the button", () => {
    document.body.innerHTML = `<input data-share="a" />`;
    expect(() => {
      initShareLink();
    }).not.toThrow();
  });
});
