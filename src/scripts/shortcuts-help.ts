/**
 * The keyboard shortcuts dialog (`?`): a native modal `<dialog>` rendered at build time. This
 * only opens it, focuses its close button and closes it on a backdrop or close-button click.
 * The browser traps focus while it is open and hands it back to the opener when it closes.
 */
export const initShortcutsHelp = (signal?: AbortSignal) => {
  const dialog = document.querySelector<HTMLDialogElement>("#shortcuts-help");
  if (!dialog) return () => undefined;

  dialog.addEventListener(
    "click",
    (event) => {
      if (event.target === dialog || (event.target as Element).closest("[data-shortcuts-close]")) dialog.close();
    },
    { signal } as AddEventListenerOptions,
  );

  return () => {
    if (dialog.open) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-shortcuts-close]")?.focus();
  };
};
