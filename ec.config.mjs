import { defineEcConfig } from "astro-expressive-code";

/** Expressive Code options live here so the `<Code>` component and MDX share them. */
export default defineEcConfig({
  themes: ["github-light-high-contrast", "github-dark-high-contrast"],
  themeCssSelector: (theme) => (theme.type === "dark" ? "[data-theme='dark']" : "[data-theme='light']"),
  useDarkModeMediaQuery: false,
  styleOverrides: {
    borderRadius: "0",
    borderWidth: "2px",
    borderColor: "var(--rule-strong)",
    codeFontFamily: "var(--mono)",
    uiFontFamily: "var(--mono)",
    codeFontSize: "0.875rem",
    codeLineHeight: "1.7",
    frames: { shadowColor: "transparent", editorActiveTabIndicatorTopColor: "var(--signal)" },
  },
  defaultProps: { wrap: false },
});
