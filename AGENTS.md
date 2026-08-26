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

- `packages/common/src/commonObsidianHost.ts`
- `packages/excalidraw/obsidianUtils.ts`
- `packages/excalidraw/obsidianExcalidrawHost.ts`
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
- React, ReactDOM/client, and both JSX runtime entry points stay external. The host provides matching private packages and may render roots in multiple documents when it supplies each editor's stable `ownerDocument`.
- Never depend on or assign `window.React` or `window.ReactDOM`.
- Preserve `window.ExcalidrawLib`; it is a documented compatibility API.
- Mermaid stays external and is loaded lazily through `getSharedMermaidInstance()` and Excalidraw Extras.
- Required assets work offline. Assistant UI fonts are bundled. Lazy CJK subsets are the intentional exception.

`yarn prepack` must continue to include both the normal ESM outputs/types and the four Obsidian files in the npm tarball.

### Maintainer-Coordinated Package Release

Do not use the monorepo-root `yarn release` workflow for an Obsidian-fork-only release. That script rewrites and publishes the upstream package set (`common`, `fractional-indexing`, `math`, `element`, and `excalidraw`), not only `@zsviczian/excalidraw`.

When the maintainer explicitly requests a fork package release:

1. Commit the implementation checkpoint before changing the package version.
2. Bump only `packages/excalidraw/package.json` in a separate release checkpoint.
3. Run the package-local `yarn prepack` so both ESM/types and Obsidian artifacts are rebuilt.
4. Create and inspect the package-local npm tarball. Verify its version, generated host declarations and protocol exports, and all four `dist/obsidian` artifacts.
5. Publish only `@zsviczian/excalidraw`.
6. In the plugin repository, update the exact dependency, run `npm install`, build, and smoke-test against the published artifact before committing the consumer handoff.

The normal rule remains unchanged: do not bump, package, publish, or update the consumer dependency without explicit maintainer authorization.

## React And Window Ownership

The component may be evaluated per window or once and used to create independent React roots in multiple Obsidian windows. Each mounted editor receives a stable `ownerDocument`; the React root remains owned by the document in which it was created.

- Avoid module assumptions that require one browser-window singleton or a mutable "current document".
- For new DOM/browser API usage, use `app.ownerDocument` and `app.ownerWindow` instead of globals; without `app`, derive them from the mounted node's `ownerDocument` and its `defaultView`.
- DOM, portals, document events, and layout measurements must use the owning Excalidraw container/document where relevant.
- Do not implement plugin-level persistence here merely because a UI is rendered in a popout. Persistent plugin state is owned by the host adapter and, for existing Obsidian plugin storage, remains in the main application window.
- Keep public or independently consumed host-provided adapters such as text-to-diagram persistence backward compatible unless the task explicitly changes their contract.

## Typed Obsidian Host Boundary

The evaluated fork runtime receives Obsidian-specific capabilities through `ObsidianCommonHostAdapter` and `ObsidianExcalidrawHostAdapter`. This is the only supported plugin-access mechanism inside the fork.

- Do not discover or store the plugin through `window`, `globalThis`, a global Obsidian `app`, `app.plugins`, or a fork-side `hostPlugin` variable.
- Do not add the plugin, its settings object, or an active view to Excalidraw component props or `appState`.
- Keep contracts semantic and minimal. The adapter may answer a question or perform a named operation, but it must not expose the host object graph.
- Put capabilities needed by common or element layers in `commonObsidianHost.ts`. Put Excalidraw-package-only capabilities in `obsidianExcalidrawHost.ts`. Keep view-scoped state out of both registries.
- The host registers adapters once per evaluated window runtime. Components and editor instances consume them but must not configure or dispose them.
- Registration must validate the protocol version and return an idempotent, stale-registration-safe disposer so teardown from an older runtime cannot clear a newer registration.
- Utilities may provide an explicit safe standalone default when the behavior is meaningful outside Obsidian. Required host services must fail with a descriptive error rather than use plugin discovery or an implicit compatibility bridge.

A strong reference held by an adapter is acceptable only for the lifetime of its registered window runtime. Memory safety comes from deterministic host-owned disposal, not from weakening the adapter type or hiding the reference in a global.

### Internal Protocol Compatibility

