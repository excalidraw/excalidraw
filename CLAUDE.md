# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Excalidraw is an open-source, hand-drawn style whiteboard application built as a **monorepo** with separate npm packages and web app components. It can be used as a standalone web application (excalidraw.com) or embedded as the `@excalidraw/excalidraw` React package.

**Key characteristics:**

- TypeScript + React 19 with Jotai (atom-based state management)
- Canvas-based rendering (not DOM) for performance
- Monorepo structure: workspaces for `excalidraw-app`, `packages/*`, and `examples/*`
- Real-time collaboration with end-to-end encryption (Firebase + Socket.io)
- PWA support with offline capabilities
- 40+ language support

## Monorepo Structure

```
excalidraw/
├── packages/
│   ├── common/              # Shared constants, types, utilities
│   ├── element/             # Element-related logic (mutations, queries)
│   ├── math/                # Mathematical utilities (vector ops, geometry)
│   ├── utils/               # Export utilities (canvas, SVG, blob ops)
│   └── excalidraw/          # Main editor package
│       ├── components/      # React UI components
│       ├── actions/         # 46+ action handlers (user interactions)
│       ├── renderer/        # Canvas rendering pipeline
│       ├── scene/           # Scene management (zoom, pan, scroll)
│       ├── data/            # Data persistence & transformations
│       ├── hooks/           # Custom React hooks
│       └── types.ts         # Type definitions
├── excalidraw-app/          # Web app (excalidraw.com)
│   ├── collab/              # Collaboration implementation
│   ├── share/               # Link sharing & persistence
│   └── vite.config.mts      # Vite build configuration
└── examples/                # Integration examples (Next.js, browser)
```

Use path aliases to import from packages (e.g., `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`, `@excalidraw/excalidraw`).

## Development Commands

**Setup & Installation:**

```bash
yarn install                 # Install dependencies
```

**Local Development:**

```bash
yarn start                   # Start dev server with HMR (port 3000)
yarn start:production        # Start production server
yarn start:example           # Start example integration
```

**Building:**

```bash
yarn build                   # Complete build (app + packages)
yarn build:app               # Build web app only
yarn build:packages          # Build all packages (common, math, element, excalidraw)
yarn build:common            # Build @excalidraw/common
yarn build:math              # Build @excalidraw/math
yarn build:element           # Build @excalidraw/element
yarn build:excalidraw        # Build @excalidraw/excalidraw
yarn build:preview           # Build preview version
```

**Testing:**

```bash
yarn test                    # Run tests in watch mode
yarn test:app --watch=false  # Run tests once (CI mode)
yarn test:coverage           # Generate coverage report
yarn test:coverage:watch     # Coverage with watch mode
yarn test:ui                 # Open Vitest UI dashboard
yarn test:all                # Full check suite (lint, typecheck, tests, format)
yarn test:update             # Update test snapshots
```

**Individual Test Files:**

```bash
vitest packages/excalidraw/tests/element.test.ts              # Run specific test file
vitest packages/excalidraw/tests --watch                      # Run tests in a directory
```

**Code Quality:**

```bash
yarn test:typecheck          # TypeScript type checking
yarn test:code               # ESLint (strict, no warnings allowed)
yarn test:other              # Prettier format check
yarn fix:code                # ESLint fix with --fix
yarn fix:other               # Prettier format fix
yarn fix                     # Run all fixes
```

**Maintenance:**

```bash
yarn rm:build                # Remove all build artifacts
yarn rm:node_modules         # Remove all node_modules
yarn clean-install           # Clean install (rm node_modules + reinstall)
```

## Architecture Patterns & Key Concepts

### State Management (Jotai)

Excalidraw uses **Jotai** for atom-based state management, enabling fine-grained reactivity:

- **Editor atoms** (`packages/excalidraw/editor-jotai.ts`): Core editor state

  - `elementSetsAtom` - All drawable elements
  - `selectedElementIdsAtom` - Current selection
  - `appStateAtom` - App-wide config (tools, zoom, UI state)

- **App atoms** (`excalidraw-app/app-jotai.ts`): App-specific state
  - Collaboration state
  - Storage/persistence
  - Theme preferences

**Update pattern:** Changes to atoms trigger subscribed components to re-render. Use `useAtom()` or `useAtomValue()` hooks in React components.

### Rendering Pipeline

The rendering system uses Canvas API with three layers:

1. **Interactive Scene** (`renderer/interactiveScene.ts`): Real-time drawing

   - Renders all elements with current app state
   - Shows selection handles, snap guides, animations
   - Most frequently updated

