# Contributing to @zsviczian/excalidraw

Thank you for your interest in contributing.

Before opening a pull request, please understand that this repository is **not the primary place for Excalidraw development**. This repository is a fork maintained for the Obsidian Excalidraw plugin and follows a very conservative approach to code changes.

## Development Environment

- Use Node.js 22 or newer. Verify `node --version` before diagnosing Yarn or Corepack failures; a shell that combines a different Node binary with another installation's Corepack can fail before a repository command starts.
- This monorepo uses Yarn. Do not run npm install commands here or replace `yarn.lock` with an npm lockfile.
- Read `CLAUDE.md` for the upstream monorepo layout and commands.
- The main consumer for fork-only behavior is the sibling `zsviczian/obsidian-excalidraw-plugin` repository. Treat the repositories as separate Git histories and check the branch, status, and diff in each one before building or handing off changes.

## First: Can This Be Added Upstream?

The preferred place for almost all Excalidraw improvements is the main Excalidraw project.

Before submitting a PR here, please ask yourself:

* Can this change be implemented in the upstream Excalidraw component?
* Have you discussed or attempted the change upstream?
* Is the change genuinely impossible or inappropriate to include in the main Excalidraw codebase?

Examples of changes that may belong in this fork:

* Obsidian-specific integrations
* Obsidian-only workflows
* Plugin-specific functionality that has no value in the standalone Excalidraw application
* Technical limitations that prevent the change from being accepted upstream

If the change can reasonably be implemented in Excalidraw itself, please contribute it there instead.

## Keep Changes Extremely Small

I accept only highly targeted modifications to the Excalidraw codebase.

Every divergence from upstream increases the complexity, risk, and effort required to merge future Excalidraw releases into this fork.

To keep the project maintainable:

* Changes must be minimal in scope.
* Changes must solve a clearly defined problem.
* Changes must avoid refactoring unrelated code.
* Changes must avoid introducing new abstractions unless absolutely necessary.
* Large-scale modifications will generally be rejected.

When evaluating a PR, maintainability during future upstream merges is often a more important consideration than the benefit of the proposed feature.

## Document Every Modification

Every fork-specific change must be easy to find during a future upstream merge. Use the exact `zsviczian` fingerprint even when another contributor or agent authors the patch.

If you modify a single existing line, annotate the change directly on that line with `// zsviczian` for TypeScript/JavaScript or `/* zsviczian */` for CSS-family files. Include the reason and a relevant issue, pull request, or discussion when available.

Example:

```ts
const value = getValue(); // zsviczian -- reason for the fork difference, #issue-or-pr
```

The comment should include:

* the `zsviczian` fingerprint
* The reason for the modification
* Relevant issue number, PR number, or discussion reference

Future maintainers must be able to understand why the line differs from upstream.

## Prefer New Functions Over Modifying Existing Logic

If a change affects a block of code, do not directly modify the existing Excalidraw implementation unless there is no alternative.

Instead:

1. Create a dedicated function.
2. Prefer placing an Obsidian-specific utility in the existing lowerCamelCase `obsidianUtils.ts` or `commonObsidianUtils.ts` module when appropriate.
3. Keep Obsidian-specific logic isolated from Excalidraw logic.

The utility modules consume the typed host boundary; they are not a place to store or discover the plugin. New host capabilities belong in the narrow adapter contracts described below.

This approach makes future merges significantly easier because modifications become easy to identify and review.

### Function Documentation Requirements

All newly introduced helper functions should contain:

* A detailed header comment explaining why the function exists
* Your GitHub username
* Links to relevant issues, PRs, discussions, or design conversations
* Comments throughout the implementation where necessary

Example:

```ts
/**
 * Purpose:
 *   Explain why this functionality cannot be implemented upstream.
 *
 * Author:
 *   github-user
 *
 * References:
 *   #123
 *   https://github.com/...
 *
 * Notes:
 *   This exists only for Obsidian-specific behavior.
 */
export function myHelper() {
  ...
}
```

## If You Must Insert a Code Block

Sometimes a localized modification cannot reasonably be extracted into a separate function.

In those rare cases, clearly mark the inserted section.

Example:

```ts
// zsviczian START -- reason, description, links

...

// zsviczian END
```

The marker should explain:

* Who added the code
* Why it exists
* Relevant issue, PR, discussion, or reference links

This makes future merge conflicts substantially easier to understand and resolve.

## Typed Obsidian Host Boundary

The plugin supplies Obsidian-specific capabilities to the evaluated component through `ObsidianCommonHostAdapter` and `ObsidianExcalidrawHostAdapter`.

- Expose small semantic operations, never the plugin instance, its complete settings object, or an active view.
- Do not pass those host objects through component props or `appState`, and do not discover them through browser or Obsidian globals.
- Common- and element-layer capabilities belong in `commonObsidianHost.ts`; Excalidraw-package-only capabilities belong in `obsidianExcalidrawHost.ts`. View-scoped state does not belong in either registry.
- The plugin owns registration and deterministic disposal for each evaluated window runtime. Component instances only consume the registered capabilities.
- The fork's generated declarations are the type source of truth. Reuse existing Excalidraw types and export host contracts rather than duplicating unions or structural interfaces in the consumer.

These adapters form an internal protocol paired with the plugin's exact package dependency. A breaking change must increment the relevant protocol version and be coordinated across both repositories. The plugin should reject a missing or incompatible boundary; do not retain a legacy `hostPlugin` or global-discovery fallback merely to support mismatched historical versions. This exception does not apply to serialized scene compatibility or public Excalidraw APIs.

## Obsidian Package Contract

