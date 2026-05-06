# Scoring Rubric: excalidraw-lasso-selection

## Correctness (0-35)

- Lasso path correctly tracks pointer movement
- Enclosure detection works (elements fully inside loop are selected)
- Intersection detection works (elements crossing the path are selected)
- Text container selection works (selecting text selects its container)
- Frame selection works (frames select as units)
- Group selection works (selecting any group member selects the group)
- Shift+drag adds to existing selection

**Full marks:** All selection scenarios work correctly with edge cases handled.
**Zero:** Lasso tool doesn't select anything or builds fail.

## Code Quality (0-20)

- Follows excalidraw conventions (TypeScript, React patterns)
- Clean class design extending AnimatedTrail
- Proper use of existing math utilities
- Well-structured separation between trail rendering and selection logic

**Full marks:** Code looks like it belongs in the codebase.
**Zero:** Ignores all conventions, messy implementation.

## Completeness (0-20)

- Tool registered in constants and types
- Toolbar button present (desktop + mobile)
- Command palette entry
- Keyboard shortcut (Ctrl+Alt toggle)
- Pointer event handling in App.tsx
- Drag prevention during lasso

**Full marks:** Full integration across toolbar, shortcuts, and event handling.
**Zero:** Only core logic, no UI integration.

## Minimality (0-15)

- Changes only what's necessary
- Doesn't modify AnimatedTrail base class
- Doesn't restructure existing selection logic
- Extra edge case handling is NOT penalized

**Full marks:** Clean, focused changes.
**Zero:** Massive changes to unrelated code.

## Test Quality (0-10)

- Meaningful tests for lasso selection
- Tests cover enclosure, intersection, special cases
- Behavior-focused tests

**Full marks:** Comprehensive test coverage.
**Zero:** No tests written.

## Hard Gates

- Build failure → total capped at 30
- Regressions (breaking existing tests) → total capped at 30
