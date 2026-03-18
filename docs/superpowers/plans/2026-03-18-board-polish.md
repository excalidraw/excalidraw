# Board Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the excalidraw whiteboard for recording exam walkthrough videos — fix mobile 2D shapes, improve undo gesture, complete Russian translations, add stroke width slider, highlighter preset, and tooltips with Apple Pencil hover.

**Architecture:** Six independent changes to the excalidraw fork. Each task produces a working commit. No cross-task dependencies except Task 4 (slider) should land before Task 5 (highlighter) since the slider component informs highlighter's thickness control.

**Tech Stack:** React, TypeScript, SCSS, SVG icons. Monorepo with Yarn workspaces. Build via esbuild. No unit test framework for UI — verify via `yarn test:typecheck` + `yarn fix` + `yarn build:esm`.

**Spec:** `docs/superpowers/specs/2026-03-18-board-polish-design.md`

---

### Task 1: Fix mobile 2D shape bounding box

**Files:**

- Modify: `packages/element/src/transformHandles.ts:328-354`

- [ ] **Step 1: Add poly-preset check to `hasBoundingBox()`**

In `packages/element/src/transformHandles.ts`, add import at top with other imports:

```typescript
import { isPolyPresetType } from "./polyPresets";
```

Then modify the `hasBoundingBox()` function. Current code at line ~348-353:

```typescript
if (!isLinearElement(element)) {
  return true;
}

// on mobile/tablet we currently don't show bbox because of resize issues
// (also prob best for simplicity's sake)
return element.points.length > 2 && !editorInterface.userAgent.isMobileDevice;
```

Replace with:

```typescript
if (!isLinearElement(element)) {
  return true;
}

// Poly-preset shapes (triangle, pentagon, etc.) are linear elements
// but should always show bounding box — they are closed shapes, not lines
if (isPolyPresetType(element.type)) {
  return true;
}

// on mobile/tablet we currently don't show bbox because of resize issues
// (also prob best for simplicity's sake)
return element.points.length > 2 && !editorInterface.userAgent.isMobileDevice;
```

- [ ] **Step 2: Verify types**

Run: `yarn test:typecheck` Expected: PASS — `isPolyPresetType` accepts `string`, `element.type` is `string`.

- [ ] **Step 3: Verify lint**

Run: `yarn fix` Expected: 0 warnings.

- [ ] **Step 4: Build**

Run: `cd packages/excalidraw && yarn build:esm` Expected: Build succeeds.

- [ ] **Step 5: Manual test on mobile**

Open dev server on a mobile device or use Chrome DevTools device emulation:

1. Draw a triangle → verify bounding box, resize handles, and rotation handle appear after releasing finger
2. Tap on existing triangle → verify blue bounding box appears with handles
3. Repeat for pentagon, trapezoid, other 2D presets
4. Verify 3D wireframe presets still work as before (vertex-based selection)
5. Verify regular lines/arrows on mobile still behave as before (no bbox on mobile)

- [ ] **Step 6: Commit**

```bash
git add packages/element/src/transformHandles.ts
git commit -m "fix: show bounding box for 2D poly-presets on mobile"
```

---

### Task 2: Two-finger double-tap undo tolerance

**Files:**

- Modify: `packages/common/src/constants.ts:295-305`
- Modify: `packages/excalidraw/components/App.tsx:603-614,3581-3651`

- [ ] **Step 1: Add constants**

In `packages/common/src/constants.ts`, after `TAP_TWICE_TIMEOUT` (line ~297), add:

```typescript
export const TWO_FINGER_TAP_MAX_DURATION = 300;
export const TWO_FINGER_TAP_MAX_DISTANCE = 15;
export const TWO_FINGER_DOUBLE_TAP_TIMEOUT = 500;
```

- [ ] **Step 2: Replace module-level state variables in App.tsx**

In `packages/excalidraw/components/App.tsx`, replace the two-finger tap variables at lines ~607-608:

```typescript
// Two-finger double-tap for undo (like Procreate)
let didTwoFingerTap: boolean = false;
let twoFingerTapTimer = 0;
```

With:

```typescript
// Two-finger double-tap for undo (like Procreate)
// Detect on touchend: if both fingers lifted quickly and didn't move much → tap
let twoFingerTouchStart: {
  time: number;
  positions: Array<{ x: number; y: number }>;
} | null = null;
let lastTwoFingerTapTime = 0;
```

- [ ] **Step 3: Update onTouchStart handler**

In `packages/excalidraw/components/App.tsx`, find the `if (event.touches.length === 2)` block inside `onTouchStart` (lines ~3630-3651). Replace the two-finger double-tap logic:

Current code (lines ~3630-3644):

```typescript
if (event.touches.length === 2) {
  // Two-finger double-tap → undo (500ms window)
  if (!didTwoFingerTap) {
    didTwoFingerTap = true;
    clearTimeout(twoFingerTapTimer);
    twoFingerTapTimer = window.setTimeout(() => {
      didTwoFingerTap = false;
    }, 500);
  } else {
    // Second two-finger tap within timeout → undo
    didTwoFingerTap = false;
    clearTimeout(twoFingerTapTimer);
    this.actionManager.executeAction(this.undoAction, "ui");
    return;
  }
```

Replace with:

```typescript
if (event.touches.length === 2) {
  // Record two-finger touch start for tap detection on touchend
  twoFingerTouchStart = {
    time: Date.now(),
    positions: Array.from(event.touches).map((t) => ({
      x: t.clientX,
      y: t.clientY,
    })),
  };
```

Keep the rest of the block unchanged (the `setState` call that deselects elements).

- [ ] **Step 4: Add two-finger tap detection to onTouchEnd**

In `packages/excalidraw/components/App.tsx`, find `onTouchEnd` method (around line 3653). Add the two-finger tap detection at the beginning of the method, before any existing logic:

```typescript
// Two-finger double-tap undo detection
if (
  twoFingerTouchStart &&
  event.touches.length === 0 // both fingers lifted
) {
  const duration = Date.now() - twoFingerTouchStart.time;
  if (duration < TWO_FINGER_TAP_MAX_DURATION) {
    // Check that fingers didn't move much (not a pinch/swipe)
    const touches = event.changedTouches;
    let movedTooMuch = false;
    for (let i = 0; i < touches.length; i++) {
      const start = twoFingerTouchStart.positions[i];
      if (start) {
        const dx = touches[i].clientX - start.x;
        const dy = touches[i].clientY - start.y;
        if (Math.hypot(dx, dy) > TWO_FINGER_TAP_MAX_DISTANCE) {
          movedTooMuch = true;
          break;
        }
      }
    }
    if (!movedTooMuch) {
      const now = Date.now();
      if (now - lastTwoFingerTapTime < TWO_FINGER_DOUBLE_TAP_TIMEOUT) {
        // Second two-finger tap → undo
        lastTwoFingerTapTime = 0;
        twoFingerTouchStart = null;
        this.actionManager.executeAction(this.undoAction, "ui");
        return;
      }
      lastTwoFingerTapTime = now;
    }
  }
  twoFingerTouchStart = null;
}
```

Additionally, track two rapid single-finger taps as an alternative pattern. Add after the `event.touches.length === 0` block above:

```typescript
// Alternative: two rapid single-finger taps (near-simultaneous, ~150ms apart)
// Covers case where fingers don't overlap at all
if (
  event.touches.length === 0 &&
  event.changedTouches.length === 1 &&
  !twoFingerTouchStart
) {
  // This is handled by checking if a single-finger tap happened
  // very recently (within 150ms) after a previous single-finger tap,
  // where both taps were short duration and close together in time.
  // If the existing single-tap double-tap logic (didTapTwice) fires
  // within 150ms, treat it as a two-finger tap equivalent.
  // This is a stretch goal — implement if the touchend-based detection
  // above doesn't fully solve the UX issue during testing.
}
```

> **Note:** The alternative single-finger rapid-tap pattern is a stretch goal. The primary touchend-based detection (above) should solve most cases. If testing reveals the alternative is needed, implement it as a follow-up.

Add the import for the new constants at the top of the file (with existing imports from `@excalidraw/common`):

```typescript
import {
  // ... existing imports ...
  TWO_FINGER_TAP_MAX_DURATION,
  TWO_FINGER_TAP_MAX_DISTANCE,
  TWO_FINGER_DOUBLE_TAP_TIMEOUT,
} from "@excalidraw/common";
```

- [ ] **Step 5: Verify types and lint**

Run: `yarn test:typecheck && yarn fix` Expected: Both pass.

- [ ] **Step 6: Build**

