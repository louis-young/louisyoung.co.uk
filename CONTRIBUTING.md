# Contributing

Thanks for helping. Typo fixes and corrections to articles are especially welcome; every article has a "Suggest an edit" link.

## Setup

```sh
corepack enable
pnpm install   # also installs git hooks via lefthook
pnpm dev
```

## Workflow

1. Branch from `main`.
2. Make your change. Add or update tests alongside it.
3. Run `pnpm check && pnpm test`. For UI changes, also `pnpm build && pnpm test:e2e && pnpm test:a11y`.
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:` …). A commit hook checks this.
5. Open a pull request. CI must pass (`CI OK` is the single required check).

If your change alters how a page looks, the visual regression job will fail until baselines are updated. Inspect the diff artifact, then run the **Update visual baselines** workflow on your branch (or add the `update-visual-baselines` label).

## Git hooks

- **pre-commit:** Prettier, ESLint and cspell on staged files.
- **commit-msg:** commitlint.
- **pre-push:** `pnpm check && pnpm test`.

## Repository settings (maintainers)

- Ruleset on `main`: require pull requests and the `CI OK` status check (optionally CodeQL, Dependency review and Gitleaks too); block force pushes.
- Enable auto-merge (used by the Dependabot workflow).
- Code security: dependency graph, Dependabot alerts and security updates, secret scanning with push protection, private vulnerability reporting.
- Code scanning: use the advanced setup (the `codeql.yml` workflow), not default setup.
- Vercel: connect the repository, enable Web Analytics, and point the `louisyoung.co.uk` domain at the project.
- Once production is live on Vercel, set the repository variable `SYNTHETICS_ENABLED=true` to start the 30-minute production checks.
