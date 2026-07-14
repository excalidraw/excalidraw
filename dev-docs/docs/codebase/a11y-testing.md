# Screen reader (NVDA) testing protocol

Manual test protocol for the accessibility layer (see `ACCESSIBILITY_PLAN.md` in the repo root). Run with **NVDA on Windows** against `yarn start`, in both **Firefox** and **Chrome**; repeat key flows with JAWS / Narrator / VoiceOver when available. Use NVDA's Speech Viewer (NVDA menu → Tools) to log output.

## Setup

- Repo runs under WSL2: `yarn start`, open the printed `localhost` URL in the Windows host browser.
- The a11y live regions are appended to `document.body` (`#excalidraw-a11y-announcer`); the scene mirror is `.excalidraw-a11y-scene`.

## Test scripts

### 1. Orientation (empty canvas)

- Land on the page: nothing guide-related is visible, and no dialog is open. In browse mode the visually-hidden **"Screen reader guide"** region comes before the toolbar — a heading plus a **list** (one shortcut topic per item, skimmable with list-item navigation), ending with the "How to navigate with a screen reader" button.
- Activate that button (or press `Alt+Shift+H` anywhere): the guide dialog opens, reads linearly in browse mode (headings + lists), and closes with `Escape`, restoring focus.
- `Alt+Shift+A` from anywhere (toolbar, panels, dialogs closed) jumps focus straight to the canvas area: the current element proxy, or the editor container on an empty canvas.
- Tab through the toolbar: every tool announces name + shortcut (e.g. "Rectangle, radio button, r 2"), never "or null".
- The hamburger button announces "Menu"; its items (Open, Save to…, Export image…) all have names.

### 2. Create & label a flowchart without a mouse

1. `r`, then `Enter` → expect "Rectangle tool", then "Rectangle added".
2. `Enter` on the selected rectangle → text editor opens; type "Start", `Escape`.
3. Browse to the rectangle (Tab), press `r`, `Enter` → "Rectangle added below Start".
4. Label it "End". Select both without the pointer: browse to "Start", press `Space` ("Added to selection…"), `Ctrl+Alt+Shift+Arrow` to "End" (selection must survive the trip), `Space` again → "2 selected". Then `Alt+C` (or context menu → "Connect with arrow") → expect "Arrow connected Start to End".
5. Browse the shapes: each should announce "…connected to …".
6. `Ctrl+Arrow` from a selected node creates a connected node (flowchart); `Alt+Arrow` moves along connections.

### 3. Browse & inspect a seeded scene

- Tab / Shift+Tab move through elements in reading order with "…, N of M, …" announcements; focus ring visible; viewport pans to off-screen elements.
- `Ctrl+Alt+Arrow` jumps spatially.
- Escape returns to the editor container; no keyboard trap either way.
- Element descriptions include the conceptual color ("red", "blue, light green fill") — color a few shapes alike and verify they can be recognized as belonging together; custom (non-palette) colors must still announce a sensible family name, never a hex code.

### 4. Manipulate

- Arrows move ("Moved to x, y"), `Alt+Shift+Arrows` resize ("W by H"), `Alt+Shift+R`/`Alt+Shift+E` rotate ("Rotated N degrees") — all coalesced (holding a key must not spam).
- `Ctrl+Z` / `Ctrl+Shift+Z` announce "Undo" / "Redo"; delete, duplicate, group/ungroup, align and flip announce their results.
- Changing stroke/background color announces "Stroke red" / "Fill light blue" (transparent → "Fill transparent"); the color-picker quick picks and shade buttons are named by color concept, not hex.
- Line points: select a line, `Enter` → "Point 1 of N…" after `Tab`; arrows move the point ("Point at x, y"), `Ctrl+D` duplicates ("Point added"), `Delete` removes ("Point deleted"), `Escape` exits.
- Crop: `Enter` on an image starts cropping; arrows / `Shift+Arrows` announce "Cropped to W by H"; `Escape`/`Enter` finish.
- `F6` / `Shift+F6` cycle toolbar → canvas → styles panel → sidebar → footer; `Alt+Shift+A` jumps straight to the canvas area from anywhere.
- Command palette → "Toggle single-key shortcuts": after disabling, `r` must NOT switch tools (announced); re-enable and verify `r` works again.

### 5. Images

- Insert an image (pointer), context menu → "Alt text…", enter a description, confirm ("Alt text saved"); browse to it → description is spoken.
- Export to SVG: the file has `role="img"`, a root label, and per-element `<title>`s.

### 6. Dialogs, menus, palette

- `Ctrl+/` command palette: results list announces the active item while arrowing; typing filters; "No matching commands" is announced.
- Context menu: arrow keys move, Home/End jump, Esc/Tab close.
- Every dialog announces its title on open; focus is trapped and restored.

### 7. Collaboration (two browsers)

- Second participant joining/leaving is announced by name.

## Regression checks

- Pointer UX must be pixel-identical (no visible changes except the keyboard-only focus ring).
- `yarn test:typecheck && yarn test:app` — `tests/a11y.test.tsx` covers reading order, descriptions, proxy navigation, keyboard creation and manipulation.
