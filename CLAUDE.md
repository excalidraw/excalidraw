# CLAUDE.md

## Project Structure

Excalidraw is a **monorepo** with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/history`, `@excalidraw/math`, `@excalidraw/utils`
- **`examples/`** - Integration examples (NextJS, browser script)

## Development Workflow

1. **Package Development**: Work in `packages/*` for editor features
2. **App Development**: Work in `excalidraw-app/` for app-specific features
3. **Testing**: Always run `pnpm test:update` before committing
4. **Type Safety**: Use `pnpm test:typecheck` to verify TypeScript

## Development Commands

```bash
pnpm test:typecheck  # TypeScript type checking
pnpm test:update     # Run all tests (with snapshot updates)
pnpm fix             # Auto-fix formatting and linting issues
```

## Architecture Notes

### Package System

- Uses pnpm workspaces for monorepo management
- Internal packages depend on each other via `workspace:*` and resolve to their sources through the `excalidraw-source` export condition (enabled in tsconfig, Vite, Vitest and the esbuild scripts); `publishConfig.exports` holds the published dist exports
- A package can't import itself by name: use relative imports inside a package
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration
