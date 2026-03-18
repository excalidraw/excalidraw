# CLAUDE.md

> Fork of excalidraw for SdamEx (sdamex.com) -- whiteboard component for math problem solving. Published as `@emevart/excalidraw` to GitHub Packages.

## Project Structure

Excalidraw is a **monorepo** with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library, published as `@emevart/excalidraw`
- **`packages/common/`** - Shared utilities (`@excalidraw/common`)
- **`packages/element/`**, **`packages/math/`**, **`packages/utils/`** - Core packages
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com), not used by us
- **`e2e/`** - Playwright visual tests

## Fork Customizations

What we changed vs upstream (upstream tag: `v0.18.0`):

- **Compact styles panel** -- forced for all non-phone devices (`deriveStylesPanelMode` in `packages/common/src/editorInterface.ts`)
- **Russian keyboard ЙЦУКЕН** -- hotkeys work on Russian layout via `getLatinKey()` + Proxy in `App.tsx` (`packages/common/src/keys.ts`, `packages/excalidraw/components/App.tsx`, `packages/excalidraw/components/shapes.tsx`)
- **Preferences in hamburger menu** -- grid toggle and other settings (`packages/excalidraw/components/LayerUI.tsx`)
- **Render crash protection** -- try-catch wrapper in `_renderInteractiveScene` (`packages/excalidraw/renderer/interactiveScene.ts`)
- **Selection/Lasso ToolPopover** -- toggle in compact mode, deduplicated with `renderedSelectionPopover` ref (`packages/excalidraw/components/Actions.tsx`)
- **TS 5.7 fixes** -- ArrayBuffer/BufferSource type assertions across multiple files
- **Wireframe (3D preset) UX** -- click-through vertex drag on first click, `move` cursor on vertex hover, wider edge grab zone (10px), block double-click group entry for wireframes, vertex priority over resize handles (`packages/excalidraw/components/App.tsx`)
- **Draggable cone apex** -- shared vertex ID `"APEX"` on cone lateral lines (`packages/excalidraw/shapePresets/solidFactory.ts`)
- **Two-finger double-tap undo** -- two consecutive two-finger taps on touchscreen triggers undo (`packages/excalidraw/components/App.tsx`)
- **Mobile toolbar presets** -- all 14 shape presets (7 2D + 7 3D) added to mobile SHAPE_TOOLS, line as default linear tool (`packages/excalidraw/components/MobileToolBar.tsx`)
- **Mobile dropdown positioning** -- extra tools dropdown opens upward (`side="top"`) to stay within canvas bounds (`packages/excalidraw/components/MobileToolBar.tsx`, `packages/excalidraw/components/dropdownMenu/DropdownMenuContent.tsx`)
- **Canvas background color picks** -- TopPicks visible in compact mode for canvas background (`packages/excalidraw/components/ColorPicker/ColorPicker.tsx`)
- **Linear editor safety** -- "Edit line" action requires `selectedLinearElement` in state, prevents crash on non-linear elements (`packages/excalidraw/actions/actionLinearEditor.tsx`, `packages/excalidraw/components/Actions.tsx`)
- **Confirm dialog compact** -- confirm dialog never goes fullscreen in compact/phone mode (`packages/excalidraw/components/ConfirmDialog.scss`)
- **Triangular prism edges** -- right lateral and top-left edges rendered solid (not dashed) (`packages/excalidraw/shapePresets/solidFactory.ts`)

## Development Flow

### Making Changes

1. Edit code in `packages/*`
2. Run all checks before committing:

```bash
yarn fix              # Auto-fix lint + formatting (must pass with 0 warnings)
yarn test:typecheck   # TypeScript type checking
cd packages/excalidraw && yarn build:esm   # Build package (includes type generation)
```

3. Bump version in `packages/excalidraw/package.json`
4. Commit and push to `master`

### Publishing to GitHub Packages

```bash
cd packages/excalidraw
yarn build:esm                    # Build dist/
NPM_TOKEN=<token> npm publish    # Publish to npm.pkg.github.com
```

Package config:

- **Registry:** `https://npm.pkg.github.com`
- **Name:** `@emevart/excalidraw`
- **Files:** `dist/` directory

### Delivering to Production (SdamEx)

1. Publish new version (see above)
2. In `h:/billion-dollars/apps/frontend/`:

```bash
NPM_TOKEN=<token> npm install @emevart/excalidraw@<version>
```

3. Verify `package.json` AND `package-lock.json` both updated (CI uses `npm ci` which requires sync)
4. Commit both files, push to `develop`
5. Create PR `develop` -> `main`, enable auto-merge
6. CI runs: lint, typecheck, build, tests
7. After merge, staging deploys automatically

### Checklist (copy-paste for PRs)

```
- [ ] yarn fix (0 warnings)
- [ ] yarn test:typecheck
- [ ] yarn build:esm
- [ ] Version bumped in package.json
- [ ] Published to GitHub Packages
- [ ] Installed in billion-dollars (package.json + package-lock.json)
- [ ] Dev server tested locally
```

## Architecture Notes

### Package System

- Uses Yarn workspaces for monorepo management
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration

### Key Interfaces

- `StylesPanelMode`: `"compact" | "full" | "mobile"` -- controls properties panel rendering
- `EditorInterface.formFactor`: `"phone" | "tablet" | "desktop"` -- detected from editor dimensions
- `deriveStylesPanelMode()` -- maps formFactor to panel mode (phone -> mobile, rest -> compact)

### Gotchas

- **TS 5.7 ArrayBuffer breaking change** -- `Uint8Array.buffer` returns `ArrayBufferLike`, not `ArrayBuffer`. Use `as ArrayBuffer` / `as BufferSource` / `as BlobPart` assertions where needed.
- **`npm ci` requires lock file sync** -- always commit both `package.json` and `package-lock.json` in the consumer project, otherwise CI fails.
- **max-warnings=0** -- ESLint is configured to fail on any warning. Clean up unused imports before committing.
- **Dev server must be stopped** before `yarn add` / `npm install` on Windows -- otherwise EPERM on locked `.node` files.
- **React Strict Mode** -- double-render can cause forEach/map crashes in scene renderers; try-catch wrapper protects against this.
