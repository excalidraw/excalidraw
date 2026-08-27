# Excalidraw #11977 — Fix Failing Animation Tests

## Problem
3 tests fail in `packages/excalidraw/tests/animation.test.ts`:
1. "does not resurrect an animation cancelled during its initial callback" — timerCount=1 instead of 0
2. "cleans up the registration when the initial callback throws" — timerCount=1 instead of 0
3. "does not let a completed callback delete its same-key replacement" — replacementFrames=2 instead of 1

## Context for Claude Code
- Repo: `/opt/data/excalidraw-repo` (branch: master, depth=1)
- Key files:
  - `packages/excalidraw/renderer/animation.ts` — AnimationController class
  - `packages/excalidraw/tests/animation.test.ts` — 6 tests (3 pass, 3 fail)
- Test runner: vitest 3.0.6
- The tests are NEW (define desired behavior, not yet implemented)

## Known Issues (from my analysis)
1. Tests 1-2: `vi.getTimerCount()` returns 1 after synchronous `start()` even though no `scheduleNextFrame()` is called. Possibly vitest 3.0.6 creates an internal timer.
2. Test 3: `tick()` calls `scheduleNextFrame()` at the end, and `vi.runOnlyPendingTimersAsync()` processes that timer in the same batch. The test expects it NOT to process timers created during tick execution.

## Key Code Sections
- `start()` — lines 21-63: creates animation record, calls initial callback, schedules next frame
- `tick()` — lines 105-157: iterates animations, calls callbacks, handles scheduling
- `scheduleNextFrame()` — lines 64-80: creates setTimeout(0) or RAF timer
- `cancelScheduledFrameIfIdle()` — lines 82-93: cancels if no animations remain
- `cancel()` — lines 158-161: deletes animation, calls cancelScheduledFrameIfIdle

## My Approach (failed, for reference)
- Added `inTick` flag, skipped `scheduleNextFrame()` in `start()` during tick
- Tests 1-2 still failed (timerCount=1) — the issue is NOT in start()
- Test 3 still failed (replacementFrames=2) — `scheduleNextFrame()` at tick end still creates timer

## Constraints
- Do NOT change test expectations
- All 6 tests must pass
- No regressions in other test suites
- Keep code clean, no over-engineering

## Verification
```bash
cd /opt/data/excalidraw-repo
npx vitest run animation --reporter=verbose
npx tsc --noEmit
npx eslint packages/excalidraw/renderer/animation.ts
npx prettier --check packages/excalidraw/renderer/animation.ts
```
