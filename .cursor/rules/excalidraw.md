# Excalidraw — Cursor Rules

## Commands
<!-- Build, test, lint commands -->
- `yarn test:typecheck` — TypeScript check
- `yarn test:app --watch=false` — run all tests
- `yarn fix` — Prettier + ESLint auto-fix

## Code Style
<!-- Conventions and patterns -->
- ESLint + Prettier via `@excalidraw/*` configs
- Use package aliases: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`
- Tests use `describe`/`it` with `@testing-library/react`

## Architecture
<!-- Where things go -->
- Monorepo: `packages/*`, `excalidraw-app/`, `examples/`
- Editor features → `packages/excalidraw/`
- Tests colocate next to source as `*.test.{ts,tsx}`

## Workflow
<!-- What the agent should always do -->
- Run `yarn test:typecheck` before committing
- Run `yarn test:app --watch=false` before committing
- Run `yarn fix` to auto-format
