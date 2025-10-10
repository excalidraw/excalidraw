## Purpose

This file gives short, actionable guidance for AI coding agents working in the Excalidraw monorepo. Focus on project-specific conventions, workflows, and files that make the agent productive immediately.

### Big picture (what to know first)

- Monorepo using Yarn v1 workspaces (root `package.json`). Key areas:
  - `packages/*` — core libraries: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`, `@excalidraw/excalidraw` (library)
  - `excalidraw-app/` — full web application (uses the library)
  - `examples/` — integration examples (Next.js, script-in-browser)
- Build tools: Vite for the app (`excalidraw-app`) and esbuild-based builds for packages (see `scripts/*` and individual package `package.json`).
- Node & package manager: Node 18–22, Yarn 1.22.22 (run `yarn` at repo root to install).

### Important developer workflows (exact commands)

- Install & link workspaces: from repo root run: `yarn`
- Start dev server (app): `yarn start` (runs `excalidraw-app`'s Vite dev server)
- Build app: `yarn build` or `yarn build:app`
- Build all packages: `yarn build:packages` (runs `build:common`, `build:math`, `build:element`, `build:excalidraw`)
- Clean builds / node_modules: `yarn rm:build`, `yarn rm:node_modules`, then `yarn clean-install`
- Typecheck: `yarn test:typecheck` (runs `tsc`)
- Unit tests: `yarn test:app` (Vitest), update snapshots: `yarn test:update`
- Lint & format checks: `yarn test:code` (eslint with --max-warnings=0), `yarn prettier` for formatting checks; auto-fix: `yarn fix`

### Project conventions to preserve

- TypeScript everywhere. Prefer immutable values (`const`, `readonly`) and low-allocation, performant code where possible.
- React: functional components + hooks only. Follow React hooks rules (no conditional hooks).
- Geometry/math: prefer the canonical Point type — import from `packages/math/src/types.ts` instead of using ad-hoc `{x,y}` objects.
- Environment variables: Vite reads `VITE_` prefixed vars (see `.env.development`). Important keys: `VITE_APP_FIREBASE_CONFIG`, `VITE_APP_WS_SERVER_URL`, backend URLs.

### Integration points & notable dependencies

- Real-time collab uses WebSockets / `socket.io-client` — config via `VITE_APP_WS_SERVER_URL`. See `excalidraw-app/collab/` for collab logic.
- Firebase is used for persistence/auth — check `excalidraw-app` imports of `firebase` and `.env*` files for credentials.
- The library package `packages/excalidraw` is consumed by `excalidraw-app` and examples. When changing package APIs, update consumers.

### Cross-package patterns

- Packages are consumed internally via Yarn workspaces and internal path aliases (see `vitest.config.mts` / `tsconfig.base.json`). When you change package code:
  1. Run `yarn build:packages` and restart the dev server so the app picks up built packages.
  2. For small UX/renderer tweaks, editing inside `excalidraw-app` may be faster; for core logic, change the package and rebuild.

### Files to open first (fast orientation)

- `package.json` (repo root) — scripts and workspace layout
- `excalidraw-app/package.json` and `excalidraw-app/vite.config.mts` — app scripts & Vite config
- `packages/excalidraw/` — the library implementation
- `packages/math/src/types.ts` — canonical Point/type definitions used across packages
- `vitest.config.mts`, `tsconfig.base.json` — aliases and type configuration
- `scripts/*` — build helpers (e.g., `build-node.js`, `build-version.js`)

### Example patterns & quick tips (concrete)

- Use `Point` from `packages/math/src/types.ts` for geometry APIs. Example: `function dist(a: Point, b: Point): number`.
- To update a package and verify UI: change `packages/element` -> `yarn build:packages` -> `yarn start` and open the dev server.
- Update snapshots after intentional UI changes: `yarn test:update`.
- Toggle runtime behaviors via `.env.development` (e.g., `VITE_APP_ENABLE_PWA=false`, `VITE_APP_WS_SERVER_URL`).

### What agents must NOT do

- Do not assume production endpoints — always reference `.env*` files for configured URLs.
- Do not modify workspace layout or root scripts without updating the root `package.json` scripts and informing maintainers.

---

If you'd like, I can also add a 1–2 step recipe (short checklist) for: (A) making a change inside a package and verifying it in the app, or (B) fixing a failing Vitest snapshot. Tell me which and I'll append it.
