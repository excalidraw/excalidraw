## CI/CD — GitHub Actions Workflows

The `.github/workflows/` directory contains eleven workflows spanning PR validation, post-merge tests, release automation, Docker publishing, Sentry error tracking, and localization coverage. All third-party action references are pinned to commit SHAs (security hardening throughout).

### Branch Model and Trigger Map

Three branches drive automation:

- **`master`** — post-merge tests run here (`test.yml` runs `yarn test:app`).
- **`release`** — the production gate. Pushing to it triggers five workflows in parallel: npm package release, Docker build verification, Docker publish, Sentry source-map upload, and cancellation of stale prior runs.
- **`l10n_master`** — Crowdin integration branch. Pushing here rebuilds the translation coverage report and auto-commits changes to `packages/excalidraw/locales/percentages.json`.

### PR Checks (run on pull requests)

| Workflow | What it does |
|---|---|
| `cancel.yml` | Cancels stale runs for the PR (and for `release` pushes). Hardcoded workflow IDs: 400555, 400556, 905313, 1451724, 1710116, 3185001, 3438604. |
| `lint.yml` | Runs `yarn test:other`, `yarn test:code`, `yarn test:typecheck` — covers formatting, linting, and TypeScript. |
| `size-limit.yml` | Checks the ESM bundle size of `@excalidraw/excalidraw` against a baseline and posts a comment; only triggers on PRs targeting `master`. Installs from `packages/excalidraw` directly, then calls the `build:esm` script. |
| `test-coverage-pr.yml` | Runs `yarn test:coverage` and posts a Vitest coverage report as a PR comment via `davelosert/vitest-coverage-report-action`. Reports even if tests fail (`if: always()`). |
| `semantic-pr-title.yml` | Enforces Conventional Commits format with `requireScope: true`. Valid scopes: `app`, `editor`, `packages/excalidraw`, `packages/utils`, `docker`, `repo`. PRs labelled `skip-semantic-title` are exempt. A second job (`label-scope`) auto-applies GitHub labels `s-app`, `s-editor`, or `s-package` derived from the PR title scope, and removes stale scope labels. Only runs on PRs from the same repo (not forks). |

### Release Workflows (trigger: push to `release`)

**`autorelease-excalidraw.yml`** — publishes `@excalidraw/excalidraw` to npm. Runs `yarn release --tag=next --non-interactive`, so all releases go out as `next` pre-release tags. Requires `NPM_TOKEN` secret.

**`build-docker.yml`** — builds the Docker image (`docker build -t excalidraw .`) without pushing. Acts as a build-verification step alongside the publish job.

**`publish-docker.yml`** — builds and pushes to DockerHub as `excalidraw/excalidraw:latest` for three platforms: `linux/amd64`, `linux/arm64`, `linux/arm/v7`. Uses QEMU and Buildx. Requires `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets.

**`sentry-production.yml`** — builds the web app (`yarn build:app`), installs the Sentry CLI, creates a new Sentry release, associates commits automatically (`--auto`), uploads source maps from `./build/static/js/` with URL prefix `~/static/js`, finalizes the release, and marks it deployed to `production`. Requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` secrets.

### Localization Workflow

**`locales-coverage.yml`** (trigger: push to `l10n_master`) — runs `yarn locales-coverage` to regenerate `packages/excalidraw/locales/percentages.json`, commits and pushes it as `Excalidraw Bot` if the file changed, then updates the Crowdin PR description with a coverage summary. Requires a Personal Access Token (`PUSH_TRANSLATIONS_COVERAGE_PAT`) because it needs push and PR-write access beyond `GITHUB_TOKEN` scope.

### Secrets Reference

| Secret | Used by |
|---|---|
| `NPM_TOKEN` | `autorelease-excalidraw.yml` |
| `DOCKER_USERNAME` / `DOCKER_PASSWORD` | `publish-docker.yml` |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | `sentry-production.yml` |
| `PUSH_TRANSLATIONS_COVERAGE_PAT` | `locales-coverage.yml` |
| `GITHUB_TOKEN` | `cancel.yml`, `size-limit.yml`, `semantic-pr-title.yml`, `test-coverage-pr.yml` |

### Other Files

- `.github/FUNDING.yml` — configures the Open Collective funding link (`excalidraw` collective) shown on the GitHub repo page.
- `.github/copilot-instructions.md` — project coding standards loaded by GitHub Copilot (and referenced by Claude Code). Covers TypeScript preferences, React patterns, naming conventions, error handling, and a note to always include `packages/math/src/types.ts` when writing math-related code.
- `.github/assets/` — SVG logos for Crowdin, Sentry, and Vercel (used in docs/README).

### Related Documentation

- `.github/copilot-instructions.md` — authoritative coding standards for this project (TypeScript, React, naming, testing guidance).
- `CONTRIBUTING.md` — contributing guide covering workflow expectations for contributors.