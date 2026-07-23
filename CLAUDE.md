# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Excalidraw is a **monorepo** with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/common/`** - Shared utilities and constants
- **`packages/element/`** - Element-related logic (depends on common, math)
- **`packages/math/`** - Math utilities for 2D geometry (depends on common)
- **`packages/utils/`** - General utilities
- **`examples/`** - Integration examples (NextJS, browser script)

## Development Commands

```bash
# Core development workflow
yarn start                 # Start dev server for excalidraw-app
yarn test:typecheck        # TypeScript type checking
yarn test:update           # Run all tests with snapshot updates
yarn fix                   # Auto-fix formatting and linting issues

# Run a single test file
yarn test:app path/to/test.test.tsx

# Build packages
yarn build:packages        # Build all packages (common → math → element → excalidraw)
yarn build:app             # Build the web application
```

## Architecture Notes

### Package Dependency Order

`common` → `math` → `element` → `excalidraw`

Packages must be built in this order. The build script handles this automatically.

### Path Aliases

Internal packages use `@excalidraw/*` aliases resolved via `vitest.config.mts`:

- `@excalidraw/common` → `packages/common/src/`
- `@excalidraw/element` → `packages/element/src/`
- `@excalidraw/math` → `packages/math/src/`
- `@excalidraw/excalidraw` → `packages/excalidraw/`

### Build System

- Uses Yarn workspaces for monorepo management
- esbuild for package builds
- Vite for the app

## Code Guidelines

### TypeScript

- Prefer implementations without allocation where possible
- Opt for performant solutions; trade RAM for fewer CPU cycles
- Use optional chaining (`?.`) and nullish coalescing (`??`)

### Math Types

When writing math-related code, use branded types from `packages/math/src/types.ts`:

- `GlobalPoint` / `LocalPoint` instead of `{ x, y }`
- `Radians` / `Degrees` for angles
- `LineSegment`, `Polygon`, `Curve`, etc. for geometric shapes

### React

- Functional components with hooks
- CSS modules for component styling
