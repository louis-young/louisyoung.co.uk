export type ThemePreference = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const order: readonly ThemePreference[] = ["system", "light", "dark"];

export const parsePreference = (value: string | null | undefined): ThemePreference =>
  value === "light" || value === "dark" ? value : "system";

export const resolveTheme = (preference: ThemePreference, systemPrefersDark: boolean): Theme =>
  preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference;

export const nextPreference = (current: ThemePreference): ThemePreference =>
  order[(order.indexOf(current) + 1) % order.length] ?? "system";

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStored = (preference: ThemePreference) => {
  try {
    if (preference === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* Storage can be unavailable (private mode, blocked cookies); the theme still applies for this page. */
  }
};

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

const applyPreference = (preference: ThemePreference) => {
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = resolveTheme(preference, media().matches);
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]")) {
    const label = button.dataset[`label${preference[0]!.toUpperCase()}${preference.slice(1)}`];
    if (label) {
      button.setAttribute("aria-label", label);
      button.title = label;
    }
  }
};

export const cycleTheme = () => {
  const next = nextPreference(parsePreference(document.documentElement.dataset.themePreference));
  writeStored(next);
  applyPreference(next);
};

export const initTheme = () => {
  applyPreference(parsePreference(readStored()));
  media().addEventListener("change", () => {
    applyPreference(parsePreference(readStored()));
  });
  document.addEventListener("click", (event) => {
    if ((event.target as Element | null)?.closest("[data-theme-toggle]")) cycleTheme();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) applyPreference(parsePreference(event.newValue));
  });
};
