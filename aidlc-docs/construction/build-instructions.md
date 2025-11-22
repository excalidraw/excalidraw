# Build Instructions

## Prerequisites
- **Build Tool**: Yarn 1.22.22 (monorepo workspace)
- **Node Version**: 18.0.0 - 22.x.x
- **Dependencies**: All packages in monorepo
- **Environment Variables**: None required for local development
- **System Requirements**: Linux/macOS/Windows, 4GB RAM minimum

## Build Steps

### 1. Install Dependencies
```bash
# From workspace root
yarn install
```

This will install all dependencies for the monorepo including:
- Main excalidraw package
- Excalidraw-app
- All internal packages (common, element, math, utils)

### 2. Configure Environment
```bash
# No special environment configuration needed for local development
# The AI features use browser-based APIs and user-provided API keys
```

### 3. Build All Packages
```bash
# Build all packages in dependency order
yarn build:packages

# This builds:
# - packages/common
# - packages/math
# - packages/element
# - packages/utils
# - packages/excalidraw
```

### 4. Build Web Application
```bash
# Build the excalidraw-app
yarn build:app
```

### 5. Start Development Server
```bash
# For development with hot reload
yarn start

# Or for production build testing
yarn start:production
```

### 6. Verify Build Success
- **Expected Output**: 
  - No TypeScript compilation errors
  - No ESLint errors
  - Vite dev server starts successfully on http://localhost:3000
  - All packages build without errors

- **Build Artifacts**: 
  - `packages/excalidraw/dist/` - Main library bundle
  - `excalidraw-app/dist/` - Web application bundle
  - Type definitions in each package's dist folder

- **Common Warnings**: 
  - Peer dependency warnings are acceptable
  - Some deprecation warnings from dependencies are expected

## Troubleshooting

### Build Fails with Dependency Errors
- **Cause**: Corrupted node_modules or yarn.lock out of sync
- **Solution**: 
  ```bash
  yarn clean-install
  # This runs: rm:node_modules + yarn install
  ```

### Build Fails with TypeScript Errors
- **Cause**: Type mismatches in new AI feature code
- **Solution**: 
  ```bash
  # Check types across all packages
  yarn test:typecheck
  
  # Fix any type errors reported
  # Common issues:
  # - Missing imports
  # - Incorrect type annotations
  # - Atom type mismatches in Jotai
  ```

### Build Fails with ESLint Errors
- **Cause**: Code style violations
- **Solution**: 
  ```bash
  # Auto-fix most issues
  yarn fix:code
  
  # Check remaining issues
  yarn test:code
  ```

### Vite Dev Server Won't Start
- **Cause**: Port 3000 already in use or build artifacts corrupted
- **Solution**: 
  ```bash
  # Kill process on port 3000
  lsof -ti:3000 | xargs kill -9
  
  # Clean and rebuild
  yarn rm:build
  yarn build:packages
  yarn start
  ```

### Import Errors for New AI Components
- **Cause**: Path aliases not resolved or components not exported
- **Solution**: 
  - Verify exports in `packages/excalidraw/index.tsx`
  - Check import paths use `@excalidraw/*` aliases
  - Ensure TypeScript paths are configured in tsconfig.json

## Verification Checklist

After successful build:
- [ ] No TypeScript errors (`yarn test:typecheck`)
- [ ] No ESLint errors (`yarn test:code`)
- [ ] Dev server starts without errors
- [ ] Application loads in browser at http://localhost:3000
- [ ] No console errors on page load
- [ ] New AI menu items visible in dropdown
- [ ] Dialogs can be opened without errors
