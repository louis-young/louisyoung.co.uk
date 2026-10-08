/**
 * A soft light that follows the pointer across cards. It only runs for a precise pointer
 * with motion allowed, and only writes two custom properties; the glow itself is CSS.
 */
export const initSpotlight = (signal?: AbortSignal) => {
  const allowed = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  if (!allowed.matches) return;
  document.addEventListener(
    "pointermove",
    (event) => {
      const card = (event.target as Element | null)?.closest<HTMLElement>(".card");
      if (!card) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty("--spot-x", `${Math.round(event.clientX - box.left)}px`);
      card.style.setProperty("--spot-y", `${Math.round(event.clientY - box.top)}px`);
    },
    { passive: true, signal } as AddEventListenerOptions,
  );
};
