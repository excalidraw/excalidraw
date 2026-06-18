# Excalidraw — Agent Context

This is the `excalidraw-monorepo`: an open-source virtual whiteboard. Two deliverables:
the `@excalidraw/excalidraw` npm library and the `excalidraw.com` web app.

## Architecture you must respect
- **Yarn 1.22.22 workspaces.** Workspaces: `excalidraw-app`, `packages/*`, `examples/*`.
  Never introduce npm/pnpm lockfiles. Use `yarn` for all install/script commands.
- **Package boundaries (do not create circular deps):**
  - `@excalidraw/common` — shared constants, utils, types. Depends on nothing internal.
  - `@excalidraw/math` — pure geometry/number helpers. Depends only on `common`.
  - `@excalidraw/element` — element model, binding, transforms. Depends on `common`, `math`.
  - `@excalidraw/excalidraw` — the React component + public API. Depends on all of the above.
  - `@excalidraw/utils` — standalone helpers exported to integrators.
  - Import direction flows one way: `excalidraw → element → math → common`. Never upward.
- **Path aliases** are defined in `tsconfig.json` for every `@excalidraw/*` package.
  Import via the alias (`@excalidraw/element/...`), never deep relative paths across packages.
- **React 19.** Function components + hooks only. No class components in new code.
- **State** lives in `appState` + the Scene/element collection. Mutations go through the
  **Action system** (`actions/`) and the history (undo/redo) layer — never mutate elements in place
  outside an action without updating history.
- **SSR is unsupported.** The library is client-only.

## Tooling
- **Tests:** Vitest (`yarn test`). Co-locate as `*.test.ts(x)` next to source or under `tests/`.
- **Lint/format:** ESLint (`@excalidraw/eslint-config`) + Prettier 2.6.2 (`@excalidraw/prettier-config`).
- **Type checks:** `yarn test:typecheck` must pass before any change is considered done.

## Definition of done for any change
1. Types pass. 2. Lint passes. 3. New/changed behavior has a Vitest test.
4. No new cross-package upward imports. 5. Public API changes are reflected in the package's README.