The normal upstream ESM package and the Obsidian consumer artifact serve different purposes. Keep the Obsidian build isolated and semantically named; do not restore the retired UMD/webpack path.

From `packages/excalidraw`, run:

```bash
yarn build:obsidian
```

This produces four generated files under `packages/excalidraw/dist/obsidian/`:

- `excalidraw.production.min.js`
- `excalidraw.production.min.css`
- `excalidraw.development.js`
- `excalidraw.development.css`

The JavaScript artifact must remain a single function-evaluable browser bundle with no runtime chunks. The Obsidian plugin compresses it into its single CommonJS `main.js` and evaluates it separately in the main application window and popouts.

The following boundaries are mandatory:

- React, ReactDOM/client, `react/jsx-runtime`, and `react/jsx-dev-runtime` remain external. The consuming plugin supplies one private matching runtime per Obsidian window. Do not bundle React into this artifact and do not depend on `window.React` or `window.ReactDOM`.
- Preserve the documented `window.ExcalidrawLib` compatibility surface used by scripts and companion plugins.
- Mermaid remains external and is obtained lazily through `getSharedMermaidInstance()` from Excalidraw Extras. Do not bundle Mermaid or add a network loader.
- The component must run offline. Bundle required fonts and assets, including Assistant UI. CJK font subsets are the deliberate exception and remain lazy package-relative paths that the plugin can resolve when required.
- Production output is minified and map-free. Development JavaScript retains readable source information for DevTools; development CSS should not carry a redundant nested source map.
- Generated `dist/` output is validation evidence, not the place to make or review source fixes.

`yarn prepack` builds both the normal ESM package and the Obsidian artifact. A package intended for the plugin is incomplete if the four `dist/obsidian` files are absent from the npm tarball.

## Obsidian Portals And Popouts

`packages/excalidraw/components/ObsidianRadixPortal.tsx` places selected Radix floating content under the owning document's body to avoid fixed-position displacement in Obsidian popout windows.

Body portals have two important consequences:

- Portaled content is no longer a descendant of the component that triggered it. Ancestor-dependent selectors will stop matching. Give specialized content a class that travels through the portal and style that class directly.
- Portaled content leaves modal stacking contexts. Ensure a dropdown or popover that opens from a modal is stacked above that modal, then verify click-outside and Escape handling.

When changing Radix menus, popovers, or `ObsidianRadixPortal`, test the main window, a new and restored popout, narrow/mobile viewports, collision boundaries, theme variables, stacking, focus, click-outside, and Escape behavior. A visible trigger does not imply its portaled content is visible.

## Cross-Repository Integration Testing

The plugin consumes these files from `node_modules/@zsviczian/excalidraw/dist/obsidian/`. Before publishing a new package, the four locally generated files may be copied temporarily into the sibling plugin's ignored installed package for integration testing. Keep the plugin's declared dependency unchanged during this temporary handoff; `npm install` restores the published artifact.

Host-boundary unit tests do not load Obsidian or the plugin. Use structural fake adapters to test standalone defaults or required-service errors, capability forwarding, protocol rejection, idempotent cleanup, and stale-disposer safety. Cross-repository testing is the separate integration gate for actual plugin registration, reload, main-window and popout lifecycle, and live settings reads.

After a component version is published:

1. Update `@zsviczian/excalidraw` in the plugin repository.
2. Run `npm install` there.
3. Run the plugin production build and any relevant development build.
4. Test cold startup, normal editing, plugin reload, popouts, offline behavior, Mermaid loading, and the feature changed by the component patch.
5. Check the final plugin `main.js` byte size because small component changes can reduce release headroom.

Do not bump package versions, publish packages, commit either repository, or modify the consumer's dependency unless the maintainer explicitly requests that action.

### Maintainer-coordinated package release

When the maintainer explicitly requests an Obsidian-fork package release:

1. Commit the implementation checkpoint.
2. Bump only `packages/excalidraw/package.json` in a separate release checkpoint.
3. Run package-local `yarn prepack`.
4. Create and inspect the npm tarball, including its version, declarations, protocol exports, and all four Obsidian artifacts.
5. Publish only `@zsviczian/excalidraw`.
6. Update the plugin's exact dependency, run `npm install`, and build and smoke-test against the published package before committing the plugin handoff.

Do not use the monorepo-root `yarn release` command for this workflow. It rewrites and publishes the upstream package set (`common`, `fractional-indexing`, `math`, `element`, and `excalidraw`), not only this fork package.

## Validation

For Obsidian-specific component changes, the minimum source validation is:

```bash
yarn build:obsidian
yarn test:typecheck
```

Run focused tests and lint/format checks for the files touched. The monorepo can occasionally have unrelated baseline failures; record them accurately, confirm the changed files are absent from those diagnostics, and do not claim a clean pass when the command failed. After refreshing the local consumer artifacts, run `npm run build` in the plugin repository as the integration gate.

Every handoff should include a risk-based manual test list identifying the most likely failure and which combinations of main window, popout, desktop, mobile, and offline mode matter.

## Pull Request Expectations

When opening a PR, please explain:

1. Why the change cannot be implemented upstream.
2. Why the change is required for the Obsidian plugin.
3. Why the implementation was kept as small as possible.
4. What alternatives were considered.

PRs that introduce broad modifications to Excalidraw internals without strong justification are unlikely to be accepted.

## Final Note

I am extremely conservative when accepting changes to this fork.

The primary goal is to remain as close as possible to upstream Excalidraw while supporting the specific needs of the Obsidian plugin.

When in doubt, choose the solution that creates the smallest possible difference from upstream.
