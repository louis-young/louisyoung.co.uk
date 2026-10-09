import { markdownQuote, quoteUrl, type QuoteContext } from "../lib/text-fragment";

/** Selections touching these never get the toolbar: code has its own copy button. */
const excluded = "pre, .expressive-code, .demo, .sandbox, button, input, textarea, select";
/** Elements whose text is matched as one run by text fragments. */
const blocks = "p, li, h1, h2, h3, h4, h5, h6, blockquote, figcaption, td, th, dt, dd";
/** Rendered for assistive technology or decoration, not part of what the author wrote. */
const notQuoted = ".visually-hidden, [aria-hidden='true'], .heading-anchor";

const gap = 10;
/** Room for the selection handles touch browsers draw under the selected text. */
const touchGap = 30;
const margin = 8;
const copiedFor = 1600;

const elementOf = (node: Node) => (node instanceof Element ? node : node.parentElement);

const sameRange = (a: Range, b: Range) =>
  a.startContainer === b.startContainer &&
  a.startOffset === b.startOffset &&
  a.endContainer === b.endContainer &&
  a.endOffset === b.endOffset;

const textOfRange = (setup: (range: Range) => void) => {
  const range = document.createRange();
  setup(range);
  return range.toString();
};

/**
 * Shrinks a range to the text it selects. A triple-click, for one, selects a paragraph by
 * ending at the very start of whatever follows it, which may be a code block. Returns
 * undefined when the range selects no visible text.
 */
export const tighten = (range: Range): Range | undefined => {
  const root = range.commonAncestorContainer;
  if (root instanceof Text) return /\S/u.test(range.toString()) ? range.cloneRange() : undefined;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (!range.intersectsNode(text)) continue;
    const from = text === range.startContainer ? range.startOffset : 0;
    const to = text === range.endContainer ? range.endOffset : text.length;
    if (/\S/u.test(text.data.slice(from, to))) texts.push(text);
  }
  const first = texts[0];
  const last = texts.at(-1);
  if (!first || !last) return undefined;
  const tight = document.createRange();
  tight.setStart(first, first === range.startContainer ? range.startOffset : 0);
  tight.setEnd(last, last === range.endContainer ? range.endOffset : last.length);
  return tight;
};

/**
 * Reads the selection's text and the text around it in its first and last blocks, exactly as
 * the browser will search it when following the link.
 */
export const quoteContext = (range: Range, scope: Element): QuoteContext => {
  const blockOf = (node: Node) => elementOf(node)?.closest(blocks) ?? scope;
  const startBlock = blockOf(range.startContainer);
  const endBlock = blockOf(range.endContainer);
  const before = textOfRange((r) => {
    r.setStart(startBlock, 0);
    r.setEnd(range.startContainer, range.startOffset);
  });
  const after = textOfRange((r) => {
    r.setStart(range.endContainer, range.endOffset);
    r.setEnd(endBlock, endBlock.childNodes.length);
  });
  if (startBlock === endBlock) return { before, start: range.toString(), after };
  const start = textOfRange((r) => {
    r.setStart(range.startContainer, range.startOffset);
    r.setEnd(startBlock, startBlock.childNodes.length);
  });
  const end = textOfRange((r) => {
    r.setStart(endBlock, 0);
    r.setEnd(range.endContainer, range.endOffset);
  });
  // A triple-click selects a whole block and ends at the very start of the next one.
  if (!end.trim()) return { before, start, after: "" };
  return { before, start, end, after };
};

/** The selection as the reader sees it: one line per block, without hidden helper text. */
export const quoteText = (range: Range) => {
  const fragment = range.cloneContents();
  for (const node of fragment.querySelectorAll(notQuoted)) node.remove();
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    node.nodeValue = (node.nodeValue ?? "").replace(/\s+/gu, " ");
  }
  for (const block of fragment.querySelectorAll(blocks)) block.append("\n");
  return fragment.textContent.replace(/ *\n */gu, "\n").trim();
};

interface InitOptions {
  /** Whether the selection that loaded this module was made with the keyboard. */
  keyboard?: boolean;
  signal?: AbortSignal;
}

/**
 * The floating "Copy link to quote" / "Copy quote" toolbar. Loaded on the first selection inside
 * `scope` (see loadOnSelection), it follows the selection, stays out of code blocks, and can be
 * reached from the keyboard with Alt+Q, announced when text is selected with the keyboard.
 */
