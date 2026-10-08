interface LazyOpener {
  (): void;
  /** Starts loading without opening, e.g. when the pointer or focus reaches an opener. */
  warm: () => void;
}

/**
 * Wraps a dialog's code so it loads on first use. Returns an opener that imports and
 * initialises the dialog once, then opens it on every call.
 */
export const lazyOpener = (load: () => Promise<() => void>): LazyOpener => {
  let ready: Promise<() => void> | undefined;
  const warm = () => {
    ready ??= load();
    return ready;
  };
  const open = () => {
    void warm().then((show) => {
      show();
    });
  };
  return Object.assign(open, { warm: () => void warm() });
};

/**
 * Makes every element matching `selector` open the dialog on click, and start loading its code
 * as soon as the pointer or keyboard focus reaches it, so the click rarely has to wait.
 */
export const bindOpeners = (selector: string, open: LazyOpener, signal?: AbortSignal) => {
  const options = { signal } as AddEventListenerOptions;
  for (const opener of document.querySelectorAll(selector)) {
    opener.addEventListener("click", open, options);
    opener.addEventListener("pointerenter", open.warm, options);
    opener.addEventListener("focus", open.warm, options);
  }
};
