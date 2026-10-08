/**
 * Topic filter for the writing archive. Without JavaScript the chips are plain links to
 * /tags/<tag>/; with it they filter the list in place, keep `?topic=` in the URL and announce
 * the new count in the live status line.
 */
const show = (topic: string, announce: boolean) => {
  const chips = [...document.querySelectorAll<HTMLAnchorElement>("[data-topic]")];
  const chip = chips.find((item) => item.dataset["topic"] === topic);
  if (!chip) return false;
  for (const item of chips) {
    if (item === chip) item.setAttribute("aria-current", "true");
    else item.removeAttribute("aria-current");
  }
  for (const row of document.querySelectorAll<HTMLElement>("[data-topics]")) {
    row.hidden = topic !== "" && !(row.dataset["topics"] ?? "").split(" ").includes(topic);
  }
  for (const section of document.querySelectorAll<HTMLElement>("[data-year]")) {
    section.hidden = !section.querySelector("[data-topics]:not([hidden])");
    const link = document.querySelector(`[data-year-link="${section.dataset["year"] ?? ""}"]`);
    if (link?.parentElement) link.parentElement.hidden = section.hidden;
  }
  const status = document.querySelector("[data-filter-status]");
  if (status && announce) status.textContent = chip.dataset["announce"] ?? "";
  return true;
};

export const initArchiveFilter = (signal?: AbortSignal) => {
  const nav = document.querySelector<HTMLElement>("[data-filter]");
  if (!nav) return;
  nav.addEventListener(
    "click",
    (event) => {
      const chip = (event.target as Element).closest<HTMLAnchorElement>("[data-topic]");
      // Modified clicks still open the topic page in a new tab or window.
      if (!chip || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const topic = chip.dataset["topic"] ?? "";
      show(topic, true);
      const url = new URL(window.location.href);
      if (topic) url.searchParams.set("topic", topic);
      else url.searchParams.delete("topic");
      history.replaceState(history.state, "", url);
    },
    { signal } as AddEventListenerOptions,
  );
  const initial = new URLSearchParams(window.location.search).get("topic");
  if (initial) show(initial, true);
};
