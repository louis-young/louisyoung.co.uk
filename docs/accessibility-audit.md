# Accessibility audit

October 2026. A keyboard and assistive-technology audit of every route, going beyond what axe checks. The public summary is the [accessibility statement](../content/pages/accessibility.mdx) at `/accessibility/`.

## Scope

Every route in `tests/e2e/fixtures.ts` plus every page in `dist/` after `SHOW_DRAFTS=true pnpm build`: the home page, work and case studies, writing and every article, hire, CV, now, uses, every tag page, search, design, every tool, stats, changelog, colophon and the 404 page. That is 51 pages, checked in Chromium through Playwright against a production build.

Target: WCAG 2.2 AA.

## What was checked

| Check                | How                                                                                                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyboard alone       | Tabbed through every stop on 16 representative pages in light, dark, forced-colours and increased-contrast modes, recording the focused element, its outline and the outline's contrast against the nearest opaque background.                |
| Skip link            | First tab stop, visible when focused, moves focus to `<main>`.                                                                                                                                                                                |
| Dialogs              | Opened the palette, terminal and (new) shortcuts dialog from buttons, shortcuts and each other; tabbed forwards and backwards inside; closed with Escape, the close button, the backdrop and the terminal's `exit`; checked where focus went. |
| Headings             | `locator.ariaSnapshot()` on every page: one h1, h1 first, no skipped levels.                                                                                                                                                                  |
| Landmarks            | One banner, main and contentinfo per page; every `<nav>` named, and no two with the same name.                                                                                                                                                |
| Accessible names     | Every link and button has a name (text, `aria-label`, `aria-labelledby`, `title` or alt text).                                                                                                                                                |
| Link purpose         | Links with the same text but different destinations on one page.                                                                                                                                                                              |
| Reduced motion       | `reducedMotion: "reduce"`, then scrolled each page and listed every running animation.                                                                                                                                                        |
| Forced colours       | `forcedColors: "active"`: focus rings on every tab stop, and every state (current page, selected option, pressed button) that colour alone drew.                                                                                              |
| Increased contrast   | `contrast: "more"`: focus rings and token contrast.                                                                                                                                                                                           |
| Reflow and text zoom | Every page at 320 CSS px wide (no horizontal scroll), and at 1280 px with the root font size at 200% (no horizontal scroll, no clipped text).                                                                                                 |
| Target size          | Every link, button and form control at 1280 and 412 px against SC 2.5.8: 24 × 24 CSS px, or the spacing exception (a 24 px circle on the target touches no other target), with inline links in sentences exempt.                              |

## Findings and fixes

Nothing failed axe, which already runs on every page in both themes. Everything below came from the extra checks.

### Fixed

1. **Enquiry form focus disappeared in forced colours, and was under 3:1 elsewhere** (SC 2.4.7, 1.4.11). The `/hire/` fields replaced the outline with a 30%-opacity box-shadow ring. Forced colours removes box-shadows, so focused fields looked identical to unfocused ones, and the translucent ring was about 1.5:1 against the card. Fields now use the site's solid 2px accent outline. `src/components/sections/EnquiryForm.astro`
2. **The 404 search box had the same problem.** Its pill drew focus with the same translucent ring. It now draws a solid outline when the input has keyboard focus. `src/pages/404.astro`
3. **The 404 page scrolled sideways at 320 px** (SC 1.4.10). Its single-column grid used `1fr`, whose automatic minimum let the giant 404 widen the column to 366 px. It is now `minmax(0, 1fr)`. `src/pages/404.astro`
4. **Code block copy buttons had a near-black focus ring in dark mode** (SC 1.4.11, 1.04:1). Expressive Code reverts its buttons to the browser's default ring. They now use the accent outline. `src/styles/prose.css`
5. **The terminal's focus ring was 2.2:1** (SC 1.4.11). The dashed outline round the prompt used a dim violet. It now uses the terminal's accent, about 10:1. `src/components/Terminal.astro`
6. **The terminal's hidden submit button was a tab stop** (SC 2.4.7). Tabbing from the prompt landed on an invisible button. Enter submits the form, so the button is now `tabindex="-1"`. `src/components/Terminal.astro`
7. **The palette's listbox was a tab stop.** Chromium makes scrollable regions focusable, so Tab moved focus off the combobox onto the list, where no option was active. Options are reached with the arrow keys, so the list is now `tabindex="-1"`. `src/components/Palette.astro`
8. **The palette's search input had no focus indicator.** It now draws an accent rule under the search row (and a Highlight outline in forced colours). `src/components/Palette.astro`
9. **The palette's active option vanished in forced colours** (SC 1.4.1, 2.4.7). It was marked only by a background and an inset shadow. It now uses `Highlight`/`HighlightText`. `src/components/Palette.astro`
10. **The current section in the header disappeared in forced colours.** The pill fill that marks `aria-current` is dropped, so the current link is now underlined in forced colours. `src/components/Header.astro`
11. **The table of contents lost its current-section bar in forced colours.** The bar is now drawn in `Highlight`. `src/components/Toc.astro`
12. **The easing tool's pressed preset was invisible in forced colours.** It now uses `Highlight`/`HighlightText`. `src/pages/tools/easing.astro`
13. **Small footer targets.** The one-letter "X" link was 9 px wide and "Back to top" 20 px tall. Both passed through the spacing exception, but now meet 24 px outright at no visual cost. `src/components/Footer.astro`
14. **`?` opened the command palette**, duplicating ⌘K, and there was nowhere listing every shortcut. `?` now opens a keyboard shortcuts dialog (see below).

