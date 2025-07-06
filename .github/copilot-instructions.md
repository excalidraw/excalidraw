# Project coding standards

## Generic Communication Guidelines

- Be succint and be aware that expansive generative AI answers are costly and slow
- Avoid providing explanations, trying to teach unless asked for, your chat partner is an expert
- Stop apologising if corrected, just provide the correct information or code
- Prefer code unless asked for explanation
- Stop summarizing what you've changed after modifications unless asked for

## TypeScript Guidelines

- Use TypeScript for all new code
- Where possible, prefer implementations without allocation
- When there is an option, opt for more performant solutions and trade RAM usage for less CPU cycles
- Prefer immutable data (const, readonly)
- Use optional chaining (?.) and nullish coalescing (??) operators

## React Guidelines

- Use functional components with hooks
- Follow the React hooks rules (no conditional hooks)
- Keep components small and focused
- Use CSS modules for component styling

## Naming Conventions

- Use PascalCase for component names, interfaces, and type aliases
- Use camelCase for variables, functions, and methods
- Use ALL_CAPS for constants

## Error Handling

- Use try/catch blocks for async operations
- Implement proper error boundaries in React components
- Always log errors with contextual information

## Types

- Always include `packages/math/src/types.ts` in the context when your write math related code and always use the Point type instead of { x, y}

# GEMINI.md

DO NOT EDIT MARKDOWN OR COMMENTS ALWAYS CREATE A DETAIELD PLAN AND APPROVE IT BY ME FIRST BEFORE STARTING TO CHANGE ANYTHING

## Project Structure

Excalidraw is a **monorepo** with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`
- **`examples/`** - Integration examples (NextJS, browser script)

## Development Workflow

1. **Package Development**: Work in `packages/*` for editor features
2. **App Development**: Work in `excalidraw-app/` for app-specific features
3. **Type Safety**: Use `yarn test:typecheck` to verify TypeScript
4. test with yarn build

## Development Commands

```bash
yarn test:typecheck  # TypeScript type checking
yarn build     # Run all tests (with snapshot updates)
yarn fix             # Auto-fix formatting and linting issues
```

## Architecture Notes

### Package System

- Uses Yarn workspaces for monorepo management
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration
- explain the changes
