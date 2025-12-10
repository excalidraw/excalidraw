# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

### Development

- **Start dev server**: `yarn start` (runs excalidraw-app on port 3000)
- **Build for production**: `yarn build` (builds excalidraw-app)
- **Build packages only**: `yarn build:packages` (builds common, math, element, excalidraw)
- **Single package build**: `yarn build:excalidraw` (or :common, :element, :math)

### Testing & Quality

- **Run all tests**: `yarn test:all` (typecheck + lint + format + vitest)
- **Run unit tests**: `yarn test` or `yarn test:app` (vitest, watches by default)
- **Run single test file**: `vitest packages/excalidraw/tests/my-test.test.ts`
- **Tests with coverage**: `yarn test:coverage` or `yarn test:coverage:watch`
- **Tests UI mode**: `yarn test:ui` (interactive test dashboard)
- **Typecheck**: `yarn test:typecheck` (tsc)
- **Lint code**: `yarn test:code` (eslint, zero warnings enforced)
- **Format check**: `yarn test:other` (prettier)
- **Fix linting**: `yarn fix:code` (eslint --fix)
- **Fix formatting**: `yarn fix:other` (prettier --write)
- **Fix everything**: `yarn fix`

### Cleanup & Setup

- **Clean install**: `yarn clean-install` (removes all node_modules and reinstalls)
- **Clear builds**: `yarn rm:build` (removes all dist/build directories)

## Monorepo Structure

Excalidraw is a **Yarn monorepo** with these workspaces:

```
excalidraw/
├── packages/
│   ├── excalidraw/          # Main npm package (@excalidraw/excalidraw)
│   ├── common/              # Shared constants & types
│   ├── element/             # Element type definitions and utilities
│   ├── math/                # Math utilities and geometric operations
│   └── utils/               # General utilities
├── excalidraw-app/          # Web app at excalidraw.com
└── examples/                # Integration examples
```

The **main editor** lives in `packages/excalidraw/` with these key directories:

- `actions/` - ~40 action handlers (align, flip, export, etc.)
- `components/` - 150+ React UI components (buttons, menus, dialogs, toolbars)
- `data/` - Data persistence and local storage logic
- `renderer/` - Canvas rendering and drawing logic
- `scene/` - Scene graph and element management system
- `hooks/` - React custom hooks for editor functionality
- `context/` - React context providers
- `css/` - SCSS stylesheets
- `tests/` - Comprehensive test coverage

## Architecture & State Management

### State Management (Jotai)

- Uses **Jotai atoms** for global state (atom-based, not Redux)
- Main state in `packages/excalidraw/appState.ts`
- Provider: `EditorJotaiProvider` wraps the editor
- Access atoms via `useAtom()` hooks

### Core Concepts

- **Elements**: Basic drawable objects (shapes, text, arrows, etc.)
- **Scene**: Collection of elements with change tracking
- **EditorState**: UI state (selected elements, tool, zoom, etc.)
- **Actions**: Handlers for user interactions and commands

### Rendering

- Canvas-based rendering in `renderer/`
- RoughJS for hand-drawn aesthetic
- Performance optimized with batching and dirty tracking

## Development Patterns

### React & Hooks

- Use functional components with hooks (no class components)
- Follow React hooks rules (no conditional hooks)
- Use CSS modules for styling: `import styles from "./Component.module.scss"`
- Keep components small and focused

### TypeScript Guidelines (from .github/copilot-instructions.md)

- All new code must use TypeScript
- Prefer immutable data (const, readonly)
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Use `Point` type from `@excalidraw/math/types` instead of `{ x, y }` for coordinates
- When writing math code, include `packages/math/src/types.ts` in context

### Naming Conventions

- **PascalCase**: Components, interfaces, types
- **camelCase**: Variables, functions, methods
- **ALL_CAPS**: Constants

### Performance

- Prefer implementations without allocation
- Trade RAM for CPU cycles (memoization, caching)
- Avoid unnecessary re-renders

## Build Details

### Excalidraw App (Web)

- **Framework**: React 19 + TypeScript + Vite
- **Config**: `excalidraw-app/vite.config.mts`
- **Output**: `excalidraw-app/build/`
- **Plugins**: PWA support, SVGR, EJS templates, HTML plugin, sitemap
- **Port**: Default 3000 (configurable via `VITE_APP_PORT`)
- **Features**: PWA, Sentry error tracking, Firebase for collaboration, i18n

### Core Package

- **Build tool**: Custom esbuild-based build (see `scripts/buildPackage.js`)
- **Output**: ESM modules in `dist/prod/` and `dist/dev/`
- **Exports**: Configured in `packages/excalidraw/package.json`
- **CSS**: SCSS compiled to both dev and prod bundles

## Testing Setup

- **Framework**: Vitest (Jest-compatible)
- **React Testing**: Testing Library + React Testing Library
- **Coverage**: Vitest coverage reporter
- **Canvas Testing**: vitest-canvas-mock for rendering tests
- **Test files**: Colocated with source (`.test.ts` suffix)

## Important Notes

### Node & Package Manager

- Node >= 18.0.0 required
- Yarn 1.22.22 (use `yarn`, not `npm`)

### Localization

- 60+ languages in `packages/excalidraw/locales/`
- i18n coverage tracked with `yarn locales-coverage`

### CI/CD

- GitHub Actions workflows in `.github/workflows/`
- Release automation in `scripts/release.js`

### Third-party Services

- Firebase: Real-time collaboration & auth
- Sentry: Error tracking
- Socket.io: WebSocket communication

## Common Workflows

### Adding a New Feature

1. Create feature branch from `master`
2. Implement in appropriate package (usually `packages/excalidraw/`)
3. Add tests alongside code
4. Run `yarn test:all` to verify quality
5. Create PR

### Fixing a Bug

1. Add test that reproduces the issue
2. Fix the bug
3. Verify test passes: `yarn test` (watch mode)
4. Run `yarn test:all` before committing

### Modifying UI Components

- Edit component in `packages/excalidraw/components/`
- Update/add tests in `packages/excalidraw/tests/`
- Use CSS modules for styling
- Test in dev server: `yarn start`

### Updating Math or Geometry Logic

- Include `packages/math/src/types.ts` for Point type definitions
- Use `Point` type instead of inline `{ x, y }` objects
- Add tests for edge cases
- Rebuild with `yarn build:math` if needed
