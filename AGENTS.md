# @zsviczian/excalidraw Agent Guide

## Required Reading

Before changing this repository, read these files completely:

1. `CONTRIBUTING.md` — fork policy, fingerprinting, Obsidian artifact contract, and cross-repository handoff.
2. `CLAUDE.md` — upstream monorepo structure and standard commands.

This file adds agent-specific execution rules. If instructions conflict, preserve the stricter rule and ask before expanding scope.

## Repository Purpose

This is a conservative fork of upstream Excalidraw maintained for `zsviczian/obsidian-excalidraw-plugin`. The primary goal is to remain easy to merge with upstream while providing the minimum Obsidian-specific integration that cannot live in the consuming plugin.

- Prefer an upstream-compatible fix when the behavior is generally useful.
- Prefer a plugin-side wrapper, adapter, or hook when the behavior is specific to Obsidian and the component already exposes a suitable contract.
- Change this fork only when the component or its packaging must participate.
- Keep every patch narrow. Do not combine upstream synchronization, refactoring, formatting, dependency updates, and an Obsidian fix in one change.
- Treat unusual existing code as intentional until its upstream and Obsidian constraints have been traced.

## Git And Cross-Repository Scope

The sibling plugin repository is usually `../obsidian-excalidraw-plugin`, but verify the actual workspace path.

- The repositories have independent branches, working trees, release versions, and commits. Inspect both statuses before cross-repository work.
- Preserve user changes and unrelated dirty files in either repository.
- Do not commit, publish, bump a version, merge, or modify the plugin dependency unless explicitly requested.
- Do not hand-edit generated `dist/` output or use it as a source fix.
- Before touching an upstream file, compare the relevant region with `upstream/master` and minimize the resulting fork delta.

## Fork Fingerprinting

Every fork-specific difference in an upstream-owned file must carry the exact `zsviczian` fingerprint described in `CONTRIBUTING.md`.

- TypeScript/JavaScript single line: `// zsviczian -- reason`
- CSS/SCSS single line: `/* zsviczian -- reason */` or the file's established equivalent
- Inserted block: `// zsviczian START -- reason` and `// zsviczian END`
- New helper or module: include high-signal documentation explaining purpose, author/fingerprint, references, and why the behavior belongs in the fork.

Prefer the ringfenced files when suitable:

- `packages/excalidraw/obsidianUtils.ts`
- `packages/common/src/commonObsidianUtils.ts`
- `packages/excalidraw/css/obsidianStylingOverrides.css`
- `scripts/buildObsidianPackage.js`
- `packages/excalidraw/obsidianEntry.ts`

If an upstream component must change, prefer a small dedicated hook, prop, class, or helper over rewriting the component.

## Obsidian Build Contract

The standard ESM package and the Obsidian artifact are related but distinct outputs. The retired UMD/webpack build must not be restored.

Run from `packages/excalidraw`:

```bash
yarn build:obsidian
```

The command must emit exactly the consumer-facing JavaScript and CSS modes under `packages/excalidraw/dist/obsidian/`:

- `excalidraw.production.min.js`
- `excalidraw.production.min.css`
- `excalidraw.development.js`
- `excalidraw.development.css`

Runtime requirements:

- JavaScript is one browser-compatible, function-evaluable artifact with no runtime chunks.
- Production is minified and map-free.
- Development JavaScript retains debugger-friendly original sources; development CSS omits the redundant nested source map.
- React, ReactDOM/client, and both JSX runtime entry points stay external. The plugin provides private matching packages for the main window and each popout.
- Never depend on or assign `window.React` or `window.ReactDOM`.
- Preserve `window.ExcalidrawLib`; it is a documented compatibility API.
- Mermaid stays external and is loaded lazily through `getSharedMermaidInstance()` and Excalidraw Extras.
- Required assets work offline. Assistant UI fonts are bundled. Lazy CJK subsets are the intentional exception.

`yarn prepack` must continue to include both the normal ESM outputs/types and the four Obsidian files in the npm tarball.

## React And Window Ownership

The component is evaluated independently with the consuming plugin's React packages in each Obsidian window.

- Avoid module assumptions that require one browser-window singleton.
- DOM, portals, document events, and layout measurements must use the owning Excalidraw container/document where relevant.
- Do not implement plugin-level persistence here merely because a UI is rendered in a popout. Persistent plugin state is owned by the host adapter and, for existing Obsidian plugin storage, remains in the main application window.
- Keep host-provided adapters such as text-to-diagram persistence backward compatible unless the task explicitly changes their contract.

## Radix Portals

`packages/excalidraw/components/ObsidianRadixPortal.tsx` moves selected floating UI to the owning document body to avoid fixed-position displacement in popouts.

When changing a menu or popover:

- Remember that body-portaled content loses its original component ancestors. Do not rely on ancestor selectors for specialized styles; put a stable class on the content itself.
- Remember that body-portaled content exits modal stacking contexts. Set and verify a stacking level above the originating modal where necessary.
- Preserve the Excalidraw bridge class, theme variables, collision boundary, and `data-radix-portal` behavior.
- Test visibility, alignment, collision handling, focus, selection, click-outside, and Escape in the main window and popouts. Include narrow/mobile layouts when available space changes behavior.
- Distinguish data failures from presentation failures. A trigger rendered from loaded data is evidence that loading succeeded even if its portaled menu is invisible.

## Coding And Documentation

- Follow upstream TypeScript, React, Sass, import, and formatting conventions in the touched area.
- Use TSDoc/high-signal comments for exported APIs, new fork helpers, package-loading logic, and non-obvious compatibility workarounds.
- Preserve public Excalidraw exports, serialized scene compatibility, and host adapter contracts.
- Avoid broad file moves or naming cleanup in behavior fixes.
- Search all imports, callers, styles, tests, and package exports before changing a shared component or type.
- Do not add network dependencies or remote code loading. The host-provided Mermaid integration is not a network loader; lazy CJK asset fetching is the narrowly scoped network exception and is not precedent for other assets.

## Validation

Use Node.js 22 or newer and Yarn. If `yarn` invokes a different Node installation through Corepack, fix the toolchain before attributing the failure to source code.

After every Obsidian component or packaging source change, run immediately:

```bash
yarn build:obsidian
```

Also run the most relevant focused tests, formatting/lint checks, and:

```bash
yarn test:typecheck
```

If a repo-wide command fails because of unrelated baseline errors:

- report the failure accurately;
- confirm whether any diagnostic references a touched file;
- run the narrowest useful validation for the changed area;
- do not fix unrelated backlog unless requested.

For integration validation:

1. Temporarily copy the four local `dist/obsidian` artifacts into the sibling plugin's ignored `node_modules/@zsviczian/excalidraw/dist/obsidian/` directory without changing its dependency declaration.
2. Run `npm run build` in the plugin repository. Run `npm run dev` too when debugger payloads or development CSS changed.
3. Test cold startup, plugin reload, normal editing, main-window and popout behavior, offline operation, and the feature-specific workflow.
4. Record the plugin `dist/main.js` byte size after component or packaging changes.

End every handoff with a risk-based manual test list. State the most likely regression and which platforms/windows require separate testing.

## Default Decision Rule

When uncertain, choose the solution that:

1. changes the fewest upstream lines;
2. keeps React and Mermaid external;
3. preserves offline and popout behavior;
4. maintains public and serialized compatibility;
5. can be built and tested as one small checkpoint; and
6. will create the least friction during the next upstream merge.
