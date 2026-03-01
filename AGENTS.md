## Cursor Cloud specific instructions

### Overview

Excalidraw is a Yarn 1.x monorepo (workspaces). The main app (`excalidraw-app/`) runs on Vite dev server at **port 3001**. Core library code lives in `packages/excalidraw/`, with supporting packages in `packages/common/`, `packages/element/`, `packages/math/`, `packages/utils/`.

### Commands

Standard dev commands are in the root `package.json` and documented in `CLAUDE.md`:

- **Dev server:** `yarn start` (port 3001)
- **Lint:** `yarn test:code` (eslint) and `yarn test:other` (prettier)
- **Typecheck:** `yarn test:typecheck`
- **Tests:** `yarn test:update` (vitest, includes snapshot updates)
- **Fix lint/format:** `yarn fix`

### Gotchas

- The `yarn start` script in `excalidraw-app/package.json` runs `yarn && vite`, so it re-runs `yarn install` on every start. This is intentional and ensures deps are fresh.
- Tests run entirely locally via Vitest + jsdom + fake-indexeddb; no external services needed.
- Firebase and JSON backend are pre-configured with dev credentials in `.env.development`; no secrets required for core development.
- Collaboration (WebSocket server on port 3002), AI backend (port 3016), and Excalidraw+ are **optional** external services not needed for core whiteboard development or testing.
- The pre-commit hook in `.husky/pre-commit` is commented out (no active lint-staged gate).