2. **Static Scene** (`renderer/staticScene.ts`): Export/preview

   - Immutable rendering for exports
   - Used for PNG export

3. **Static SVG Scene** (`renderer/staticSvgScene.ts`): SVG export
   - Generates exportable SVG format

All rendering uses RoughJS for the hand-drawn aesthetic.

### Element System

All drawable items inherit from `ExcalidrawElement`:

- **Linear elements:** lines, arrows, freehand
- **Bindable elements:** rectangles, diamonds, ellipses (can have arrows bound)
- **Text elements:** with font subsetting
- **Images:** with compression
- **Frames:** for organizing content

Elements are **immutable** — updates create new instances via `newElementWith()` or `mutateElement()`. Each element has a `versionNonce` for tracking changes.

### Action System

User interactions map to **centralized actions** in `packages/excalidraw/actions/`:

- 46+ action handlers (edit, transform, style, etc.)
- Actions receive context: elements state, app state, API for modifications
- Actions are triggered by keyboard shortcuts, UI buttons, and menu items
- Use the action registry to find or add new actions

### Data Persistence

The `data/` directory handles all persistence:

- **restore.ts** - Load .excalidraw JSON files
- **reconcile.ts** - Merge remote changes (collaboration)
- **transform.ts** - Convert element formats
- **json.ts** - Serialization/deserialization
- **blob.ts** - Binary file operations
- **library.ts** - Shape library management

### Collaboration Architecture

Real-time collaboration (`excalidraw-app/collab/`) uses:

- **Firebase** for infrastructure
- **Socket.io** for WebSocket updates
- **Reconciliation algorithm** for conflict resolution
- **Incremental updates** via CaptureUpdateAction

## Code Quality Standards

From `.github/copilot-instructions.md`:

### TypeScript

- Use TypeScript for all new code (strict mode)
- Prefer implementations without unnecessary allocations
- Prefer immutable data (`const`, `readonly`)
- Use optional chaining (`?.`) and nullish coalescing (`??`) operators
- When choosing between performance approaches, trade RAM for fewer CPU cycles

### React

- Use functional components with hooks
- Follow React hooks rules (no conditional hooks)
- Keep components small and focused
- Use CSS modules for styling

### Math

- Always include `packages/math/src/types.ts` when writing math code
- Use the `Point` type instead of `{ x, y }` objects

### Naming Conventions

- **PascalCase**: Component names, interfaces, type aliases
- **camelCase**: Variables, functions, methods
- **ALL_CAPS**: Constants

### Error Handling & Testing

- Use try/catch for async operations
- Implement error boundaries in React
- Run `yarn test:app` after modifications to catch issues early

## Import Path Aliases

The build is configured with module aliases for cleaner imports:

```typescript
// Instead of:
import { Point } from "../../../packages/math/src/types";

// Use:
import { Point } from "@excalidraw/math";
import type { ExcalidrawElement } from "@excalidraw/element";
```

Aliases are configured in `vitest.config.mts` and `excalidraw-app/vite.config.mts`.

## Key Directories for Common Tasks

- **Adding UI components**: `packages/excalidraw/components/`
- **Adding element interactions**: `packages/excalidraw/actions/`
- **Fixing rendering issues**: `packages/excalidraw/renderer/`
- **Data format changes**: `packages/excalidraw/data/`
- **Styling**: CSS/SCSS files colocated with components
- **Localization strings**: `packages/excalidraw/locales/`
- **Type definitions**: `packages/excalidraw/types.ts`, `packages/*/src/types.ts`

## Testing Setup

Tests use **Vitest** with:

- **jsdom** environment for DOM simulation
- **@testing-library/react** for component testing
- **Canvas mocking** via `vitest-canvas-mock`
- **IndexedDB mocking** via `fake-indexeddb`
- Coverage targets: 60% lines, 70% branches, 63% functions, 60% statements

Test files colocate with source or live in `tests/` directories. Setup happens in `setupTests.ts`.

## Build Outputs

Package builds generate dual outputs:

- `dist/dev/` - Development builds (unminified, source maps)
- `dist/prod/` - Production builds (minified)
- `dist/types/` - TypeScript type definitions (`.d.ts`)

The excalidraw package exports both development and production versions, with build tools selecting the appropriate one based on environment.

## Performance Considerations

- **Canvas-based rendering** instead of DOM for performance
- **Throttled event handlers** to reduce re-renders
- **Selective React.memo** for component optimization
- **Image compression** via pica library
- **Font subsetting** to reduce font file sizes
- **Code splitting** via Vite for faster initial load
- **PWA caching** with runtime cache for locales and fonts
