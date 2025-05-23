# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Excalidraw is a **monorepo** with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`
- **`examples/`** - Integration examples (NextJS, browser script)

The library provides the core drawing component, while the app adds collaboration, PWA features, and persistence.

## Development Commands

### Building
```bash
yarn build                    # Build the entire application
yarn build:package           # Build only the npm package
yarn build:app               # Build only the web app
```

### Testing
```bash
yarn test                    # Run tests with Vitest
yarn test:all                # Run all tests (typecheck, lint, code, other)
yarn test:typecheck          # TypeScript type checking
yarn test:code               # ESLint code quality checks
yarn test:coverage           # Run tests with coverage report
yarn test:ui                 # Interactive test UI with coverage
```

### Development
```bash
yarn start                   # Start development server for the app
yarn start:example           # Build package and run browser example
```

### Code Quality
```bash
yarn fix                     # Auto-fix formatting and linting issues
yarn fix:code               # Auto-fix ESLint issues
yarn fix:other              # Auto-fix Prettier formatting
```

## Architecture Notes

### Package System
- Uses Yarn workspaces for monorepo management
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration

### State Management
- **Jotai** for atomic state management
- Editor state isolated in stores
- Context tunneling for component communication

### Testing
- **Vitest** with jsdom environment
- Coverage thresholds: 60% lines, 70% branches, 63% functions
- Snapshot testing for components

### Key Files
- `scripts/buildPackage.js` - Custom build logic for packages
- `vitest.config.mts` - Test configuration with package aliases
- Root `package.json` - Workspace configuration and main scripts

## Development Workflow

1. **Package Development**: Work in `packages/excalidraw/` for core features
2. **App Development**: Work in `excalidraw-app/` for app-specific features
3. **Testing**: Always run `yarn test:all` before committing
4. **Type Safety**: Use `yarn test:typecheck` to verify TypeScript

## Path Aliases

Internal packages can be imported using aliases:
- `@excalidraw/excalidraw` → `packages/excalidraw/`
- `@excalidraw/common` → `packages/common/src/`
- `@excalidraw/element` → `packages/element/src/`
- `@excalidraw/math` → `packages/math/src/`
- `@excalidraw/utils` → `packages/utils/src/`