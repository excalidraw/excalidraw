# Excalidraw Development TODO

## Phase 1: ESLint 9 Migration ✅ COMPLETED

**Branch:** `fix/typescript-errors`
**Status:** Pushed, awaiting PR approval

### Summary
Successfully migrated from ESLint 8 to ESLint 9 with flat config format.

### Key Changes
- Upgraded ESLint from v8.57.1 to v9.39.1
- Upgraded @typescript-eslint packages from v5 to v8
- Migrated to flat config system (eslint.config.js)
- Removed deprecated .eslintrc.json and .eslintignore files
- Updated all ESLint-related packages to v9-compatible versions
- Manually replicated eslint-config-react-app rules (package removed)
- Added package-specific import restrictions for monorepo boundaries

### Final Status
- ✅ 0 ESLint errors
- ✅ 0 ESLint warnings
- ✅ All tests passing

## Phase 2: TypeScript Error Resolution ✅ COMPLETED

**Branch:** `fix/typescript-errors` (same as Phase 1)
**Status:** Pushed, awaiting PR approval

### Summary
Fixed all TypeScript errors and ESLint violations that appeared after ESLint 9 migration.

### Code Quality Fixes
- Fixed no-case-declarations (15 instances)
- Fixed no-unsafe-finally (4 instances)
- Fixed no-prototype-builtins (10+ instances)
- Fixed no-restricted-globals (6 instances)
- Fixed no-async-promise-executor
- Fixed no-setter-return
- Removed unused variables in catch blocks (18 files)
- Fixed invalid typeof check
- Removed invalid alpha property from image-blob-reduce options

### TypeScript Fixes
- Added @ts-expect-error suppressions for TypeScript 5.6+ monorepo dual-import false positives
- Updated @ts-ignore directives with proper explanations
- Fixed test files for ESLint 9 compatibility

### Total Commits
30 commits across Phase 1 and Phase 2

### Final Status
- ✅ 0 TypeScript errors
- ✅ 0 ESLint errors
- ✅ All builds passing

## Phase 3: Dependency Updates ✅ COMPLETED

**Branch:** `chore/dependency-updates`
**Status:** Pushed (12 commits total)
**Strategy:** Systematic workspace-by-workspace updates with build verification

### Summary
Successfully updated all core and workspace dependencies across the monorepo. Only browser-fs-access@0.29.1 remains in @excalidraw/excalidraw due to breaking TypeScript changes in 0.38.0.

### All Updates Completed

#### Root Package Updates ✅
**Patch Updates:**
- @types/react: 19.2.2 → 19.2.3
- @typescript-eslint/eslint-plugin: 8.46.3 → 8.46.4
- @typescript-eslint/parser: 8.46.3 → 8.46.4
- sass: 1.93.3 → 1.94.0

**Minor Updates:**
- @sentry/browser: 10.23.0 → 10.25.0
- autoprefixer: 10.4.7 → 10.4.22
- idb-keyval: 6.0.3 → 6.2.2
- jotai: 2.11.0/2.15.0 → 2.15.1
- vite-plugin-sitemap: 0.7.1 → 0.8.2
- @excalidraw/random-username: 1.0.0 → 1.2.0

**Major Updates:**
- clsx: 1.1.1 → 2.1.1
- globals: 15.15.0 → 16.5.0
- dotenv: 16.0.1 → 17.2.3
- which: 5.0.0 → 6.0.0
- fonteditor-core: 2.4.0/2.4.1 → 2.6.3
- browser-fs-access: 0.29.1 → 0.38.0 (root only)
- cross-env: 7.0.3 → 10.1.0
- eslint-plugin-react: 7.32.2 → 7.37.5
- eslint-plugin-react-hooks: 5.2.0 → 7.0.1
- harfbuzzjs: 0.3.6 → 0.4.13
- image-blob-reduce: 3.0.1 → 4.1.0
- rewire: 6.0.0 → 9.0.1

#### Build Tool Updates ✅
- esbuild: 0.19.10 → 0.27.0
- esbuild-sass-plugin: 2.16.0 → 3.3.1
- TypeScript: 5.6.3 → 5.9.3

#### Testing Framework Updates ✅
- chai: 4.3.6 → 6.2.1
- fake-indexeddb: 3.1.7 → 6.2.5
- jest-diff: 29.7.0 → 30.2.0
- @size-limit/preset-big-lib: 9.0.0 → 11.2.0

#### Workspace: packages/excalidraw ✅
- All dependencies updated except browser-fs-access (kept at 0.29.1)
- Moved build-time packages from dependencies to devDependencies
- autoprefixer: 10.4.7 → 10.4.22
- clsx: 1.1.1 → 2.1.1
- cross-env: 7.0.3 → 10.1.0
- dotenv: 16.0.1 → 17.2.3
- eslint-plugin-react: 7.32.2 → 7.37.5
- fonteditor-core: 2.4.1 → 2.6.3
- harfbuzzjs: 0.3.6 → 0.4.13
- image-blob-reduce: 3.0.1 → 4.1.0
- jotai: 2.15.0 → 2.15.1
- sass: 1.93.3 → 1.94.0
- And all build/test tools

#### Workspace: excalidraw-app ✅
- @sentry/browser: 10.23.0 → 10.25.0
- firebase: 11.10.0 → 12.5.0 (major version)
- i18next-browser-languagedetector: 6.1.4 → 8.2.0
- idb-keyval: 6.0.3 → 6.2.2
- jotai: 2.11.0 → 2.15.1
- vite-plugin-sitemap: 0.7.1 → 0.8.2

#### Workspace: packages/utils ✅
- browser-fs-access: 0.29.1 → 0.38.0
- cross-env: 7.0.3 → 10.1.0
- fonteditor-core: 2.4.0 → 2.6.3
- typescript: 5.6.3 → 5.9.3
- which: 5.0.0 → 6.0.0

#### Example Apps ✅
**with-nextjs:**
- @types/node: 20.17.22 → 24.10.0
- @types/react: 19.2.2 → 19.2.3
- next: 14.1.4 → 16.0.1 (major version)
- path2d-polyfill: 2.0.1 → 3.2.1

**with-script-in-browser:**
- browser-fs-access: 0.29.1 → 0.38.0
- vite: 5.0.12 → 7.2.2 (major version)

### Final Status
- ✅ All core dependencies updated
- ✅ All workspace dependencies updated
- ✅ All example app dependencies updated
- ✅ 12 commits pushed to `chore/dependency-updates`
- ✅ All builds passing (`yarn build:packages`)
- ⚠️  browser-fs-access@0.29.1 intentionally kept in @excalidraw/excalidraw (0.38.0 has breaking changes)

### Known Issues
- browser-fs-access@0.38.0 has breaking TypeScript type changes
- Firebase v12 should be tested with collaboration features
- Some peer dependency warnings for @babel/core (cosmetic, non-blocking)

## Future Work

### Potential Improvements
- [ ] Address unmet peer dependency warnings for @babel/core
- [ ] Consider updating autoprefixer in excalidraw package (currently 10.4.7, root is 10.4.22)
- [ ] Evaluate clsx update in excalidraw package (currently 1.1.1, root is 2.1.1)
- [ ] Review and address Sass deprecation warnings (map-get → map.get)
- [ ] Remove package-lock.json if not needed (yarn.lock should be sufficient)

### Technical Debt
- [ ] Investigate monorepo TypeScript dual-import issues causing @ts-ignore workarounds
- [ ] Review and possibly remove unused eslint-disable directives
- [ ] Consider stricter TypeScript configuration after dependency stabilization
