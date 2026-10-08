import { sameOriginPath } from "../lib/palette";
import { complete, runCommand, type TerminalContext } from "../lib/terminal";
import { cycleTheme } from "./theme";

/**
 * The site terminal: a modal `<dialog>` with a live log and one input. Commands run through
 * the pure engine in `src/lib/terminal.ts`; this only renders lines and carries out effects.
 */
export const initTerminal = (signal?: AbortSignal) => {
  const options = { signal } as AddEventListenerOptions;
  const dialog = document.querySelector<HTMLDialogElement>("#terminal");
  const form = dialog?.querySelector<HTMLFormElement>("[data-terminal-form]");
  const input = dialog?.querySelector<HTMLInputElement>("input");
  const log = dialog?.querySelector<HTMLElement>("[data-terminal-log]");
  const screen = dialog?.querySelector<HTMLElement>("[data-terminal-screen]");
  if (!dialog || !form || !input || !log || !screen) return () => undefined;

  const context = JSON.parse(dialog.dataset["context"] ?? "{}") as TerminalContext;
  const history: string[] = [];
  let cursor = 0;

  const print = (text: string, variant?: "command" | "muted") => {
    const line = document.createElement("p");
    line.className = variant ? `terminal__line terminal__line--${variant}` : "terminal__line";
    line.textContent = text;
    log.append(line);
  };

  const execute = async (raw: string) => {
    print(raw, "command");
    if (raw.trim()) history.push(raw);
    cursor = history.length;
    const { lines, effect } = runCommand(raw, context);
    for (const line of lines) print(line);
    screen.scrollTop = screen.scrollHeight;
    if (!effect) return;
    if (effect.type === "clear") log.replaceChildren();
    if (effect.type === "close") dialog.close();
    if (effect.type === "theme") cycleTheme();
    if (effect.type === "copy") {
      try {
        await navigator.clipboard.writeText(effect.value);
      } catch {
        /* The address is printed either way. */
      }
    }
    if (effect.type === "navigate") {
      const href = sameOriginPath(effect.href, window.location.origin);
      if (href) window.location.assign(href);
    }
  };

  const open = () => {
    if (dialog.open) return;
    dialog.showModal();
    input.focus();
  };

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const value = input.value;
      input.value = "";
      void execute(value);
    },
    options,
  );

  input.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Tab" && input.value) {
        event.preventDefault();
        input.value = complete(input.value, context);
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        if (history.length === 0) return;
        event.preventDefault();
        cursor = Math.min(history.length, Math.max(0, cursor + (event.key === "ArrowUp" ? -1 : 1)));
        input.value = history[cursor] ?? "";
      } else if (event.key === "l" && event.ctrlKey) {
        event.preventDefault();
        log.replaceChildren();
      }
    },
    options,
  );

  // Clicking anywhere on the screen puts the caret back in the prompt, like a real terminal.
  screen.addEventListener(
    "click",
    () => {
      if (!window.getSelection()?.toString()) input.focus();
    },
    options,
  );
  dialog.addEventListener(
    "click",
    (event) => {
      if (event.target === dialog || (event.target as Element).closest("[data-terminal-close]")) dialog.close();
    },
    options,
  );
  return open;
};