The two Obsidian host adapters are internal protocols paired with the consuming plugin's exact package dependency. They are not required to support arbitrary mismatches between historical plugin and fork versions.

- A breaking contract change must increment the affected protocol constant and update fork behavior, focused tests, generated declarations, the plugin adapter, and its ambient runtime declaration in one coordinated checkpoint.
- The consuming plugin should fail fast when the required boundary is missing or incompatible. Do not preserve `hostPlugin` or other legacy discovery fallbacks solely for cross-version mismatches.
- This exception does not weaken compatibility requirements for serialized scenes, public Excalidraw exports, documented scripting surfaces, or independently consumed adapters.

### Host Boundary Type Ownership

The fork declarations are the canonical source for host contracts and related Excalidraw concepts.

- Export adapter interfaces, disposer types, and protocol constants through generated package declarations.
- Reuse existing types such as `EditorInterface["formFactor"]` and `StylesPanelMode`; do not repeat equivalent string unions or structural interfaces.
- When the plugin models the evaluated `window.ExcalidrawLib` surface, it should import or derive these published types rather than maintain a second property list.

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
- Preserve public Excalidraw exports, serialized scene compatibility, and independently consumed host adapter contracts. Apply the coordinated internal-protocol rule above to the paired Obsidian host adapters.
- Avoid broad file moves or naming cleanup in behavior fixes.
- Search all imports, callers, styles, tests, and package exports before changing a shared component or type.
- Do not add network dependencies or remote code loading. The host-provided Mermaid integration is not a network loader; lazy CJK asset fetching is the narrowly scoped network exception and is not precedent for other assets.

### Trusted Optimization Bypasses

An optimization that skips normal validation, normalization, or sanitization
must retain the safe path as the default.

- Make authorization call-scoped and ephemeral. Do not persist a `trusted`,
  `normalized`, or equivalent marker in scene data or `BinaryFileData` merely
  to avoid repeated work.
- Require the host that produced or inspected the payload to identify the
  eligible inputs. Inputs absent from that explicit authorization must execute
  the unchanged safe path.
- Preserve the existing API call form when doing so is inexpensive. Add an
  options form rather than forcing unrelated consumers to change.
- Keep the bypass narrow enough that its complete data flow can be reviewed:
  who certifies it, how identity is matched, how long authorization lives, and
  where the normal path remains intact.
- Test both a certified input and an ordinary/untrusted input. A faster trusted
  case is not sufficient evidence that the fallback still works.

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

Host-boundary unit tests must run without Obsidian or the plugin. Configure small structural fake adapters and cover standalone defaults or required-service errors, capability forwarding, protocol rejection, idempotent disposal, and protection against a stale disposer clearing a newer registration. Plugin-dependent behavior belongs in the cross-repository integration pass, not in these unit tests.

If a repo-wide command fails because of unrelated baseline errors:

- report the failure accurately;
- confirm whether any diagnostic references a touched file;
- run the narrowest useful validation for the changed area;
- do not fix unrelated backlog unless requested.

For integration validation:

1. Temporarily copy the four local `dist/obsidian` artifacts into the sibling plugin's ignored `node_modules/@zsviczian/excalidraw/dist/obsidian/` directory without changing its dependency declaration.
2. Run `npm run build` in the plugin repository. Run `npm run dev` too when debugger payloads or development CSS changed.
3. Test cold startup, plugin reload, normal editing, main-window and popout behavior, popout teardown, offline operation, and the feature-specific workflow. For adapter settings, confirm a setting changed after registration is observed without recreating the runtime.
4. Record the plugin `dist/main.js` byte size after component or packaging changes.

Copying local artifacts proves only the unpublished integration checkpoint. If
the plugin source consumes a new fork API, the plugin's durable handoff is not
commit-ready until the published package containing that API is installed and
the plugin's exact dependency and lockfile are updated. A maintainer may still
request an explicitly paired intermediate commit, but it must not be described
as release-ready.

End every handoff with a risk-based manual test list. State the most likely regression and which platforms/windows require separate testing.

## Default Decision Rule

When uncertain, choose the solution that:

1. changes the fewest upstream lines;
2. keeps React and Mermaid external;
3. preserves offline and popout behavior;
4. maintains public and serialized compatibility;
5. can be built and tested as one small checkpoint; and
6. will create the least friction during the next upstream merge.
