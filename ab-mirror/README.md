# Excalidraw A/B mirror

Two Excalidraw source trees side by side on one page. Input in either pane is replayed into the other, and every arrow whose route or bindings differ gets listed and drawn as a dashed "ghost" of the other side's version.

## Run

From the repo root:

```sh
yarn ab <ref|dir>              # vs master: the ref's merge base with origin/master
yarn ab <ref|dir> <ref|dir>    # left vs right
yarn ab --clean                # delete the commit snapshots (ab-mirror/.cache/)
```

- `<ref>`: anything git resolves to a commit (sha, branch, tag, `origin/…`). Refs not known locally are fetched from origin.
- `<dir>`: a checkout, used live: uncommitted changes and HMR included (e.g. `yarn ab .`, `yarn ab ../excalidraw`). Relative paths resolve from where you ran `yarn ab`.
- `-p, --port <n>`: port to try first (default 3091; the next free one otherwise).
- A PR's head: `yarn ab $(gh pr view <number> --json headRefOid -q .headRefOid)`.

Examples: `yarn ab <sha>` (a commit vs its base), `yarn ab my-branch origin/master` (vs master's tip), `yarn ab .` (your working tree vs its base).

The single-ref form compares against the merge base rather than master's tip, so the only difference between the panes is the ref's own change. Pass `origin/master` as the second ref to compare against the tip.

Linux, WSL and macOS (macOS untested). On Windows it aborts: use WSL.

## How trees are prepared

- **Commits** are extracted once (`git archive <sha> packages`, ~27 MB, <0.1 s) into `ab-mirror/.cache/<sha>`. No worktree or branch is created. The folder is gitignored and listed in `.eslintignore` (which `yarn prettier` also uses); `tsc` only includes `packages` + `excalidraw-app`, and Vitest skips `.cache` dirs by default. Delete it with `yarn ab --clean`, or delete single `<sha>` dirs.
- Each tree's `node_modules` (root + `packages/*/node_modules`) are links into this checkout's install. The CLI warns when a commit's `yarn.lock` differs from the installed one, since that commit's dependency changes then aren't in effect.
- **Live checkouts** with their own install keep using it, and nothing is written into them. Ones without their own `node_modules` get the missing links. React is deduped either way (one copy per page).

## How it works

- `ab.mjs` resolves the two trees and starts one Vite server (`vite.config.mts`). `@excalidraw/*` imports resolve into the importing file's tree (`ab-tree-resolver`). Both panes are on the same origin, so the parent page reaches both editors directly.
- Each pane mounts a bare `<Excalidraw>` without persistence (`host.tsx`). It's not excalidraw-app, which reloads its scene from localStorage on window focus and would overwrite the other pane.
- **Mirror input**: trusted pointer, mouse, wheel, key, paste/cut, input/change and text-field blur events are re-dispatched as synthetic copies into the other pane (`harness.ts`). Each build makes its own binding and routing decisions from the same input, including the routes previewed while dragging. Untrusted copies are never forwarded back.
- **Focus**: only the pane you last pressed in may take focus (patched `focus()`), and while an event is dispatched into the other pane, its `document.activeElement` is temporarily made to match yours (paste/cut and key handlers check it).
- **Guard**: when idle, viewport + a few settings (theme, grid, snapping, arrow type) are copied from the pane you use if they ever drift; the log shows it when that happens (it shouldn't).

## Buttons

- **Copy L→R / R→L**: exact scene copy (stored routes included) to resync after the panes drift apart.
- **L→R + re-route / R→L + re-route**: copy the scene incl. bindings, then the target re-routes every elbow arrow with its own code. Isolates the router: same bindings, different routing.
- **Re-route both**: each pane re-routes its own arrows from its own bindings.
- **Load…**: a `.excalidraw` file into both panes, then both re-route.
- **Restore**: the left scene is autosaved (localStorage), because editing a non-component module in a live tree makes Vite reload every page. Restore loads it into both panes and re-routes.
- **Save L / Save R**: download a pane's scene.

The diff list pairs elements by z-order (ids are random per pane), so after an element count mismatch the pairing is off. Copy one side over to resync.

## Caveats

- Text typed into the editor is mirrored by value; IME composition isn't.
- Copy (Ctrl+C) isn't forwarded (it doesn't change the scene); cut and paste are.
- Native drag & drop (library items, files from the OS) isn't mirrored.
- Every copy/restore/load clears undo history in both panes so undo stays aligned.
- Console: `ab.panes.left.api`, `ab.rerouteAll(ab.panes.right)`, `ab.compareScenes(…)`.
