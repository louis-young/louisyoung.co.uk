// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TerminalContext } from "../../src/lib/terminal";

const context: TerminalContext = {
  articles: [{ slug: "hello-world", title: "Hello world", tags: ["intro"] }],
  pages: [{ name: "hire", href: "/hire/" }],
  email: "me@example.com",
  messages: {
    help: "Commands:",
    whoami: "Me",
    notFound: "{command}: not found",
    openUsage: "Usage",
    noMatch: "No match",
    opening: "Opening {title}",
    theme: "Theme",
    copied: "Copied {email}",
    sudo: "Nice try",
    searching: "Searching",
    lsUsage: "ls usage",
    noTag: "No tag",
    date: "{date}",
    echoUsage: "echo usage",
  },
  descriptions: {},
};

let controller = new AbortController();
let assign = vi.fn();
let opens = 0;

const lines = () => [...document.querySelectorAll("[data-terminal-log] p")].map((line) => line.textContent);
const input = () => document.querySelector<HTMLInputElement>("#terminal input")!;
const dialog = () => document.querySelector<HTMLDialogElement>("#terminal")!;

const run = (command: string) => {
  input().value = command;
  document.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
};

const key = (name: string, init: KeyboardEventInit = {}) =>
  input().dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...init }));

const init = async () => (await import("../../src/scripts/terminal")).initTerminal(controller.signal);

describe("terminal (DOM)", () => {
  beforeEach(() => {
    vi.resetModules();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() });
    document.body.innerHTML = `
      <button data-terminal-open>Open</button>
      <dialog id="terminal" data-context='${JSON.stringify(context)}'>
        <button data-terminal-close>Close</button>
        <div data-terminal-screen>
          <div data-terminal-log><p>Welcome</p></div>
          <form data-terminal-form><input /></form>
        </div>
      </dialog>`;
    const element = dialog();
    opens = 0;
    element.showModal = vi.fn(function (this: HTMLDialogElement) {
      opens += 1;
      this.setAttribute("open", "");
    });
    element.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    assign = vi.fn();
    vi.stubGlobal("location", { href: window.location.href, origin: window.location.origin, assign });
  });

  afterEach(() => {
    controller.abort();
    controller = new AbortController();
    vi.unstubAllGlobals();
  });

  it("returns a no-op without the markup", async () => {
    document.body.innerHTML = "";
    const open = await init();
    expect(() => {
      open();
    }).not.toThrow();
  });

  it("opens once from the returned function and focuses the prompt", async () => {
    const open = await init();
    open();
    expect(dialog().open).toBe(true);
    expect(document.activeElement).toBe(input());
    open();
    expect(opens).toBe(1);
  });

  it("echoes commands and prints their output", async () => {
    await init();
    run("whoami");
    expect(lines()).toEqual(["Welcome", "whoami", "Me"]);
    expect(document.querySelectorAll(".terminal__line--command")).toHaveLength(1);
    expect(input().value).toBe("");
  });

  it("recalls history with the arrow keys", async () => {
    await init();
    key("ArrowUp");
    expect(input().value).toBe("");
    run("whoami");
    run("echo hi");
    key("ArrowUp");
    expect(input().value).toBe("echo hi");
    key("ArrowUp");
    key("ArrowUp");
    expect(input().value).toBe("whoami");
    key("ArrowDown");
    key("ArrowDown");
    expect(input().value).toBe("");
  });

  it("completes with Tab and clears with Ctrl+L or clear", async () => {
    await init();
    input().value = "who";
    key("Tab");
    expect(input().value).toBe("whoami ");
    key("l", { ctrlKey: true });
    expect(lines()).toEqual([]);
    run("echo again");
    run("clear");
    expect(lines()).toEqual([]);
  });

  it("navigates, switches theme, copies and closes", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await init();
    dialog().showModal();
    run("open hello");
    expect(assign).toHaveBeenCalledWith("/hello-world/");
    run("theme");
    expect(document.documentElement.dataset["themePreference"]).toBe("light");
    run("email");
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("me@example.com");
    run("exit");
    expect(dialog().open).toBe(false);
  });

  it("still prints the address when the clipboard is unavailable", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    await init();
    run("email");
    await Promise.resolve();
    expect(lines()).toContain("Copied me@example.com");
  });

  it("closes on the close button or a backdrop click, and refocuses the prompt on screen clicks", async () => {
    await init();
    dialog().showModal();
    document.querySelector<HTMLElement>("[data-terminal-screen]")!.click();
    expect(document.activeElement).toBe(input());
    document.querySelector<HTMLButtonElement>("[data-terminal-close]")!.click();
    expect(dialog().open).toBe(false);
    dialog().showModal();
    dialog().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dialog().open).toBe(false);
  });
});
