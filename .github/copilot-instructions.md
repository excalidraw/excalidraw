# Excalidraw AI Coding Guidelines

## Communication Standards

- Be succinct - expansive AI responses are costly and slow
- Prefer code over explanations unless specifically asked
- Skip apologies and summaries unless requested
- Assume expert-level knowledge from developers

## Architecture Overview

### Monorepo Structure
- **`packages/excalidraw/`** - Core library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web app (excalidraw.com) consuming the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`
- **`examples/`** - Integration examples (NextJS, browser script)

### State Management (Jotai)
- Two **separate** Jotai stores exist due to isolation requirements:
  - **Editor store**: `packages/excalidraw/editor-jotai.ts` - Uses `jotai-scope` for isolation
  - **App store**: `excalidraw-app/app-jotai.ts` - Global app state
- Import from the correct store based on context - never mix them
- Editor atoms must use `EditorJotaiProvider` wrapper; app atoms use `appJotaiStore`
- Example pattern: `export const myAtom = atom<Type>(initialValue);`

### Collaboration Architecture
- Real-time collaboration uses WebSocket (Socket.io) + Firebase for persistence
- Flow: Local changes → WebSocket broadcast → Firebase save (throttled)
- End-to-end encryption: Data encrypted before WebSocket/Firebase transmission
- Key components: `excalidraw-app/collab/Collab.tsx`, `Portal.tsx`, `data/firebase.ts`
- Reconciliation handles conflicts when multiple users edit simultaneously

## Development Workflow

### Essential Commands
```bash
yarn start                  # Start dev server (excalidraw-app)
yarn test:app              # Run Vitest tests
yarn test:typecheck        # TypeScript validation
yarn test:update           # Update test snapshots
yarn fix                   # Auto-fix linting/formatting
yarn build:packages        # Build all packages (required before examples)
```

### Testing
- Tests use Vitest (not Jest) - check `vitest.config.mts`
- Helper utilities: `packages/excalidraw/tests/helpers/api.ts`, `ui.ts`
- Global test state via `window.h` object (see `createTestHook()`)
- Use `API.createElement()` to generate test elements
- Use `Pointer` class for simulating mouse/touch interactions
- Always run `yarn test:app` after modifications and fix reported issues
- Example test pattern:
  ```typescript
  import { render } from "../tests/test-utils";
  import { API } from "../tests/helpers/api";
  const { h } = window; // Access app state in tests
  ```

### Path Aliases
Both `tsconfig.json` and `vitest.config.mts` define these aliases:
```typescript
@excalidraw/common      → packages/common/src/index.ts
@excalidraw/excalidraw  → packages/excalidraw/index.tsx
@excalidraw/element     → packages/element/src/index.ts
@excalidraw/math        → packages/math/src/index.ts
@excalidraw/utils       → packages/utils/src/index.ts
```

## Code Standards

### TypeScript
- Strict mode enabled - handle all null/undefined cases
- Prefer implementations without allocations (performance critical)
- Trade RAM for CPU cycles when optimizing
- Use `readonly` and `const` for immutability
- Optional chaining (`?.`) and nullish coalescing (`??`) operators required
- Always include `packages/math/src/types.ts` for math code - use `Point` type instead of `{ x, y }`

### React
- Functional components with hooks only
- No conditional hooks (violates React rules)
- Keep components small and focused
- CSS modules for component styling
- For cross-component state, use Jotai atoms (not Context for simple values)

### Naming
- PascalCase: Components, interfaces, type aliases
- camelCase: Variables, functions, methods
- ALL_CAPS: Constants
- Suffix test files: `.test.tsx` or `.test.ts`

### Error Handling
- Use try/catch for async operations
- Implement React error boundaries
- Always log errors with context
- Collaboration errors go through `collabErrorIndicatorAtom` in `excalidraw-app`

## Key Patterns

### Creating Elements
```typescript
import { API } from "./tests/helpers/api";
const rect = API.createElement({ 
  type: "rectangle", 
  x: 0, 
  y: 0, 
  width: 100, 
  height: 50 
});
```

### Accessing App State in Tests
```typescript
const { h } = window;
h.state          // AppState
h.elements       // Scene elements
h.app            // App instance
```

### Adding Jotai State
```typescript
// In packages/excalidraw:
import { atom, useAtom } from "../editor-jotai";
export const myAtom = atom<boolean>(false);

// In excalidraw-app:
import { atom, useAtom, appJotaiStore } from "../app-jotai";
export const myAtom = atom<boolean>(false);
appJotaiStore.set(myAtom, true); // Imperative updates
```

## Build System
- Vite for dev/build (both app and packages)
- esbuild for package bundling (`scripts/buildPackage.js`)
- Yarn workspaces for dependency management
- Node.js >= 18.0.0 required
