# CLAUDE.md

## Project Structure

Excalidraw is a **monorepo** with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`
- **`examples/`** - Integration examples (NextJS, browser script)

## Development Commands

```bash
yarn start           # Dev server → http://localhost:3001
yarn test:typecheck  # TypeScript type checking
yarn test:update     # Run all tests (with snapshot updates)
yarn fix             # Auto-fix formatting and linting issues
```

---

## Working on issue #1126 (text color ranges)

When asked to implement [#1126](https://github.com/excalidraw/excalidraw/issues/1126) — coloring a selected range of text inside a single text element — follow this scoped, two-phase plan. Do **not** explore alternatives (Quill/Slate/contentEditable rewrite); the maintainers want the minimal additive change below.

### Architecture (3 touch points)

| Concern | File |
|---|---|
| Data model | `packages/element/src/types.ts` — `ExcalidrawTextElement` |
| Apply color to selection | `packages/excalidraw/actions/actionProperties.tsx` — `actionChangeStrokeColor` |
| Canvas paint | `packages/element/src/renderElement.ts` — text branch around `fillText` |

### Phase 1 — capture the range (do this first, then `/verify`)

Edit **only** the data model and the action. Leave the renderer for Phase 2.

**`packages/element/src/types.ts`** — add an optional field to `ExcalidrawTextElement` directly after `originalText`:

```ts
colorRanges?: ReadonlyArray<{
  start: number;
  end: number;
  color: string;
}>;
```

**`packages/excalidraw/actions/actionProperties.tsx`** — inside `actionChangeStrokeColor.perform`, before the `return`, read the live wysiwyg textarea selection. If the user is editing text and has a non-empty selection, append a `colorRanges` entry instead of changing `strokeColor`:

```ts
perform: (elements, appState, value) => {
  const editor = document.querySelector<HTMLTextAreaElement>(
    ".excalidraw-wysiwyg",
  );
  const hasTextSelection =
    appState.editingTextElement &&
    editor &&
    editor.selectionStart !== editor.selectionEnd;

  return {
    ...(value?.currentItemStrokeColor && {
      elements: changeProperty(
        elements,
        appState,
        (el) => {
          if (
            hasTextSelection &&
            el.id === appState.editingTextElement?.id &&
            el.type === "text"
          ) {
            return newElementWith(el, {
              colorRanges: [
                ...(el.colorRanges ?? []),
                {
                  start: editor.selectionStart,
                  end: editor.selectionEnd,
                  color: value.currentItemStrokeColor,
                },
              ],
            });
          }
          return hasStrokeColor(el.type)
            ? newElementWith(el, {
                strokeColor: value.currentItemStrokeColor,
              })
            : el;
        },
        true,
      ),
    }),
    appState: { ...appState, ...value },
    captureUpdate: !!value?.currentItemStrokeColor
      ? CaptureUpdateAction.IMMEDIATELY
      : CaptureUpdateAction.EVENTUALLY,
  };
},
```

After Phase 1, run `yarn test:typecheck`, then immediately invoke `/verify` with the test scenario below. Do **not** preemptively edit the renderer — verify the data flow first.

### `/verify` test scenario for this feature

1. Clear the canvas (Cmd+A, Backspace).
2. Press `t` to activate the text tool, click near canvas center, type `Hello World`.
3. While still in edit mode, select the word `World` — keyboard is most reliable: send key `alt+shift+ArrowLeft` (selects the previous word from the end-of-line cursor).
4. In the left properties panel, click the **Stroke** color row, then pick the red swatch (`#e03131`). Use `find` with query `"stroke color"` to locate the picker if coordinates are unclear.
5. Press `Escape` to commit the text to canvas.
6. Zoom-screenshot the text element. **Expected:** `Hello ` in black, `World` in red.
7. After the verdict, confirm the data was captured with `javascript_tool`:
   ```js
   JSON.stringify(window.h.app.scene.getNonDeletedElements().find(e => e.type === "text")?.colorRanges)
   ```

### What you'll find after Phase 1

The `colorRanges` array is populated correctly (step 7 returns `[{start:6,end:11,color:"#e03131"}]`) but the canvas still paints the entire string in `strokeColor`. **This is the bug `/verify` should catch.** Report it as a FAIL: "color range is captured but `renderElement.ts` doesn't read `colorRanges` — text renders single-color on canvas."

### Phase 2 — paint the ranges (the fix)

**`packages/element/src/renderElement.ts`** — in the text branch, after the existing `for` loop that calls `context.fillText(lines[index], …)` and before `context.restore()`, overlay each range:

```ts
if (element.colorRanges?.length) {
  context.textAlign = "left";
  for (const range of element.colorRanges) {
    const before = element.text.slice(0, range.start);
    const segment = element.text.slice(range.start, range.end);
    const x = context.measureText(before).width;
    context.fillStyle =
      renderConfig.theme === THEME.DARK
        ? applyDarkModeFilter(range.color)
        : range.color;
    context.fillText(segment, x, verticalOffset);
  }
}
```

Re-run `/verify` with the same scenario. It should now PASS. Export the GIF to `~/Desktop/excalidraw-color-ranges.gif`.

### Out of scope (do not implement)

Multi-line range splitting, SVG export, range index shifting on edit, collab merge. Note these as follow-ups in your summary; don't write the code.

---

## Excalidraw browser-automation tips

These are not yet in `/verify` — if you rely on them during a session and are later asked to improve `/verify`, fold the relevant ones in.

- **Text editing**: a single click on text only selects the bounding box. **Double-click** to enter edit mode (textarea appears with class `.excalidraw-wysiwyg`). **Escape** commits; clicking elsewhere may create a new element if a draw tool is active.
- **Word selection in the textarea**: `alt+shift+ArrowLeft` / `ArrowRight` selects by word. `Cmd+A` selects all.
- **Properties panel** only renders when an element is selected or being edited.
- **Debug handle**: `window.h.app.scene.getNonDeletedElements()` returns the live element array — useful for asserting data without pixel-peeping.
- **Canvas clear**: `Cmd+A` then `Backspace`, then press `1` (or `v`) to return to the selection tool.

## When asked to update `/verify`

Read `.claude/skills/verify/SKILL.md`, then add a short **"Excalidraw interaction tips"** section after the existing "Notes" with the text-editing specifics above (double-click to edit, Escape to commit, alt+shift+arrow word select, `window.h` debug handle). Keep the skill generic — these are tips, not feature-specific steps.

---

## Architecture Notes

### Package System

- Uses Yarn workspaces for monorepo management
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration
