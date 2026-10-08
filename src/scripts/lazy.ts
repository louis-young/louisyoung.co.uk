/**
 * Wraps a dialog's code so it loads on first use. Returns an opener that imports and
 * initialises the dialog once, then opens it on every call.
 */
export const lazyOpener = (load: () => Promise<() => void>) => {
  let ready: Promise<() => void> | undefined;
  return () => {
    ready ??= load();
    void ready.then((open) => {
      open();
    });
  };
};

/** Makes every element matching `selector` (now or never added later) call `open` when clicked. */
export const bindOpeners = (selector: string, open: () => void, signal?: AbortSignal) => {
  for (const opener of document.querySelectorAll(selector)) {
    opener.addEventListener("click", open, { signal } as AddEventListenerOptions);
  }
};
