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

## Phase 3: Dependency Updates 🚧 IN PROGRESS

**Branch:** `chore/dependency-updates`
**Status:** Pushed (6 commits so far)
**Strategy:** Easy updates first, then systematically work through complex changes

### Completed Updates

#### Patch Updates (backward-compatible bug fixes) ✅
- @types/react: 19.2.2 → 19.2.3
- @typescript-eslint/eslint-plugin: 8.46.3 → 8.46.4
- @typescript-eslint/parser: 8.46.3 → 8.46.4
- sass: 1.93.3 → 1.94.0

#### Minor Updates (backward-compatible features) ✅
- @sentry/browser: 10.23.0 → 10.25.0
- autoprefixer: 10.4.7 → 10.4.22
- idb-keyval: 6.0.3 → 6.2.2
- jotai: 2.11.0/2.15.0 → 2.15.1
- vite-plugin-sitemap: 0.7.1 → 0.8.2
- @excalidraw/random-username: 1.0.0 → 1.2.0

#### Major Updates (tested and working) ✅
- clsx: 1.1.1 → 2.1.1
- globals: 15.15.0 → 16.5.0
- dotenv: 16.0.1 → 17.2.3
- which: 5.0.0 → 6.0.0
- fonteditor-core: 2.4.0/2.4.1 → 2.6.3

#### Additional Fixes ✅
- Fixed unused @ts-expect-error directives
- Changed @ts-expect-error to @ts-ignore for context-dependent TypeScript errors
- All updates verified with `yarn build:packages`

### Remaining Updates (To Be Done)

#### High Priority - Build Tools
- [ ] esbuild: 0.19.10 → 0.27.0 (major version jump, test carefully)
- [ ] esbuild-sass-plugin: 2.16.0 → 3.3.1 (depends on esbuild update)
- [ ] TypeScript: 5.6.3 → 5.9.3 (major version, may affect type checking)

#### High Priority - Testing
- [ ] chai: 4.3.6 → 6.2.1 (test framework, may affect tests)
- [ ] fake-indexeddb: 3.1.7 → 6.2.5 (test utilities)
- [ ] jest-diff: 29.7.0 → 30.2.0 (test utilities)

#### Medium Priority - Runtime Dependencies
- [ ] browser-fs-access: 0.29.1 → 0.38.0 (runtime dependency)
- [ ] cross-env: 7.0.3 → 10.1.0 (build scripts)
- [ ] image-blob-reduce: 3.0.1 → 4.1.0 (image processing)
- [ ] i18next-browser-languagedetector: 6.1.4 → 8.2.0 (i18n)
- [ ] harfbuzzjs: 0.3.6 → 0.4.13 (font rendering)

#### Medium Priority - Example Apps
- [ ] Vite: 5.0.12 → 7.2.2 (with-script-in-browser example)
- [ ] Next.js: 14.1.4 → 16.0.1 (with-nextjs example)
- [ ] @types/node: 20.17.22 → 24.10.0 (with-nextjs example)
- [ ] path2d-polyfill: 2.0.1 → 3.2.1 (with-nextjs example)

#### Lower Priority - Firebase
- [ ] firebase: 11.10.0 → 12.5.0 (major version, test collaboration features)

#### Lower Priority - Dev Tools
- [ ] @size-limit/preset-big-lib: 9.0.0 → 11.2.0 (size checking)
- [ ] eslint-plugin-react: 7.32.2 → 7.37.5 (in excalidraw package)
- [ ] eslint-plugin-react-hooks: 5.2.0 → 7.0.1 (linting)
- [ ] rewire: 6.0.0 → 9.0.1 (testing utilities)

### Next Steps
1. Update TypeScript to 5.9.3 and verify all type checking passes
2. Update esbuild and esbuild-sass-plugin together
3. Update testing frameworks (chai, fake-indexeddb, jest-diff)
4. Update runtime dependencies one at a time
5. Update example apps (separate PRs?)
6. Update Firebase (test collaboration thoroughly)
7. Final verification: `yarn test:all`

### Notes
- All updates should be tested with `yarn build:packages` and `yarn test:app`
- Keep commits atomic and well-documented
- Consider creating separate PRs for:
  - Build tool updates (TypeScript, esbuild)
  - Testing framework updates
  - Example app updates
  - Firebase update (if collaboration needs extensive testing)

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
