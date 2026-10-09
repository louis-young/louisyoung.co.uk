import { minutesLeft, readProgress } from "../lib/reading-progress";

/**
 * The "3 min left" pill. It reads its total and messages from data attributes, shows once the
 * body is on screen, and is recomputed at most once per frame while scrolling.
 */
export const initTimeLeft = (signal?: AbortSignal) => {
  const pill = document.querySelector<HTMLElement>("[data-time-left]");
  const body = document.querySelector<HTMLElement>("[data-reading-body]");
  const label = pill?.querySelector<HTMLElement>("[data-time-left-label]");
  if (!pill || !body || !label) return;
  const total = Number(pill.dataset["minutes"]);
  const template = pill.dataset["template"] ?? "";
  const done = pill.dataset["done"] ?? "";
  let frame = 0;

  const update = () => {
    frame = 0;
    const { top, bottom, height } = body.getBoundingClientRect();
    const viewport = window.innerHeight;
    const progress = readProgress(top, height, viewport);
    const left = minutesLeft(total, progress);
    const text = left > 0 ? template.replace("{minutes}", String(left)) : done;
    if (label.textContent !== text) label.textContent = text;
    pill.style.setProperty("--progress", progress.toFixed(3));
    pill.toggleAttribute("data-shown", top < viewport * 0.5 && bottom > viewport * 0.35);
  };

  pill.hidden = false;
  update();
  const schedule = () => (frame ||= requestAnimationFrame(update));
  window.addEventListener("scroll", schedule, { passive: true, signal } as AddEventListenerOptions);
  window.addEventListener("resize", schedule, { passive: true, signal } as AddEventListenerOptions);
};

/**
 * Heading anchors still jump to their section; with a clipboard they also copy the section's
 * canonical URL, flash a "Copied" badge on the heading and announce it in a status region.
 */
export const initHeadingLinks = (signal?: AbortSignal) => {
  const status = document.querySelector<HTMLElement>("[data-anchor-status]");
  let current: { heading: Element; timer: ReturnType<typeof setTimeout> } | undefined;

  document.addEventListener(
    "click",
    (event) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>(".prose .heading-anchor");
      const heading = anchor?.parentElement;
      const clipboard = navigator.clipboard as Clipboard | undefined;
      if (!anchor || !heading || !status || !clipboard) return;
      const base = document.querySelector<HTMLLinkElement>("link[rel=canonical]")?.href ?? window.location.href;
      const url = new URL(anchor.getAttribute("href") ?? "", base).href;
      clipboard.writeText(url).then(
        () => {
          if (current) {
            clearTimeout(current.timer);
            current.heading.removeAttribute("data-copied");
          }
          heading.setAttribute("data-copied", status.dataset["copiedLabel"] ?? "");
          // Clear first so the same message is announced again on a second copy.
          status.textContent = "";
          requestAnimationFrame(() => (status.textContent = status.dataset["message"] ?? ""));
          current = {
            heading,
            timer: setTimeout(() => {
              heading.removeAttribute("data-copied");
              status.textContent = "";
              current = undefined;
            }, 1800),
          };
        },
        () => undefined,
      );
    },
    { signal } as AddEventListenerOptions,
  );
};

/**
 * Calls `load` once, the first time the reader selects text inside `scope`, saying whether the
 * selection was made with the keyboard. Used to fetch the quote-sharing toolbar only for readers
 * who select something.
 */
export const loadOnSelection = (scope: Element, load: (keyboard: boolean) => void, signal?: AbortSignal) => {
  const controller = new AbortController();
  signal?.addEventListener("abort", () => {
    controller.abort();
  });
  const options = { signal: controller.signal, capture: true };
  let keyboard = false;
  document.addEventListener("keydown", () => (keyboard = true), options);
  document.addEventListener("pointerdown", () => (keyboard = false), options);
  document.addEventListener(
    "selectionchange",
    () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || !scope.contains(selection.anchorNode)) return;
      controller.abort();
      load(keyboard);
    },
    options,
  );
};
