# 2. Allow style attributes in the Content Security Policy

- Status: accepted
- Date: 2026-10-07

## Context

Astro generates a hash-based CSP for every `<script>` and `<style>` it renders. Expressive Code writes token colours into inline `style` attributes, and view-transition names are set the same way. A strict `style-src` would block both, leaving code unhighlighted.

## Decision

Add `'unsafe-inline'` to **`style-src-attr` only**. `script-src` and `style-src` (including `style-src-elem`) stay hash-locked with no inline allowance.

## Consequences

- Style attributes can't execute script. The remaining risk is CSS-based data exfiltration through injected attributes, which needs an HTML injection we don't otherwise allow (all content is authored and built statically).
- Revisit if Expressive Code moves token colours into class-based CSS.
