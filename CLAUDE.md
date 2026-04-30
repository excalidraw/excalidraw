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

### Architecture (4 touch points)

| Concern | File |
|---|---|
| Data model | `packages/element/src/types.ts` — `ExcalidrawTextElement` |
| Selection tracking | `packages/excalidraw/wysiwyg/textWysiwyg.tsx` |
| Apply color to selection | `packages/excalidraw/actions/actionProperties.tsx` — `actionChangeStrokeColor` |
| Canvas paint | `packages/element/src/renderElement.ts` — text branch around `fillText` |

### Phase 1 — capture the range (do this first, then `/verify`)

Edit the data model, selection tracker, and color action. **Leave the renderer for Phase 2** — verify the data flow first.

**1. `packages/element/src/types.ts`** — add an optional field to `ExcalidrawTextElement` directly after `originalText`:

```ts
colorRanges?: ReadonlyArray<{
  start: number;
  end: number;
  color: string;
}>;
```

**2. `packages/excalidraw/wysiwyg/textWysiwyg.tsx`** — the editor is a plain `<textarea>`, so the color action can't read the selection from the DOM reliably (clicking the panel may blur it). Export a small module-level tracker.

Just above `export const textWysiwyg = ({` (after `type SubmitHandler = …`):

```ts
export const activeTextSelection: {
  elementId: string | null;
  start: number;
  end: number;
} = { elementId: null, start: 0, end: 0 };
```

And right after `editable.classList.add("excalidraw-wysiwyg");`:

```ts
activeTextSelection.elementId = id;
activeTextSelection.start = 0;
activeTextSelection.end = 0;
const trackSelection = () => {
  activeTextSelection.start = editable.selectionStart;
  activeTextSelection.end = editable.selectionEnd;
};
editable.addEventListener("select", trackSelection);
editable.addEventListener("keyup", trackSelection);
editable.addEventListener("click", trackSelection);
```

**3. `packages/excalidraw/actions/actionProperties.tsx`** — import the tracker (add alongside the other relative imports near the bottom of the import block):

```ts
import { activeTextSelection } from "../wysiwyg/textWysiwyg";
```

Then replace the `perform` of `actionChangeStrokeColor` so that, when the active text element has a non-empty selection, it appends a `colorRanges` entry instead of overwriting `strokeColor`:

```ts
perform: (elements, appState, value) => {
  return {
    ...(value?.currentItemStrokeColor && {
      elements: changeProperty(
        elements,
        appState,
        (el) => {
          if (
            el.type === "text" &&
            el.id === activeTextSelection.elementId &&
            activeTextSelection.start !== activeTextSelection.end
          ) {
            const range = {
              start: activeTextSelection.start,
              end: activeTextSelection.end,
              color: value.currentItemStrokeColor,
            };
            activeTextSelection.start = activeTextSelection.end;
            return newElementWith(el, {
              colorRanges: [...(el.colorRanges ?? []), range],
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

1. Navigate to `http://localhost:3001`, wait ~3s for the bundle.
2. **Click an empty area of the canvas first** (e.g. lower-left, away from the welcome menu) so the app has keyboard focus.
3. Press `8` to activate the text tool, then click near canvas centre, type `Hello World`.
4. While still editing, select the last word with key `alt+shift+ArrowLeft`.
5. Take a screenshot. In the left panel under **Stroke**, click the **red swatch** at its on-screen coordinates (do not use a `ref`/`find` click for this — see browser tips below).
6. Press `Escape` twice (commit text, deselect).
7. Zoom-screenshot the text. **Expected:** `Hello` black, `World` red.
8. Confirm the data via `javascript_tool`:
   ```js
   JSON.stringify(window.h.elements?.find(e => e.type === "text")?.colorRanges)
   ```

### What you'll find after Phase 1

Step 8 returns `[{"start":6,"end":11,"color":"#e03131"}]` — the range **is** captured. But step 7's screenshot shows the whole string in the base stroke color. **This is the gap `/verify` should catch.** Report it as a FAIL: "color range is captured on the element, but `renderElement.ts` still paints the entire string with `element.strokeColor`."

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

Editing `renderElement.ts` triggers a **full page reload** (not HMR), so the canvas will be empty afterward — re-run the `/verify` scenario from step 2. It should now PASS. Export the GIF to `~/Desktop/excalidraw-color-ranges.gif`.

### Out of scope (do not implement)

Multi-line range splitting, SVG export, range index shifting on edit, collab merge. Mention these as follow-ups in your summary; don't write the code.

---

## Excalidraw browser-automation tips

These are not yet in `/verify` — if you rely on them during a session and are later asked to improve `/verify`, fold the relevant ones in.

- **Focus before hotkeys**: tool hotkeys (`8`=text, `r`=rect, `v`/`1`=select) only register when the app has focus. Click an empty canvas area before sending them.
- **Text editing**: a single click on text only selects the bounding box. **Double-click** to enter edit mode (textarea `.excalidraw-wysiwyg` appears). **Escape** commits.
- **Word selection in the textarea**: `alt+shift+ArrowLeft` / `ArrowRight` selects by word.
- **Properties-panel clicks need real pointer events**: the wysiwyg only stays open through panel clicks because of a `pointerdown` capture handler. The browser tool's `ref`-based `left_click` skips pointer events — use **coordinate** `left_click` for color swatches and other panel controls while editing text.
- **Debug handle**: `window.h.elements` is the live element array — useful for asserting data without pixel-peeping.
- **Canvas clear**: `Cmd+A` then `Backspace`, then press `1` to return to the selection tool.

## When asked to update `/verify`

Read `.claude/skills/verify/SKILL.md`, then add a short **"Excalidraw interaction tips"** section after the existing "Notes" with the focus/hotkey, text-editing, word-select, coordinate-click-for-panel, and `window.h` items above. Keep the skill generic — these are tips, not feature-specific steps.

---

## Architecture Notes

### Package System

- Uses Yarn workspaces for monorepo management
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration
