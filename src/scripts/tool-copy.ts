/**
 * Copies `text` and swaps the button’s `[data-copy-label]` (or the button’s own text) to `copied`
 * for a moment. A blocked clipboard is ignored: selecting the value by hand still works.
 */
export const copyText = async (button: HTMLElement, text: string, copied: string) => {
  const label = button.querySelector<HTMLElement>("[data-copy-label]") ?? button;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return;
  }
  const original = label.dataset["original"] ?? label.textContent;
  label.dataset["original"] = original;
  label.textContent = copied;
  setTimeout(() => {
    label.textContent = original;
  }, 1500);
};
