# AGENTS.md

## Cursor Cloud specific instructions

Excalidraw is a Yarn (v1) workspaces monorepo. The dev environment is refreshed automatically by the startup update script (`yarn install`), so you normally don't need to install anything manually.

Standard commands live in `CLAUDE.md` and root `package.json` `scripts` — use those for lint/typecheck/test/build. Non-obvious caveats for running things here:

- **Main web app**: `yarn start` (from repo root) runs the `excalidraw-app` Vite dev server on **http://localhost:3001/** (port comes from `VITE_APP_PORT` in the committed `/.env.development`, not the Vite default 3000). This is a long-running process — start it in a background/tmux session, not a blocking foreground call.
- **Env files live at the repo root** (`/.env.development`, etc.), not inside `excalidraw-app/`. Vite is configured with `envDir: "../"`. Defaults are committed and work out of the box; no env vars need to be set for basic editor dev.
- **Backends are hosted by default.** Running the editor end-to-end needs only the Vite dev server. Optional features need extra local services that are NOT in this repo: live collaboration needs the `excalidraw-room` websocket server (`localhost:3002`) + Firebase, and AI ("text/diagram to code") needs an AI backend (`localhost:3016`). Shareable links and shape libraries work against hosted dev endpoints.
- **Tests**: `yarn test` (alias for `vitest`) defaults to watch mode. For a one-shot run use `yarn test:app --watch=false` (or `yarn test:update` to refresh snapshots). The `Error JSON parsing firebase config` lines during tests are expected/benign.
- **Node**: the codebase requires Node `>=18`. It also runs fine on Node 22; the `@typescript-eslint` "TYPESCRIPT VERSION not officially supported" warning printed by the dev server is benign.
