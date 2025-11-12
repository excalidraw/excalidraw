# Building and Using a Customized `@excalidraw` Package

This document collects steps, common pitfalls, and links for building a customized version of the `packages/excalidraw` package from the Excalidraw monorepo and using it in other projects. It also includes troubleshooting tips for issues such as type errors during ESM builds and differences between local builds and the npm-published package.

Use this as a one-stop place to paste links, commands, and notes that help contributors and integrators.

## Quick checklist

- [ ] Make your code changes under `packages/excalidraw`.
- [ ] Run the local builds described below.
- [ ] Use `yalc` or `npm pack` to test the package in a consumer app.
- [ ] If you hit type errors in `build:esm`, see the 'Type errors' section.

## Recommended local test flow

1. From the repo root, install deps and build shared packages:

   - Install root dependencies: `pnpm install` (or `npm install`/`yarn` depending on your workflow).
   - Build the monorepo: `pnpm -w build` (or `pnpm build` from the root if configured).

2. Build only the `excalidraw` package (useful when iterating):

   - From the repo root: `pnpm --filter @excalidraw build` (if using pnpm workspace filters).

3. Test the package in a consumer app using `yalc` (recommended):

   - Install yalc globally: `npm i -g yalc`.
   - From `packages/excalidraw`: `yalc publish --push`.
   - In the consumer project: `yalc add @excalidraw` and run its build/dev server.

   Advantages of `yalc`: fast iteration, easy revert, no need to publish to npm.

4. Alternative: use `npm pack` and install the tarball in the consumer project:

   - From `packages/excalidraw`: `npm pack` -> creates `excalidraw-<version>.tgz`.
   - In the consumer: `npm i ../path/to/excalidraw-<version>.tgz`.

## Common issues and fixes

Below are frequent problems and practical fixes.

### Built files import from `node_modules` differently than npm package

Symptom: The built `index.js` in your local build contains different import paths (for example importing from raw `node_modules` paths) compared with the npm published bundle.

Cause and fix:

- The monorepo build may produce untranspiled ESM files intended for internal packaging. The npm package often contains bundled/compiled output (Rollup/ESBuild) with rewritten imports and a single entry file. Verify your `package.json` fields (`main`, `module`, `exports`) in `packages/excalidraw` and compare them to the published npm package (or the `dist` on npm). Make sure build outputs match those fields.

- Ensure you run the top-level bundling step. Some scripts expect a root-level step that collects and bundles outputs from individual packages.

- For quick comparison: install the npm package in a temp directory and compare `node_modules/@excalidraw` to your local `packages/excalidraw/dist` (or `lib`) folder.

### Using the local package in another project still references monorepo internals

Fixes:

- Use `yalc` or `npm pack` as described above; these will create an installable package with its own node_modules links.
- If you must `npm link` or `yarn link`, be aware it creates symlinks that can cause duplicate React instances. Prefer `yalc` to avoid React duplication and type mismatches.

### Type errors in `build:esm` (e.g., React `h` type)

Symptom: `packages/utils` or `packages/excalidraw` `build:esm` fails with TypeScript errors related to React's `h` type or JSX runtime types.

Why it happens:

- The monorepo may be configured with `jsx: react-jsx` (automatic runtime) and expects certain `@types/react` versions or `tsconfig` settings. When building subpackages separately, TypeScript can pick up incompatible or missing types.

Fixes and mitigations:

- Ensure consistent `@types/react` and `react` versions across the workspace. Pin them in the root `package.json` or via `pnpm` overrides/`resolutions`.

- Check `tsconfig.json` inheritance. Many packages use `tsconfig.base.json` from the repo root; ensure the build tooling loads the correct config. For example, add an explicit `-p` flag pointing to the right tsconfig when running `tsc`.

- For ESM builds using tools like esbuild/tsup/rollup, ensure the bundler's TS plugin uses the same `jsx` transform (automatic vs classic) as the rest of the repo.

- If the error mentions `h` or `JSX.Element` mismatches, try installing the matching `@types/react` version in `packages/utils` temporarily to confirm the cause.

Example commands to try:

```powershell
# run tsc with explicit config from package folder
npx tsc -p packages/utils/tsconfig.json --noEmit

# Or run the package build script but ensure env picks the root tsconfig
cd packages/utils; NODE_ENV=production pnpm build
```

### Duplicate React instances or runtime mismatch

Symptom: Errors at runtime like "Invalid hook call" or styles/components failing due to multiple React copies.

Fixes:

- Ensure the consumer project and the built package resolve to the same React instance. Do not bundle React into the package; declare it as a peer dependency in `packages/excalidraw/package.json`.
- Use `yalc` which installs the package into consumer node_modules; if React still duplicates, check hoisting settings and lockfile behavior.

## How the published npm package differs

- The npm-published package usually contains a bundled or transpiled `dist/` with rewritten imports and types already compiled. Local builds may leave ESM source files, or use different build targets. Compare `package.json` exports and `main/module` to see which files are expected by consumers.
- Publishing scripts may also run postbuild steps to copy assets, icons, or CSS into the package—ensure you run those steps locally.

## Debugging tips

- Compare versions: `npm view @excalidraw version` vs `cat packages/excalidraw/package.json`.
- Diff the published package contents: `npm pack @excalidraw --json` then inspect the tarball.
- If TypeScript types are failing only during `build:esm`, run `npx tsc --showConfig` in the package to confirm that tsconfig resolves correctly.

## Suggested documentation additions

Add these to the repository docs to help future contributors:

- A short HOWTO titled "Building a local package and testing it in a separate project" that shows `yalc` and `npm pack` workflows.
- A troubleshooting section that enumerates the most common errors (duplicate React, tsconfig mismatch, different build output) and provides concrete commands to inspect and fix them.
- Example `package.json` snippets showing `peerDependencies` for `react` and build scripts that match what's published to npm.
- A checklist for making a package publish-ready: run `pnpm -w build`, check `dist`, update `version`, run `npm pack` and test installation.

## Useful links (paste these in your PR or docs)

- Excalidraw monorepo README: https://github.com/excalidraw/excalidraw/blob/master/README.md
- `yalc` (local package testing): https://www.npmjs.com/package/yalc
- Node module resolution and peerDependencies: https://nodejs.org/api/modules.html
- React invalid hook call guide (duplicate React instances): https://reactjs.org/warnings/invalid-hook-call-warning.html
- TypeScript JSX runtimes: https://www.typescriptlang.org/tsconfig#jsx

## Example minimal workflow to iterate quickly

1. Make change in `packages/excalidraw`.
2. From repo root: `pnpm -w build`.
3. From `packages/excalidraw`: `yalc publish`.
4. In consumer project: `yalc add @excalidraw` then restart dev server.

If something fails, copy the error and follow the 'Type errors' and 'Duplicate React' checks above.

## Contact and PR note

If you add docs or test cases, open a PR against the repository and reference this file. Mention which consumer apps you used to test (example-app, sandbox) and include commands to reproduce.

---

If you'd like, I can also create a short script that automates packing and yalc-publishing for you, or update the repo README to link to this file. Tell me which you prefer.