Run: `cd packages/excalidraw && yarn build:esm` Expected: Build succeeds.

- [ ] **Step 7: Manual test on touch device**

1. Two-finger double-tap with both fingers simultaneously → should undo
2. Two-finger double-tap with slight offset (~50-100ms between fingers) → should still undo
3. Pinch-to-zoom → should NOT trigger undo (fingers move too much)
4. Two-finger pan → should NOT trigger undo
5. Single two-finger tap → should NOT undo (requires double-tap)
6. Wait >500ms between taps → should NOT undo

- [ ] **Step 8: Commit**

```bash
git add packages/common/src/constants.ts packages/excalidraw/components/App.tsx
git commit -m "fix: two-finger double-tap undo detects on touchend for tolerance"
```

---

### Task 3: Russian translation completion + quality fixes

**Files:**

- Modify: `packages/excalidraw/locales/ru-RU.json`

- [ ] **Step 1: Add missing translation keys**

In `packages/excalidraw/locales/ru-RU.json`, add the following keys in their correct nested locations:

Inside `"labels"` object, add:

```json
"cardinality": "Кардинальность",
"arrowhead_cardinality_one": "Один",
"arrowhead_cardinality_many": "Много",
"arrowhead_cardinality_one_or_many": "Один или много",
"arrowhead_cardinality_exactly_one": "Ровно один",
"arrowhead_cardinality_zero_or_one": "Ноль или один",
"arrowhead_cardinality_zero_or_many": "Ноль или много",
"chartType_bar": "Столбчатая диаграмма",
"chartType_line": "Линейная диаграмма",
"chartType_radar": "Радарная диаграмма",
"chartType_plaintext": "Обычный текст",
"preferences": "Настройки",
"preferences_toolLock": "Фиксация инструмента",
"arrowBinding": "Привязка стрелок",
"midpointSnapping": "Привязка к середине"
```

Add new top-level section (after `"chat"` section):

```json
"progressDialog": {
  "title": "Сохранение",
  "defaultMessage": "Подготовка к сохранению..."
}
```

Inside `"mermaid"` object, add:

```json
"autoFixAvailable": "Доступно автоисправление"
```

- [ ] **Step 2: Fill empty translation values**

Update these existing empty values:

```json
"welcomeScreen.app.center_heading": "Ваши рисунки сохраняются в хранилище браузера.",
"welcomeScreen.app.center_heading_line2": "Хранилище браузера может быть очищено неожиданно.",
"welcomeScreen.app.center_heading_line3": "Сохраняйте работу в файл, чтобы не потерять её.",
"chat.generating": "Генерация...",
"chat.errors.mermaidParseError": "Ошибка синтаксиса Mermaid"
```

- [ ] **Step 3: Fix quality issues in existing translations**

Apply these fixes:

| Key path | Old | New |
| --- | --- | --- |
| `toolBar.frame` | `"Фреймовый инструмент"` | `"Рамка"` |
| `toolBar.freedraw` | `"Чертить"` | `"Карандаш"` |
| `toolBar.magicframe` | `"Каркас для кода"` | `"Магическая рамка"` |
| `element.magicframe` | `"Каркас для кода"` | `"Магическая рамка"` |
| `labels.lineEditor.edit` | `"Редактирование строки"` | `"Редактировать линию"` |
| `labels.sloppiness` | `"Стиль обводки"` | `"Небрежность"` |
| `labels.arrowhead_crowfoot_many` | `"Морщинки (много)"` | `"Вороньи лапки (много)"` |
| `labels.arrowhead_crowfoot_one` | `"Морщинки (одна)"` | `"Вороньи лапки (одна)"` |
| `labels.arrowhead_crowfoot_one_or_many` | `"Морщинки (одна или много)"` | `"Вороньи лапки (одна или много)"` |
| `helpDialog.zoomToFit` | `"Отмастштабировать, чтобы поместились все элементы"` | `"Отмасштабировать, чтобы поместились все элементы"` |
| `alerts.uploadedSecurly` | `"Загружаемые данные защищена сквозным шифрованием"` | `"Загружаемые данные защищены сквозным шифрованием"` |
| `toolBar.convertElementType` | `"Переключение типа формы"` | `"Сменить тип фигуры"` |
| `labels.multiSelect` | `"Добавить элемент в выделенный фрагмент"` | `"Добавить к выделению"` |

