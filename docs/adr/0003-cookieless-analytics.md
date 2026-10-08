# 3. Replace Google Analytics with cookieless analytics

- Status: accepted
- Date: 2026-10-07

## Context

The old site loaded Google Analytics 4, which sets cookies and under UK GDPR/PECR needs a consent banner. That banner was never added. GA4 also adds a third-party script and network origin, which complicates the CSP.

## Decision

Use Vercel Web Analytics. It is cookieless, served first-party from `/_vercel/insights`, and only loaded when the build runs on Vercel.

## Consequences

- No consent banner is needed, and the CSP keeps `script-src 'self'`.
- Historical GA4 data stays in Google Analytics and isn't migrated.
- Analytics must be enabled once in the Vercel project settings.
