/** The `data-key` a keypress lights: ⌘ and Ctrl share one key cap, letters ignore case. */
export const keyName = (key: string) => (key === "Meta" || key === "Control" ? "mod" : key.toLowerCase());

/** How long a key cap stays lit after its key goes down. */
const LIT_MS = 260;

/**
 * Lights up the `<kbd data-key>` caps that match each keypress, briefly. Display only: the
 * shortcuts themselves live in shortcuts.ts.
 */
export const initKeyLight = (signal?: AbortSignal) => {
  const caps = document.querySelectorAll<HTMLElement>("kbd[data-key]");
  if (caps.length === 0) return;
  const timers = new Map<HTMLElement, number>();
  document.addEventListener(
    "keydown",
    (event) => {
      const name = keyName(event.key);
      for (const cap of caps) {
        if (cap.dataset["key"] !== name) continue;
        cap.dataset["lit"] = "";
        window.clearTimeout(timers.get(cap));
        timers.set(
          cap,
          window.setTimeout(() => {
            delete cap.dataset["lit"];
          }, LIT_MS),
        );
      }
    },
    { signal } as AddEventListenerOptions,
  );
};
