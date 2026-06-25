# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Excalidraw is a client-side whiteboard/diagramming React app. The only service required for local development is the Vite dev server; all external services (Firebase, WebSocket collab, AI backend) are optional.

### Services

| Service | Command | Port | Notes |
|---|---|---|---|
| Vite dev server | `yarn start` | 3001 | The main app; core drawing works fully offline with no backends |

### Development commands

All standard commands are in the root `package.json` and documented in `CLAUDE.md`. Key ones:

- `yarn start` — dev server on port 3001
- `yarn test:typecheck` — TypeScript type checking (`tsc`)
- `yarn test:code` — ESLint (`--max-warnings=0`)
- `yarn test:app --watch=false` — run all Vitest tests (96 test files)
- `yarn test:update` — run tests with snapshot updates
- `yarn fix` — auto-fix formatting and linting

### Non-obvious caveats

- The pre-commit hook in `.husky/pre-commit` is commented out (no lint-staged runs automatically).
- `yarn start` runs a nested `yarn install` inside `excalidraw-app/` before launching Vite — the first start after fresh install takes a few extra seconds.
- ESLint emits two benign `MetaProperty` warnings and a TypeScript version support warning from `@typescript-eslint`; both are safe to ignore.
- Firebase config parsing errors in stderr during tests (`Error JSON parsing firebase config`) are expected and harmless — the dev Firebase config env var is not set during test runs.
- Tests use `vitest` with `jsdom` environment and `vitest-canvas-mock`. No real browser or canvas is needed for tests.
