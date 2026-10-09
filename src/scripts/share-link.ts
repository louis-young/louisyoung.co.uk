import { decodeShareState, encodeShareState, shareUrl, type ShareState } from "../lib/share-state";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** The inputs a tool shares, each marked `data-share="<key>"`. Radios in a group share a key. */
const controls = (root: ParentNode) => [...root.querySelectorAll<Control>("[data-share]")];

const kind = (control: Control) =>
  control instanceof HTMLInputElement && (control.type === "radio" || control.type === "checkbox")
    ? control.type
    : "value";

/** Reads every shared input: text as strings, checkboxes as booleans, a radio group as its value. */
export const readShareState = (root: ParentNode = document): ShareState => {
  const state: ShareState = {};
  for (const control of controls(root)) {
    const key = control.dataset["share"] ?? "";
    const type = kind(control);
    if (type === "radio") {
      if ((control as HTMLInputElement).checked) state[key] = control.value;
    } else if (type === "checkbox") state[key] = (control as HTMLInputElement).checked;
    else state[key] = control.value;
  }
  return state;
};

/**
 * Puts shared values back into the inputs, then fires `input` and `change` so the tool updates as
 * if they had been typed. Only `.value` and `.checked` are ever set, so a crafted link can't
 * inject markup; keys the page doesn't have and values of the wrong type are ignored. Returns
 * whether anything was restored.
 */
export const applyShareState = (state: ShareState, root: ParentNode = document) => {
  const changed: Control[] = [];
  for (const control of controls(root)) {
    const value = state[control.dataset["share"] ?? ""];
    const type = kind(control);
    if (type === "checkbox") {
      if (typeof value !== "boolean") continue;
      (control as HTMLInputElement).checked = value;
    } else {
      if (typeof value !== "string") continue;
      if (type === "radio") {
        if (control.value !== value) continue;
        (control as HTMLInputElement).checked = true;
      } else if (control instanceof HTMLSelectElement) {
        if (![...control.options].some((option) => option.value === value)) continue;
        control.value = value;
      } else control.value = value;
    }
    changed.push(control);
  }
  for (const control of changed) {
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return changed.length > 0;
};

/**
 * The "Copy share link" button (`ShareLink.astro`). Call it after the tool itself has started, so
 * the inputs restored from the link's fragment update the tool. The state only ever lives in the
 * fragment: see `src/lib/share-state.ts` for why it must never go in the query string.
 */
export const initShareLink = (root: Document = document) => {
  const button = root.querySelector<HTMLButtonElement>("[data-share-link]");
  const status = root.querySelector<HTMLElement>("[data-share-status]");
  if (!button || !status) return;
  const say = (key: string, error = false) => {
    status.textContent = button.dataset[key] ?? "";
    status.toggleAttribute("data-error", error);
  };

  const restored = decodeShareState(window.location.hash);
  if (restored && applyShareState(restored, root)) say("restored");

  const share = async () => {
    const result = encodeShareState(readShareState(root));
    if (!result.ok) {
      say("tooLong", true);
      return;
    }
    // The address bar shows the link too, for anyone who'd rather copy it from there.
    history.replaceState(history.state, "", result.hash);
    try {
      await navigator.clipboard.writeText(shareUrl(window.location.href, result.hash));
      say("copied");
    } catch {
      say("manual");
    }
  };
  button.addEventListener("click", () => {
    void share();
  });
};