- [ ] **Step 4: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/excalidraw/locales/ru-RU.json', 'utf8')); console.log('Valid JSON')"` Expected: `Valid JSON`

- [ ] **Step 5: Verify lint**

Run: `yarn fix` Expected: 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/excalidraw/locales/ru-RU.json
git commit -m "fix: complete Russian translations and fix quality issues"
```

---

### Task 4: Stroke width slider with squiggle preview

**Files:**

- Create: `packages/excalidraw/components/StrokeWidthRange.tsx`
- Create: `packages/excalidraw/components/StrokeWidthRange.scss`
- Modify: `packages/excalidraw/actions/actionProperties.tsx:547-603`

- [ ] **Step 1: Create StrokeWidthRange component**

Create `packages/excalidraw/components/StrokeWidthRange.tsx`:

```typescript
import React, { useEffect, useRef } from "react";

import "./StrokeWidthRange.scss";

import type { AppClassProperties } from "../types";

const STROKE_WIDTH_MIN = 1;
const STROKE_WIDTH_MAX = 16;
const STROKE_WIDTH_STEP = 1;

// Squiggle wave path (centered, with padding from edges)
const SQUIGGLE_PATH =
  "M16 28 C24 28, 28 12, 36 12 C44 12, 48 28, 56 28 C64 28, 68 12, 76 12 C80 12, 84 20, 84 20";

export const StrokeWidthRange = ({
  value,
  strokeColor,
  opacity,
  onChange,
}: {
  value: number;
  strokeColor: string;
  opacity: number;
  onChange: (value: number) => void;
}) => {
  const rangeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rangeRef.current) {
      const pct =
        ((value - STROKE_WIDTH_MIN) / (STROKE_WIDTH_MAX - STROKE_WIDTH_MIN)) *
        100;
      rangeRef.current.style.background = `linear-gradient(to right, var(--color-slider-track) 0%, var(--color-slider-track) ${pct}%, var(--button-bg) ${pct}%, var(--button-bg) 100%)`;
    }
  }, [value]);

  return (
    <div className="stroke-width-range">
      <div className="stroke-width-range__preview">
        <svg
          width="100"
          height="40"
          viewBox="0 0 100 40"
          fill="none"
          aria-hidden="true"
        >
          <path
            d={SQUIGGLE_PATH}
            stroke={strokeColor}
            strokeOpacity={opacity / 100}
            strokeWidth={value}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
      <input
        ref={rangeRef}
        type="range"
        min={STROKE_WIDTH_MIN}
        max={STROKE_WIDTH_MAX}
        step={STROKE_WIDTH_STEP}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="stroke-width-range__input"
        data-testid="strokeWidth-slider"
      />
    </div>
  );
};
```

- [ ] **Step 2: Create StrokeWidthRange styles**

Create `packages/excalidraw/components/StrokeWidthRange.scss`:

```scss
@use "../css/variables.module" as *;

