# Baseline (captured before Supabase sync work)

- Date: 2026-06-15
- Branch: online-sync (master is the main branch)
- Node version: v21.7.3
- Yarn version: 1.22.22

## Typecheck

- Command: `yarn test:typecheck` (runs `tsc`)
- Result: **PASS** (0 errors) — completed in ~6.6s, "Done in 6.61s."

## Tests

- Command: `yarn vitest run` (one-shot, non-watch). Equivalent script: `yarn test:app --watch=false`.
- Result: **PASS** — 104 test files passed (104/104). 1452 tests total: 1403 passed, 48 skipped, 1 todo. 0 failed.
- Duration: ~24.5s.
- Notes: A couple of benign `stderr` lines during the run (not failures):
  - MermaidToExcalidraw test: "does not wrap some state update in act()" warning.
  - excalidraw-app LanguageList/MobileMenu tests: "Error JSON parsing firebase config. Supplied value: undefined" (expected — no firebase env configured locally).

## Lint

- Command: `yarn test:code` (runs `eslint --max-warnings=0 --ext .js,.ts,.tsx .`)
- Result: **PASS** (exit code 0) — completed in ~15.5s.
- Notes: Two stdout lines printed: "The prop value with an expression type of MetaProperty could not be resolved..." These are informational messages from the `jsx-ast-utils` ESLint plugin, NOT lint warnings/errors. With `--max-warnings=0` the command still exited 0, confirming they don't count as violations.
- (There is also a `test:other` script = `prettier --list-different` for formatting checks; not run as part of this baseline since the task scoped lint to eslint. Run separately if formatting regressions need to be checked.)

## Notes

- All three checks (typecheck, tests, lint) were fast (<30s each) and GREEN. No flakiness observed in this single run.
- Full production build (`yarn build`) was intentionally NOT run (slow) per instructions.
- Environment-specific: firebase config is unset locally, which produces expected non-fatal stderr noise in two excalidraw-app tests but does not cause failures.
- Untracked `supabase/` directory present in the repo (from git status) — not part of the build/test/lint pipeline at baseline time.

## Exact commands for later regression runs

```bash
yarn test:typecheck          # typecheck
yarn vitest run              # tests (one-shot, never watch mode)
yarn test:code              # lint (eslint)
# optional formatting check:
yarn test:other             # prettier --list-different
```
