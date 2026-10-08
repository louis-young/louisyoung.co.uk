# 4. Internationalisation: full infrastructure, one shipped locale

- Status: accepted
- Date: 2026-10-07

## Context

The site is written in British English by one author. Machine-translated technical prose would be worse than none, but the UI should be ready for translation, and dates and numbers should be locale-correct.

## Decision

- Every UI string lives in a typed catalogue (`src/i18n/en-GB.ts`) with ICU-style placeholders and plurals. `t()` only accepts catalogue keys, and another locale must satisfy the same `Messages` type.
- Astro's i18n routing is configured with `en-GB` as the unprefixed default, so adding a locale adds `/<locale>/` routes without changing existing URLs.
- A pseudo-locale (`en-XA`: accented, about 40% longer, bracketed) is used in tests to catch hard-coded strings and layouts that only fit English.
- Articles are only translated deliberately, by a person, per article.

## Consequences

- Adding a language means adding a catalogue file and its routes. No component changes.
- An unused message key fails the tests, so the catalogue stays honest.