.excalidraw {
  .stroke-width-range {
    padding: 4px 0;
  }

  .stroke-width-range__preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 48px;
    margin-bottom: 4px;
  }

  .stroke-width-range__input {
    width: 100%;
    height: 4px;
    -webkit-appearance: none;
    background: var(--color-slider-track);
    border-radius: 2px;
    outline: none;
  }

  .stroke-width-range__input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: var(--slider-thumb-size, 16px);
    height: var(--slider-thumb-size, 16px);
    background: var(--color-slider-thumb);
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }

  .stroke-width-range__input::-moz-range-thumb {
    width: var(--slider-thumb-size, 16px);
    height: var(--slider-thumb-size, 16px);
    background: var(--color-slider-thumb);
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
}
```

- [ ] **Step 3: Replace PanelComponent in actionChangeStrokeWidth**

In `packages/excalidraw/actions/actionProperties.tsx`, add import at top:

```typescript
import { StrokeWidthRange } from "../components/StrokeWidthRange";
```

Replace the `PanelComponent` in `actionChangeStrokeWidth` (lines ~564-603):

```typescript
PanelComponent: ({ elements, appState, updateData, app }) => {
  const value = getFormValue(
    elements,
    app,
    (element) => element.strokeWidth,
    (element) => element.hasOwnProperty("strokeWidth"),
    (hasSelection) =>
      hasSelection ? null : appState.currentItemStrokeWidth,
  );

  return (
    <fieldset>
      <legend>{t("labels.strokeWidth")}</legend>
      <StrokeWidthRange
        value={value ?? appState.currentItemStrokeWidth}
        strokeColor={appState.currentItemStrokeColor}
        opacity={appState.currentItemOpacity}
        onChange={(val) => updateData(val)}
      />
    </fieldset>
  );
},
```

- [ ] **Step 4: Verify types and lint**

Run: `yarn test:typecheck && yarn fix` Expected: Both pass.

- [ ] **Step 5: Build**

Run: `cd packages/excalidraw && yarn build:esm` Expected: Build succeeds.

- [ ] **Step 6: Manual test**

1. Select a shape → open stroke properties → verify slider appears with squiggle preview
2. Drag slider → squiggle thickness changes in real-time
3. Verify squiggle color matches current stroke color
4. Verify squiggle opacity matches current element opacity
5. Change stroke color → squiggle updates
6. Verify slider snaps to integer values 1-16
7. Verify in compact mode popover — slider fits within ~13rem width

- [ ] **Step 7: Commit**

```bash
git add packages/excalidraw/components/StrokeWidthRange.tsx packages/excalidraw/components/StrokeWidthRange.scss packages/excalidraw/actions/actionProperties.tsx
git commit -m "feat: stroke width slider with squiggle preview (1-16, discrete)"
```

---

### Task 5: Highlighter (freedraw preset)

**Files:**

- Modify: `packages/excalidraw/components/icons.tsx` (add highlighter icon)
- Modify: `packages/excalidraw/components/shapes.tsx:258-264` (add highlighter to freedraw group)
- Modify: `packages/excalidraw/components/Actions.tsx` (add ToolPopover for freedraw/highlighter)
- Modify: `packages/excalidraw/components/App.tsx` (tool switch logic, store/restore settings)

- [ ] **Step 1: Add highlighter icon**

In `packages/excalidraw/components/icons.tsx`, add after FreedrawIcon export:

```typescript
export const HighlighterIcon = createIcon(
  <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path
      d="M15.5 2.5L21.5 8.5L12 18L6 18L6 12L15.5 2.5Z"
      strokeWidth="1.25"
      fill="none"
    />
    <path d="M6 18L3 21L6 21L7.5 19.5" strokeWidth="1.25" fill="none" />
    <line
      x1="14"
      y1="6"
      x2="18"
      y2="10"
      strokeOpacity="0.5"
      strokeWidth="1.25"
    />
    <line
      x1="12"
      y1="8"
      x2="16"
      y2="12"
      strokeOpacity="0.5"
      strokeWidth="1.25"
    />
    <line x1="6" y1="12" x2="12" y2="18" strokeWidth="1.25" />
  </g>,
  { fill: "none", width: 24, height: 24 },
);
```

- [ ] **Step 2: Add highlighter to SHAPES definition**

In `packages/excalidraw/components/shapes.tsx`, replace the freedraw entry (lines ~258-264):

```typescript
{
  icon: FreedrawIcon,
  value: "freedraw",
  key: [KEYS.P, KEYS.X],
  numericKey: KEYS["7"],
  fillable: false,
  toolbar: true,
},
```

With a group containing both pencil and highlighter. First, add the import at top:

```typescript
import { HighlighterIcon } from "./icons";
```

Then update the entry. The exact approach depends on how ToolPopover groups are defined — follow the selection/lasso pattern from `Actions.tsx`. The freedraw shape entry stays as-is; the highlighter variant is handled in Actions.tsx via ToolPopover (same as selection/lasso).

- [ ] **Step 3: Add highlighter mode state to App.tsx**

In `packages/excalidraw/components/App.tsx`, add module-level variables near line ~603:

```typescript
// Highlighter mode preset values
let isHighlighterMode = false;
let savedPencilSettings: {
  strokeWidth: number;
  opacity: number;
} | null = null;