### Checked and passing

- **Headings and landmarks.** Every page has one h1, first, with no skipped levels, and one banner, main and contentinfo. Every `<nav>` has a unique name.
- **Skip link.** First tab stop on every page; visible on focus; moves focus to `<main>`.
- **Focus contrast.** Outside the fixes above, every focus ring is the accent at 2px, at least 4.5:1 against the page in both themes and with increased contrast.
- **Dialog focus.** All three dialogs are native modal `<dialog>` elements: the rest of the page is inert while they are open, Escape closes them, and the browser hands focus back to whatever opened them, including when the terminal or shortcuts dialog is opened from the palette (focus returns to the palette's opener). Tabbing past the last control moves to the browser's toolbar and back, which is how native modal dialogs cycle and is not a trap.
- **Target size.** With the spacing exception, no target on any page fails SC 2.5.8 at desktop or mobile widths. The undersized ones are inline-style links in lists and rows (article titles at 22 px, changelog commit links at 20 px, breadcrumbs, the stats chart labels) with enough space around them, and checkboxes whose labels extend their target.
- **Reduced motion.** Entrance, reveal and scroll-driven animations, view transitions and smooth scrolling all switch off. The pointer spotlight checks the preference in script.
- **Text zoom.** At 200% no page scrolls sideways or clips text. The only clipped boxes are decorative (the home page's hire-card glow) or deliberate (the type specimens on `/design/`, which truncate with an ellipsis).
- **Accessible names.** Every link and button is named. Expressive Code's copy buttons are named by their `title`.

### Accepted, with reasons

- **The main navigation scrolls sideways below about 360 px.** It is a scrollable row inside the header, not the page, and every destination is also in the footer and the palette.
- **Repeated link text with different targets.** An article's table of contents and its body can both link "React Query", and `/now/` has a "Work" heading in its contents alongside the "Work" section link. Each is clear from its context (SC 2.4.4 allows this).
- **The article reading-progress bar still moves with reduced motion.** It is scroll-linked, so it only moves when the reader scrolls, and it is `aria-hidden`.
- **Code blocks scroll horizontally** instead of wrapping, which SC 1.4.10 allows for code.
- **CodeSandbox embeds** are third-party content, loaded only on click, with the same code shown as plain text on the page.

## New: keyboard shortcuts dialog

`?` (Shift + /) opens a modal dialog listing every shortcut: the global single keys from `src/scripts/shortcuts.ts`, the palette's arrow, Home/End and Enter keys, and the terminal's Tab, history and Ctrl + L. It is ignored while typing in a field or when another dialog is open, like every single-key shortcut. It is also in the palette's actions, the footer and the home page's shortcuts card. Its markup is rendered at build time and its script (`src/scripts/shortcuts-help.ts`) loads on first use through `lazyOpener`, so the home and tags pages stay inside their 4 kB JavaScript budget.

## Regression tests

`tests/a11y/keyboard-ux.spec.ts`, in the `a11y` Playwright project:

- **Page structure**, on every route: one h1, first, no skipped levels, one banner, main and contentinfo, read from the accessibility snapshot.
- **Forced colours**, on seven key pages: every tab stop has an outline (on the element or the wrapper that draws its ring).
- **Target size**, on thirteen key pages at 1280 and 360 px: the SC 2.5.8 check above, spacing exception included.
- **Dialogs**: the palette, terminal and shortcuts dialog keep focus inside and off invisible elements, and return it to their opener on Escape, including a dialog opened from the palette.

The shortcuts dialog itself is covered in `tests/e2e/keyboard.spec.ts` and `tests/unit/shortcuts-help-dom.test.ts`.
