## 🚀 Adobe Whiteboard — Focus Mode, Inspiration Panel & Adobe rebrand

### What's changed

- **Focus Mode** — a new spotlight view that dims every canvas element except the current selection. Toggle it with `Alt+F` or from Main menu → Preferences. It works in view mode, is hidden on phones, and is off by default (the setting is not persisted between sessions).
- **Inspiration Panel** — a new "✨ Inspiration" button in the top-right UI opens a popover with three static suggestion cards. This is a cosmetic prototype only.
- **Adobe rebrand** — the app is now "Adobe Whiteboard": Adobe red (`#EB1000`) replaces the purple accent throughout, the logo is the Adobe "A" mark and wordmark, and the favicon, page title, social meta tags and user-facing strings were updated to match. The logo also now appears in the top-left once the welcome screen is dismissed.
- **UI typography** — interface chrome (menus, dialogs, tooltips, frame labels) now renders in Century Gothic.
- **Toolbar and canvas polish** — the arrow and ellipse tools swapped positions (arrow is now `4`, ellipse `5`), the shape toolbar background matches the hamburger menu grey, and the default canvas background is off-white (`#f8f9fa`) instead of pure white.

### User impact

Focus Mode is the substantive addition: on a busy board it removes the visual noise around whatever you're working on, which helps during reviews and screen-shares without needing to hide or move anything. The rebrand and toolbar changes give the app a consistent Adobe identity, and the arrow tool moving one slot left puts a more frequently used tool in easier reach.

### Technical notes

Focus Mode adds a `focusModeEnabled` flag to app state and reuses the existing `reduceAlphaForSelection` path in `renderElement`, so dimming only kicks in when there is an active selection and no new render pass was introduced. It is registered as a standard action with a menu checkbox and shortcut entry, so it picks up command palette and help dialog integration for free. The font change is applied centrally via a new `UI_FONT_FAMILY` constant that `getFontFamilyString` returns for the Assistant font family, meaning it applies without touching individual components. The Inspiration Panel is self-contained and deliberately has no API calls, persistence or canvas side-effects.

### Testing

Full suite run: **1461 passed, 2 failed, 48 skipped** across 107 test files. Existing snapshot suites were regenerated to absorb the branding, colour and toolbar-ordering changes. No new automated tests were added for Focus Mode, the Inspiration Panel or the rebrand, so those features are covered by manual checks only.

### Known limitations

- **Two regression tests are failing.** `key 4 selects ellipse tool` and `key 5 selects arrow tool` in `regressionTests.test.tsx` still assert the old tool order; the arrow/ellipse swap changed the numeric keys but the test table was never updated. The letter shortcuts (`O`, `A`) are unaffected. This is a stale test, not a product defect, but it leaves `master` red.
- **Typecheck is failing on `master`.** `excalidraw-app/components/BrainstormMode.tsx` imports `useAdobeWhiteboardAPI` from `@excalidraw/excalidraw`, but the package exports `useExcalidrawAPI`. `yarn test:typecheck` exits with `TS2305`.
- **Brainstorm Mode is not shipping.** The component exists but is never rendered anywhere in the app, so the advertised `Cmd/Ctrl+Shift+B` sticky-note capture is unreachable. It is excluded from this release.
- Focus Mode is deliberately unavailable on phone form factors and its state resets on reload.
- The Inspiration Panel suggestions are hardcoded and do nothing when clicked beyond closing the popover.
