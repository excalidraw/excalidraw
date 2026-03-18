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
- **Preferences in hamburger menu** -- grid toggle, grid snap toggle, and other settings (`packages/excalidraw/components/LayerUI.tsx`)
- **Render crash protection** -- try-catch wrapper in `_renderInteractiveScene` (`packages/excalidraw/renderer/interactiveScene.ts`)
- **Selection/Lasso ToolPopover** -- toggle in compact mode, deduplicated with `renderedSelectionPopover` ref (`packages/excalidraw/components/Actions.tsx`)
- **TS 5.7 fixes** -- ArrayBuffer/BufferSource type assertions across multiple files
- **Wireframe (3D preset) UX** -- click-through vertex drag on first click, `move` cursor on vertex hover, wider edge grab zone (10px), block double-click group entry for wireframes, vertex priority over resize handles (`packages/excalidraw/components/App.tsx`)
- **Draggable cone apex** -- shared vertex ID `"APEX"` on cone lateral lines (`packages/excalidraw/shapePresets/solidFactory.ts`)
- **Two-finger double-tap undo** -- two consecutive two-finger taps on touchscreen triggers undo, tracks fingers by `touch.identifier` for reliable detection when fingers lift separately (`packages/excalidraw/components/App.tsx`)
- **Mobile toolbar presets** -- all 14 shape presets (7 2D + 7 3D) added to mobile SHAPE_TOOLS, line as default linear tool, highlighter in freedraw dropdown (`packages/excalidraw/components/MobileToolBar.tsx`)
- **Mobile dropdown positioning** -- extra tools dropdown opens upward (`side="top"`) to stay within canvas bounds (`packages/excalidraw/components/MobileToolBar.tsx`, `packages/excalidraw/components/dropdownMenu/DropdownMenuContent.tsx`)
- **Canvas background color picks** -- TopPicks visible in compact mode for canvas background (`packages/excalidraw/components/ColorPicker/ColorPicker.tsx`)
- **Linear editor safety** -- "Edit line" action requires `selectedLinearElement` in state, prevents crash on non-linear elements (`packages/excalidraw/actions/actionLinearEditor.tsx`, `packages/excalidraw/components/Actions.tsx`)
- **Confirm dialog compact** -- confirm dialog never goes fullscreen in compact/phone mode (`packages/excalidraw/components/ConfirmDialog.scss`)
- **Triangular prism edges** -- right lateral and top-left edges rendered solid (not dashed) (`packages/excalidraw/shapePresets/solidFactory.ts`)
- **Mobile 2D shape bounding box** -- `hasBoundingBox()` returns true for polygon presets on mobile; transform handle hit-test enabled for polygon presets (`packages/element/src/transformHandles.ts`, `packages/excalidraw/components/App.tsx`)
- **Stroke width slider** -- discrete range slider with squiggle preview replacing 3 radio buttons; pencil 0.5-8/step 0.5, highlighter 8-40/step 2 (`packages/excalidraw/components/StrokeWidthRange.tsx`, `packages/excalidraw/actions/actionProperties.tsx`)
- **Highlighter tool** -- freedraw preset mode with popup toggle (pencil/marker), yellow default color, three independent settings sets (pencil/highlighter/shape), mobile toolbar support (`packages/excalidraw/components/App.tsx`, `packages/excalidraw/components/Actions.tsx`, `packages/excalidraw/components/MobileToolBar.tsx`)
- **Custom tooltips** -- replaced native `title=` with `<Tooltip>` component (400ms delay, 11px font), hover effects on all buttons, Apple Pencil hover support (`packages/excalidraw/components/Tooltip.tsx`, `packages/excalidraw/components/ToolButton.tsx`, etc.)
- **Grid snap toggle** -- separate from grid visibility, in hamburger preferences, default off (`packages/excalidraw/appState.ts`, `packages/excalidraw/components/App.tsx`, `packages/excalidraw/actions/actionToggleGridSnap.tsx`)
- **LaserPointer freedraw rendering** -- replaced perfect-freehand with `@excalidraw/laser-pointer` for freedraw outline generation; 75° corner detection eliminates spike artifacts (`packages/element/src/shape.ts`)
- **i18n Russian complete** -- all keys translated + 13 quality fixes (crowfoot→вороньи лапки, typos, awkward translations) (`packages/excalidraw/locales/ru-RU.json`)
- **Zoom controls alignment** -- uses `--editor-container-padding` like toolbar (`packages/excalidraw/css/styles.scss`)

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
- `toolSettings`: three independent sets (pencil/highlighter/shape) for strokeWidth, opacity, strokeColor
- `activeSettingsKey`: tracks which settings set is active, switched in `setActiveTool`

### Gotchas

- **TS 5.7 ArrayBuffer breaking change** -- `Uint8Array.buffer` returns `ArrayBufferLike`, not `ArrayBuffer`. Use `as ArrayBuffer` / `as BufferSource` / `as BlobPart` assertions where needed.
- **`npm ci` requires lock file sync** -- always commit both `package.json` and `package-lock.json` in the consumer project, otherwise CI fails.
- **max-warnings=0** -- ESLint is configured to fail on any warning. Clean up unused imports before committing.
- **Dev server must be stopped** before `yarn add` / `npm install` on Windows -- otherwise EPERM on locked `.node` files.
- **React Strict Mode** -- double-render can cause forEach/map crashes in scene renderers; try-catch wrapper protects against this.
- **LaserPointer size = radius** -- unlike perfect-freehand where size = diameter. When configuring `sizeMapping`, ensure `size * sizeMapping() >= 1.1` for proper start cap generation.
- **Touch identifier tracking** -- always use `touch.identifier` to match fingers across touchstart/touchend events. Array index matching fails when fingers lift separately.
- **Polygon preset HACK guards** -- two guards in App.tsx disable transform handles for linear elements on mobile. Polygon presets (`element.polygon === true`) must be excluded from these guards.