const HIGHLIGHTER_DEFAULTS = {
  strokeWidth: 12,
  opacity: 40,
};
```

Add a method to the App class for toggling highlighter mode:

```typescript
public toggleHighlighterMode = (enable: boolean) => {
  if (enable && !isHighlighterMode) {
    // Save current pencil settings
    savedPencilSettings = {
      strokeWidth: this.state.currentItemStrokeWidth,
      opacity: this.state.currentItemOpacity,
    };
    // Apply highlighter defaults
    this.setState({
      currentItemStrokeWidth: HIGHLIGHTER_DEFAULTS.strokeWidth,
      currentItemOpacity: HIGHLIGHTER_DEFAULTS.opacity,
    });
    isHighlighterMode = true;
  } else if (!enable && isHighlighterMode) {
    // Restore pencil settings
    if (savedPencilSettings) {
      this.setState({
        currentItemStrokeWidth: savedPencilSettings.strokeWidth,
        currentItemOpacity: savedPencilSettings.opacity,
      });
    }
    isHighlighterMode = false;
  }
};
```

- [ ] **Step 4: Add ToolPopover for freedraw/highlighter in Actions.tsx**

In `packages/excalidraw/components/Actions.tsx`, follow the exact pattern used for selection/lasso (`renderedSelectionPopover` ref, lines ~1254-1311). Add a similar ref and popover for freedraw:

```typescript
const renderedFreedrawPopover = useRef(false);
```

Reset it alongside `renderedSelectionPopover`:

```typescript
renderedFreedrawPopover.current = false;
```

In the shape rendering loop, when encountering `"freedraw"` in compact mode, render a ToolPopover with two options:

```typescript
if (value === "freedraw" && isCompactStylesPanel) {
  if (renderedFreedrawPopover.current) {
    return null;
  }
  renderedFreedrawPopover.current = true;

  const FREEDRAW_TOOLS = [
    { value: "freedraw", icon: FreedrawIcon, label: t("toolBar.freedraw") },
    {
      value: "highlighter",
      icon: HighlighterIcon,
      label: t("toolBar.highlighter"),
    },
  ];

  return (
    <ToolPopover
      key="freedraw-popover"
      app={app}
      options={FREEDRAW_TOOLS}
      activeTool={activeTool}
      defaultOption="freedraw"
      namePrefix="freedrawType"
      title={capitalizeString(t("toolBar.freedraw"))}
      data-testid="toolbar-freedraw"
      onToolChange={(type: string) => {
        if (type === "highlighter") {
          app.setActiveTool({ type: "freedraw" });
          app.toggleHighlighterMode(true);
        } else {
          app.setActiveTool({ type: "freedraw" });
          app.toggleHighlighterMode(false);
        }
      }}
    />
  );
}
```

- [ ] **Step 5: Add "highlighter" translation key**

In `packages/excalidraw/locales/ru-RU.json`, add to `"toolBar"` section:

```json
"highlighter": "Маркер"
```

In `packages/excalidraw/locales/en.json`, add to `"toolBar"` section:

```json
"highlighter": "Highlighter"
```

- [ ] **Step 6: Verify types and lint**

Run: `yarn test:typecheck && yarn fix` Expected: Both pass.

- [ ] **Step 7: Build**

Run: `cd packages/excalidraw && yarn build:esm` Expected: Build succeeds.

- [ ] **Step 8: Manual test**

1. Click freedraw tool → popup shows pencil and highlighter options
2. Select highlighter → draw on canvas → stroke is thick (12px) and semi-transparent (40%)
3. Switch back to pencil → previous stroke width and opacity restored
4. Verify pencil hotkey (P) still works
5. Verify repeated press of P toggles between pencil and highlighter
6. Verify highlighter uses current stroke color

- [ ] **Step 9: Commit**

```bash
git add packages/excalidraw/components/icons.tsx packages/excalidraw/components/shapes.tsx packages/excalidraw/components/Actions.tsx packages/excalidraw/components/App.tsx packages/excalidraw/locales/ru-RU.json packages/excalidraw/locales/en.json
git commit -m "feat: highlighter mode as freedraw preset with popup toggle"
```

---

### Task 6: Tooltips + Apple Pencil hover

**Files:**

- Modify: `packages/excalidraw/components/ToolButton.tsx:138,173` (replace `title=` with Tooltip)
- Modify: `packages/excalidraw/components/Actions.tsx` (wrap property buttons with Tooltip)
- Modify: `packages/excalidraw/components/LayerUI.tsx` (tooltips for menu items)
- Modify: `packages/excalidraw/components/ColorPicker/` (tooltips for color buttons)
- Modify: `packages/excalidraw/css/theme.scss` or relevant SCSS files (hover styles)

- [ ] **Step 1: Replace `title=` with `<Tooltip>` in ToolButton**

In `packages/excalidraw/components/ToolButton.tsx`, import Tooltip:

```typescript
import { Tooltip } from "./Tooltip";
```

At line ~138, the button renders with `title={props.title}`. Wrap the button's return in a Tooltip. Replace `title={props.title}` with nothing (remove `title` attribute), and wrap the `<button>` with:

```typescript
const buttonElement = (
  <button
  // ... existing props but WITHOUT title={props.title}
  >
    {/* existing children */}
  </button>
);

