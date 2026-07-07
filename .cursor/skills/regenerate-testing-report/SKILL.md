---
name: regenerate-testing-report
description: Regenerate the Excalidraw testing coverage report as a new dated canvas after implementing any feature, bug fix, refactor, or other code change. Use immediately after finishing any set of code edits so the report stays fresh; skip only for docs-only, comment-only, or config-only changes.
---

# Regenerate Testing Report

## Trigger

Run this skill as soon as the agent finishes implementing a feature, bug fix, or refactor and before ending the turn. Skip it for pure docs-only, comment-only, or config-only changes (e.g. README edits, `.gitignore` tweaks, lockfile bumps).

Do this without asking the user first — the report is meant to be an always-fresh side-effect of shipping code.

## Data to collect

All commands run from the repo root and use only static analysis (no test execution, no network). Capture each result and keep it for the canvas.

- **Total test files**
  ```bash
  find . -type f \( -name "*.test.ts" -o -name "*.test.tsx" \) -not -path "*/node_modules/*" | wc -l
  ```

- **Total test cases** (loop is also reused for per-package counts below)
  ```bash
  total=0
  for f in $(find . -type f \( -name "*.test.ts" -o -name "*.test.tsx" \) -not -path "*/node_modules/*"); do
    c=$(grep -cE "^[[:space:]]*(it|test)\.?(skip|only|each|todo)?\(" "$f" 2>/dev/null)
    total=$((total + ${c:-0}))
  done
  echo $total
  ```

- **Describe blocks**: same loop, regex `^[[:space:]]*describe`.

- **Skipped / TODO**: same loop, regex `^[[:space:]]*(it|test)\.skip|^[[:space:]]*(it|test)\.todo|^[[:space:]]*describe\.skip`.

- **Per-package counts**: run the test-cases loop scoped to each of these paths (skip any that don't exist):
  ```
  packages/excalidraw packages/element packages/math packages/common packages/utils packages/fractional-indexing packages/laser-pointer excalidraw-app
  ```
  Also count `*.test.{ts,tsx}` files per package for the "Test files by package" chart.

- **Snapshot surface**
  ```bash
  find . -type f -name "*.snap" -not -path "*/node_modules/*" | wc -l
  grep -l "toMatchSnapshot\|toMatchInlineSnapshot" \
    $(find . -type f \( -name "*.test.ts" -o -name "*.test.tsx" \) -not -path "*/node_modules/*") | wc -l
  ```

- **Coverage thresholds**: read `test.coverage.thresholds` from [vitest.config.mts](vitest.config.mts).

- **CI workflows**: `ls .github/workflows/` and read each `test*.yml` and `lint.yml` for the `Trigger`, `Runs`, and `Purpose` cells.

- **Test commands**: read the `scripts` section of [package.json](package.json) and pull every key starting with `test`.

- **New files this turn**: list source files created in the current change (typically under `excalidraw-app/` or `packages/*/src/`) and check whether each has a sibling `*.test.ts{x}`. Feed the answer into the Gaps section.

## Output

Write a NEW canvas per invocation — never overwrite existing ones — at:

```
~/.cursor/projects/<workspace>/canvases/testing-report-YYYY-MM-DD.canvas.tsx
```

Discover the correct `<workspace>` folder by listing `~/.cursor/projects/` and picking the one that already contains prior `testing-report*.canvas.tsx` files. Use the local system date for `YYYY-MM-DD`; if a report for today already exists, append `-2`, `-3`, etc.

The canvas file must live directly inside `canvases/` — subfolders and other locations are not detected by the IDE.

## Template

Clone the structure of the most recent existing `testing-report*.canvas.tsx` in that same `canvases/` folder. Keep:

- The `cursor/canvas` imports and the 960px `maxWidth` wrapper.
- The section order: Overview → KPI strip → per-package charts (Test cases + Test files) → Coverage → CI → Tooling & fixtures → Test commands → Gaps and recommendations.
- The `Stat` / `BarChart` / `Table` / `Callout` component choices for each section.

Only these things change between reports:

- Every numeric constant (`TOTAL_CASES`, `TOTAL_FILES`, `TOTAL_DESCRIBES`, `TOTAL_SKIPPED`, `SNAPSHOT_*`, `PACKAGE_TESTS`, `COVERAGE_THRESHOLDS`).
- The `GENERATED` string — set it to `Snapshot: <Month D, YYYY>`.
- The `CI_WORKFLOWS` and `TEST_COMMANDS` arrays if `.github/workflows/` or `package.json` scripts changed.
- The Gaps section callouts (see below).

Do not restyle, add gradients, add emojis, or reorder sections — the canvas skill's rules still apply.

## Gaps section guidance

The final "Gaps and recommendations" section is the human-facing takeaway. For each regeneration, include callouts that:

1. State whether the code changed this turn shipped with test coverage. If a new file was created without a corresponding `*.test.ts{x}`, list it by path and mark the callout `tone="warning"`.
2. Preserve the standing repo-wide observations from the previous report (under-tested `excalidraw-app`, zero-test packages, PR-only CI signal, skipped/TODO backlog) — only update the numbers.
3. If a previously flagged gap is now closed (e.g. the file that lacked tests now has them), swap that warning callout for a `tone="success"` callout acknowledging it.

## Finish

After writing the file, mention the new canvas in the chat reply using a markdown link with the full absolute path, e.g.:

```
[testing-report-2026-07-06](/Users/<user>/.cursor/projects/<workspace>/canvases/testing-report-2026-07-06.canvas.tsx)
```

Keep the note to one or two sentences that name what changed since the last report (new file added, gap closed, thresholds bumped, etc.). Do not restate the full contents of the canvas in chat.

## What this skill does NOT do

- Does not run `yarn test:coverage`, `yarn test:app`, or any other test/build command — the report is a static analysis of the test surface.
- Does not modify the existing `testing-report*.canvas.tsx` files — always creates a new dated one so the user keeps history.
- Does not author new tests. If a gap is flagged, the user will ask for tests separately.
