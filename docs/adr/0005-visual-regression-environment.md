# 5. Render visual baselines only in the pinned Playwright container

- Status: accepted
- Date: 2026-10-07

## Context

Screenshots differ across operating systems, font rasterisers and browser builds. Baselines generated on a laptop fail in CI and the reverse, which teaches people to ignore the suite.

## Decision

- `@playwright/test` is pinned to an exact version, and visual tests run in `mcr.microsoft.com/playwright:<same version>-noble`, pinned by digest.
- Baselines are created and updated only by the **Update visual baselines** workflow (manual, or the `update-visual-baselines` label), which commits them back to the branch.
- Screenshots use reduced motion, disabled animations and loaded fonts, with a tight 0.2% pixel tolerance.

## Consequences

- Upgrading Playwright means bumping the package, the container tag and digest in two workflows, and regenerating baselines, in one PR.
- Dependabot doesn't update container images used in workflows, so this is a manual bump.
