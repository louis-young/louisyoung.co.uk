import { formatLocalTime, msToNextMinute } from "../lib/clock";

/** Keeps every `[data-clock]` showing the current time in its `data-time-zone`, ticking on the minute. */
export const initClock = (signal?: AbortSignal) => {
  const clocks = [...document.querySelectorAll<HTMLTimeElement>("time[data-clock]")];
  if (clocks.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = () => {
    const now = new Date();
    for (const clock of clocks) {
      const timeZone = clock.dataset["timeZone"] ?? "UTC";
      clock.textContent = formatLocalTime(now, timeZone);
      clock.dateTime = now.toISOString();
    }
    timer = setTimeout(tick, msToNextMinute(now));
  };
  tick();
  signal?.addEventListener("abort", () => {
    clearTimeout(timer);
  });
};
