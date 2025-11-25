# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Excalidraw is a **monorepo** with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/common/`** - Shared utilities, constants, and functions
- **`packages/element/`** - Element-related logic and operations
- **`packages/math/`** - Math utilities, 2D vector algebra, and geometric calculations
- **`packages/utils/`** - General utility functions
- **`examples/`** - Integration examples (NextJS, browser script)

## Development Commands

### Starting Development

```bash
yarn start              # Start the app in development mode (runs excalidraw-app)
yarn build              # Build the app for production
yarn build:packages     # Build all packages (common, math, element, excalidraw)
```

### Testing

```bash
yarn test               # Run tests in watch mode
yarn test:app           # Run tests using vitest
yarn test:update        # Run tests and update snapshots (use before committing)
yarn test:typecheck     # TypeScript type checking across all packages
yarn test:all           # Run all tests (typecheck, code, app)
yarn test:coverage      # Run tests with coverage report
yarn test:ui            # Run tests with Vitest UI
```

### Code Quality

```bash
yarn fix                # Auto-fix both formatting and linting issues
yarn fix:code           # Fix ESLint issues
yarn fix:other          # Fix Prettier formatting
yarn test:code          # Run ESLint
yarn test:other         # Check Prettier formatting
```

### Building Packages

```bash
yarn build:common       # Build @excalidraw/common package
yarn build:element      # Build @excalidraw/element package
yarn build:math         # Build @excalidraw/math package
yarn build:excalidraw   # Build @excalidraw/excalidraw package
```

## Architecture & Development Guidelines

### Package System

- Uses **Yarn workspaces** for monorepo management
- Internal packages use **path aliases** configured in `tsconfig.json` and `vitest.config.mts`
- Build system: **esbuild** for packages, **Vite** for the app
- TypeScript with **strict mode** enabled throughout

### Path Aliases

When importing from internal packages, use these aliases:

```typescript
import { ... } from "@excalidraw/common";
import { ... } from "@excalidraw/element";
import { ... } from "@excalidraw/math";
import { ... } from "@excalidraw/utils";
import { ... } from "@excalidraw/excalidraw";
```

### TypeScript Guidelines

- Use TypeScript for all new code
- Prefer implementations without unnecessary allocations (performance-focused)
- Trade RAM usage for less CPU cycles when possible
- Use immutable data (`const`, `readonly`)
- Use optional chaining (`?.`) and nullish coalescing (`??`)

### React Guidelines

- Use functional components with hooks
- Follow React hooks rules (no conditional hooks)
- Keep components small and focused
- Use CSS modules for component styling

### Math Types

**IMPORTANT**: When writing math-related code, always use the `Point` type from `packages/math/src/types.ts` instead of inline `{ x, y }` objects. Include this file in context when writing math code.

### Naming Conventions

- **PascalCase**: Component names, interfaces, type aliases
- **camelCase**: Variables, functions, methods
- **ALL_CAPS**: Constants

### Testing Protocol

- Always run `yarn test:update` before committing to update snapshots
- After making modifications, run `yarn test:app` to verify tests pass
- Fix any test failures before considering work complete

### Communication Style

Per project guidelines (`.github/copilot-instructions.md`):

- Be succinct; avoid expansive explanations
- Prefer code over lengthy explanations unless asked
- Don't apologize when corrected; provide the fix
- Don't summarize changes unless requested
- Focus on being an expert peer, not a teacher