export const initQuoteShare = (scope: HTMLElement, { keyboard = false, signal }: InitOptions = {}) => {
  const toolbar = document.querySelector<HTMLElement>("[data-quote-toolbar]");
  if (!toolbar) return;
  const status = document.querySelector<HTMLElement>("[data-anchor-status]");
  const hint = document.querySelector<HTMLElement>("[data-quote-hint]");
  const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>("[data-quote-action]")];
  const options = { signal } as AddEventListenerOptions;

  let current: Range | undefined;
  let dismissed: Range | undefined;
  let returnFocus: HTMLElement | undefined;
  // The module may load mid-drag, after the pointerdown it would have seen.
  let pointerDown = document.querySelector(":active") !== null;
  let viaKeyboard = keyboard;
  let hinted = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const announce = (region: HTMLElement | null, message: string) => {
    if (!region) return;
    // Clear first so the same message is announced again.
    region.textContent = "";
    requestAnimationFrame(() => (region.textContent = message));
  };

  const selectedRange = () => {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return undefined;
    const range = tighten(selection.getRangeAt(0));
    if (!range) return undefined;
    const ends = [range.startContainer, range.endContainer].map(elementOf);
    if (ends.some((end) => !end || !scope.contains(end) || end.closest(excluded))) return undefined;
    if ([...scope.querySelectorAll(excluded)].some((node) => range.intersectsNode(node))) return undefined;
    return range;
  };

  const position = (range: Range) => {
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
    const box = range.getBoundingClientRect();
    const first = rects[0] ?? box;
    const last = rects.at(-1) ?? box;
    const width = toolbar.offsetWidth;
    const height = toolbar.offsetHeight;
    const header = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
    const touch = matchMedia("(pointer: coarse)").matches;
    const below = touch || first.top - height - gap < header;
    const line = below ? last : first;
    const centre = (line.left + line.right) / 2;
    const viewport = document.documentElement.clientWidth;
    const left = Math.max(margin, Math.min(centre - width / 2, viewport - width - margin));
    const top = below ? line.bottom + (touch ? touchGap : gap) : line.top - height - gap;
    const origin = (toolbar.offsetParent ?? document.body).getBoundingClientRect();
    toolbar.style.left = `${Math.round(left - origin.left)}px`;
    toolbar.style.top = `${Math.round(top - origin.top)}px`;
    toolbar.style.setProperty("--arrow-x", `${Math.round(Math.max(14, Math.min(centre - left, width - 14)))}px`);
    toolbar.dataset["placement"] = below ? "below" : "above";
  };

  const hide = () => {
    clearTimeout(timer);
    current = undefined;
    hinted = false;
    toolbar.hidden = true;
    if (hint) hint.textContent = "";
  };

  const show = (range: Range) => {
    current = range;
    toolbar.hidden = false;
    position(range);
    // Once per selection, the first time it is made or changed with the keyboard.
    if (viaKeyboard && !hinted) {
      hinted = true;
      announce(hint, hint?.dataset["message"] ?? "");
    }
  };

  const update = () => {
    if (toolbar.contains(document.activeElement)) return;
    const range = selectedRange();
    if (range && dismissed && sameRange(range, dismissed)) return;
    dismissed = undefined;
    if (range) show(range);
    else hide();
  };

  const schedule = () => {
    clearTimeout(timer);
    if (!pointerDown) timer = setTimeout(update, 120);
  };

  const focusButton = (button: HTMLButtonElement | undefined) => {
    if (!button) return;
    for (const other of buttons) other.tabIndex = other === button ? 0 : -1;
    button.focus();
  };

  const dismiss = () => {
    const range = current;
    const focusInside = toolbar.contains(document.activeElement);
    // Move focus out before hiding, so it never falls back to the top of the page.
    if (focusInside) {
      if (returnFocus?.isConnected && returnFocus !== document.body) returnFocus.focus();
      else (document.activeElement as HTMLElement | null)?.blur();
    }
    hide();
    if (!range) return;
    dismissed = range;
    if (focusInside) {
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  const copy = async (button: HTMLButtonElement) => {
    if (!current) return;
    const page = document.querySelector<HTMLLinkElement>("link[rel=canonical]")?.href ?? window.location.href;
    const url = quoteUrl(page, quoteContext(current, scope));
    const text =
      button.dataset["quoteAction"] === "quote"
        ? markdownQuote(
            quoteText(current),
            (link) => (toolbar.dataset["attribution"] ?? "").replace("{title}", link),
            toolbar.dataset["title"] ?? document.title,
            url,
          )
        : url;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("", text);
      return;
    }
    for (const other of buttons) other.removeAttribute("data-copied");
    button.setAttribute("data-copied", "");
    announce(status, button.dataset["done"] ?? "");
    setTimeout(() => {
      button.removeAttribute("data-copied");
    }, copiedFor);
  };

  document.addEventListener("selectionchange", schedule, options);
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (toolbar.contains(event.target as Node)) return;
      pointerDown = true;
      viaKeyboard = false;
      hide();
    },
    options,
  );
  const release = () => {
    if (!pointerDown) return;
    pointerDown = false;
    schedule();
  };
  document.addEventListener("pointerup", release, options);
  document.addEventListener("pointercancel", release, options);

  document.addEventListener(
    "keydown",
    (event) => {
      const shortcut = event.altKey && !event.ctrlKey && !event.metaKey && event.code === "KeyQ";
      if (shortcut && current && !toolbar.hidden) {
        event.preventDefault();
        if (!toolbar.contains(document.activeElement)) {
          returnFocus = (document.activeElement as HTMLElement | null) ?? undefined;
        }
        focusButton(buttons[0]);
        return;
      }
      if (event.key === "Escape" && !toolbar.hidden) {
        dismiss();
        return;
      }
      if (!toolbar.contains(event.target as Node)) viaKeyboard = true;
    },
    options,
  );

  toolbar.addEventListener(
    "pointerdown",
    (event) => {
      // Keeps the selection, and focus where it was, when a button is clicked.
      event.preventDefault();
    },
    options,
  );
  toolbar.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-quote-action]");
      if (button) void copy(button);
    },
    options,
  );
  toolbar.addEventListener(
    "keydown",
    (event) => {
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const moves: Record<string, number> = {
        ArrowRight: index + 1,
        ArrowDown: index + 1,
        ArrowLeft: index - 1,
        ArrowUp: index - 1,
        Home: 0,
        End: buttons.length - 1,
      };
      const target = moves[event.key];
      if (target === undefined) return;
      event.preventDefault();
      focusButton(buttons[(target + buttons.length) % buttons.length]);
    },
    options,
  );
  toolbar.addEventListener(
    "focusout",
    (event) => {
      if (!toolbar.hidden && !toolbar.contains(event.relatedTarget as Node | null)) {
        dismissed = current;
        hide();
      }
    },
    options,
  );
  window.addEventListener(
    "resize",
    () => {
      if (current && !toolbar.hidden) position(current);
    },
    options,
  );

  schedule();
};