return props.title ? (
  <Tooltip label={props.title}>{buttonElement}</Tooltip>
) : (
  buttonElement
);
```

Apply the same pattern to the `<label>` variant at line ~173.

- [ ] **Step 2: Add hover styles for interactive buttons**

In the relevant SCSS files, add hover states. Find `packages/excalidraw/components/ToolIcon.scss` (or equivalent) and add:

```scss
.ToolIcon__icon {
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--button-hover-bg, rgba(0, 0, 0, 0.05));
  }
}
```

For compact action buttons in `packages/excalidraw/components/Actions.scss`:

```scss
.compact-action-button {
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--button-hover-bg, rgba(0, 0, 0, 0.05));
  }
}
```

Add the CSS variable to theme files for both light and dark themes:

```scss
// Light theme
--button-hover-bg: rgba(0, 0, 0, 0.06);

// Dark theme
--button-hover-bg: rgba(255, 255, 255, 0.08);
```

- [ ] **Step 3: Add tooltips to property action buttons in Actions.tsx**

In `packages/excalidraw/components/Actions.tsx`, wrap property buttons that lack tooltips. For each `renderAction("changeSomething")` call, the action's PanelComponent already renders with a `<legend>` or label — Tooltip wrapping happens at the ToolButton level (Step 1). For standalone buttons (duplicate, delete, group, lock), wrap with `<Tooltip>`:

```typescript
<Tooltip label={t("labels.duplicateSelection")}>
  <button onClick={...}>...</button>
</Tooltip>
```

Identify all buttons without tooltips and add them. Key areas:

- Layer actions (send to back/front)
- Group/ungroup buttons
- Delete button
- Lock button
- Alignment buttons

- [ ] **Step 3b: Add tooltips to LayerUI menu items**

In `packages/excalidraw/components/LayerUI.tsx`, wrap menu action buttons (grid toggle, preferences, etc.) with `<Tooltip>`. Follow existing pattern — import `Tooltip` and wrap interactive elements.

- [ ] **Step 3c: Add tooltips to ColorPicker buttons**

In `packages/excalidraw/components/ColorPicker/` directory, find color swatch buttons and wrap with `<Tooltip label={colorName}>`. Color names are already available via `t("colors.red")` etc.

- [ ] **Step 4: Verify types and lint**

Run: `yarn test:typecheck && yarn fix` Expected: Both pass.

- [ ] **Step 5: Build**

Run: `cd packages/excalidraw && yarn build:esm` Expected: Build succeeds.

- [ ] **Step 6: Manual test**

1. Hover over toolbar buttons → custom tooltip appears (not native browser title)
2. Hover over property buttons in compact popover → tooltip appears
3. Hover over action buttons (delete, duplicate, etc.) → tooltip appears
4. Verify hover effect — button background lightens on hover
5. Test with Chrome DevTools simulating touch/pen — verify tooltip appears on pointer enter
6. Verify tooltips disappear on pointer leave
7. Verify tooltips don't interfere with button click functionality

- [ ] **Step 7: Commit**

```bash
git add packages/excalidraw/components/ToolButton.tsx packages/excalidraw/components/Actions.tsx packages/excalidraw/components/LayerUI.tsx packages/excalidraw/components/ColorPicker/ packages/excalidraw/css/
git commit -m "feat: unified custom tooltips and hover effects for all buttons"
```

---

### Final: Version bump and build verification

- [ ] **Step 1: Bump version**

In `packages/excalidraw/package.json`, bump the patch version.

- [ ] **Step 2: Full verification**

```bash
yarn fix
yarn test:typecheck
cd packages/excalidraw && yarn build:esm
```

All three must pass with 0 warnings/errors.

- [ ] **Step 3: Final commit**

```bash
git add packages/excalidraw/package.json
git commit -m "chore: bump version for board polish release"
```
