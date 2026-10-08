import { defineEcConfig } from "astro-expressive-code";

/** Display names for the languages articles use; anything else is shown as written. */
const languageNames = { js: "JavaScript", jsx: "JSX", ts: "TypeScript", tsx: "TSX", sh: "Shell", bash: "Shell" };

/**
 * Untitled code frames get a slim header that names the language, so every block has the same
 * chrome as a titled one and the copy button has a home. Titled and terminal frames keep theirs.
 */
const languageLabel = () => ({
  name: "language-label",
  hooks: {
    postprocessRenderedBlock: ({ codeBlock, renderData }) => {
      const figure = renderData.blockAst;
      const classes = figure.properties?.className;
      if (figure.tagName !== "figure" || !Array.isArray(classes)) return;
      if (classes.includes("has-title") || classes.includes("is-terminal") || !codeBlock.language) return;
      const header = figure.children.find((child) => child.type === "element" && child.tagName === "figcaption");
      if (!header || header.type !== "element") return;
      classes.push("has-language");
      header.children.push({
        type: "element",
        tagName: "span",
        properties: { className: ["language"] },
        children: [{ type: "text", value: languageNames[codeBlock.language] ?? codeBlock.language }],
      });
    },
  },
});

/** Expressive Code options live here so the `<Code>` component and MDX share them. */
export default defineEcConfig({
  themes: ["github-light-high-contrast", "github-dark-high-contrast"],
  themeCssSelector: (theme) => (theme.type === "dark" ? "[data-theme='dark']" : "[data-theme='light']"),
  useDarkModeMediaQuery: false,
  plugins: [languageLabel()],
  styleOverrides: {
    borderRadius: "0.875rem",
    borderWidth: "1px",
    borderColor: "var(--rule)",
    codeFontFamily: "var(--mono)",
    uiFontFamily: "var(--mono)",
    codeFontSize: "0.875rem",
    codeLineHeight: "1.7",
    codePaddingBlock: "1.1rem",
    codePaddingInline: "1.25rem",
    // Marked lines take the site's violet. Kept as hue/chroma rather than a CSS variable so
    // Expressive Code can still compute the colours and keep highlighted tokens legible.
    textMarkers: {
      markHue: "292",
      defaultChroma: "30",
      backgroundOpacity: "40%",
      markBorderColor: "var(--accent)",
    },
    frames: {
      shadowColor: "transparent",
      editorActiveTabIndicatorTopColor: "var(--accent)",
      editorTabBarBackground: "var(--paper-sunken)",
      editorActiveTabBackground: "var(--paper-sunken)",
      editorTabBarBorderBottomColor: "var(--rule)",
      editorActiveTabForeground: "var(--ink-muted)",
      editorActiveTabBorderColor: "transparent",
    },
  },
  defaultProps: { wrap: false },
});
