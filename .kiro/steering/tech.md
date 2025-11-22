# Technology Stack & Build System

## Build System

**Primary**: Yarn workspaces monorepo with custom build scripts
**Package Manager**: Yarn 1.22.22 (specified in packageManager field)
**Node Version**: 18.0.0 - 22.x.x

## Core Technologies

- **Frontend**: React 19.0.0, TypeScript 4.9.4
- **Build Tools**: Vite 5.0.12, esbuild 0.19.10
- **Testing**: Vitest 3.0.6, @testing-library/react
- **Styling**: Sass 1.51.0, CSS modules
- **State Management**: Jotai 2.11.0 (app-specific modules only)
- **Canvas Rendering**: Custom canvas implementation with roughjs for hand-drawn style

## Key Libraries

- **Drawing Engine**: roughjs, perfect-freehand, points-on-curve
- **UI Components**: @radix-ui (popover, tabs)
- **Utilities**: lodash.throttle, lodash.debounce, nanoid, clsx
- **File Handling**: browser-fs-access, pako (compression)
- **Image Processing**: pica, image-blob-reduce

## Monorepo Structure

```
packages/
├── common/          # Shared utilities and constants
├── element/         # Element-related logic (depends on common, math)
├── math/           # Mathematical functions and vector operations
├── utils/          # Utility functions (standalone)
└── excalidraw/     # Main React component (depends on all above)

excalidraw-app/     # Web application
examples/           # Integration examples
```

## Common Commands

### Development
```bash
# Start development server
yarn start

# Start with production build
yarn start:production

# Run example app
yarn start:example
```

### Building
```bash
# Build all packages
yarn build:packages

# Build specific packages
yarn build:common
yarn build:element  
yarn build:math
yarn build:excalidraw

# Build web app
yarn build:app

# Build everything
yarn build
```

### Testing
```bash
# Run all tests
yarn test:all

# Run unit tests
yarn test

# Run with coverage
yarn test:coverage

# Run with UI
yarn test:ui

# Type checking
yarn test:typecheck

# Linting
yarn test:code

# Format checking
yarn test:other
```

### Maintenance
```bash
# Fix linting issues
yarn fix:code

# Fix formatting
yarn fix:other

# Fix all
yarn fix

# Clean builds
yarn rm:build

# Clean node_modules
yarn rm:node_modules

# Clean install
yarn clean-install
```

## Build Configuration

- **TypeScript**: Strict mode enabled, ESNext target
- **Module System**: ESM (type: "module" in all packages)
- **Path Aliases**: Configured for @excalidraw/* imports
- **Browser Support**: Modern browsers only (>0.2%, not IE)

## Code Quality Tools

- **ESLint**: @excalidraw/eslint-config + react-app rules
- **Prettier**: @excalidraw/prettier-config
- **Husky**: Pre-commit hooks with lint-staged
- **TypeScript**: Strict type checking across all packages

## Import Rules

- Use `@excalidraw/*` aliases for internal packages
- Import from app-specific jotai modules (`editor-jotai`, `app-jotai`) not directly from `jotai`
- Consistent type imports with `@typescript-eslint/consistent-type-imports`
- Organized import groups with specific ordering