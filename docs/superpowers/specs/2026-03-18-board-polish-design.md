# Board Polish — Design Spec

> Goal: polish the excalidraw whiteboard for recording exam walkthrough videos on sdamex.com. Six tasks in priority order.

## 1. [bug] Mobile 2D shape selection

**Problem:** After drawing a 2D poly-preset (triangle, pentagon, trapezoid, etc.) on mobile, no bounding box, resize handles, or rotation handle appear. Desktop works fine.

**Root cause:** `hasBoundingBox()` in `packages/element/src/transformHandles.ts:353` returns `false` for linear elements on mobile devices. 2D poly-presets are linear elements (they have a `points[]` array), so they get excluded.

**Fix:** Add an exception for poly-preset elements in `hasBoundingBox()`. If the element is a poly-preset type (`isPolyPresetType()`), return `true` regardless of device. Poly-presets are closed shapes, not lines.

**Files:**

- `packages/element/src/transformHandles.ts` — condition in `hasBoundingBox()`
- `packages/element/src/polyPresets.ts` — export type check if needed

## 2. Two-finger double-tap undo tolerance

**Problem:** Current implementation detects two-finger taps on `touchstart` when `event.touches.length === 2`. This works when both fingers are physically on the screen at the same time. The actual failure mode: when a user performs a quick "two-finger tap" where one finger lifts before the other touches (common natural gesture), `touches.length` never reaches 2 because both fingers are never simultaneously down. The `touchstart` with `length === 2` simply never fires, so the gesture is not recognized. This is not a bug — the detection logic is correct for its trigger — but the trigger is too narrow for natural use.

**Solution:** Move detection from `touchstart` to `touchend`:

1. On `touchstart` with `touches.length === 2` — record positions and timestamp
2. On `touchend` — when both fingers have lifted: if total touch duration < 300ms and neither finger moved > 15px → count as a "two-finger tap"
3. Two such taps within 500ms → undo
4. Single-finger touches are not affected — no buffer, no delay

**Additional:** Track two rapid single-finger taps happening near-simultaneously as an alternative pattern (finger 1 taps and lifts, finger 2 taps and lifts, both within ~150ms).

**Protection against false positives:**

- Check finger movement distance — if > 15px, it's a swipe/pinch, not a tap
- Cancel if pinch/scroll detected between taps

**Constants:**

- `TWO_FINGER_TAP_MAX_DURATION = 300` ms — max duration of a single two-finger tap
- `TWO_FINGER_TAP_MAX_DISTANCE = 15` px — max movement per finger
- `TWO_FINGER_DOUBLE_TAP_TIMEOUT = 500` ms — window between two taps

**Files:**

- `packages/excalidraw/components/App.tsx` — `onTouchStart`, `onTouchEnd`, new state variables
- `packages/common/src/constants.ts` — new constants

## 3. i18n — Russian translation completion + quality fixes

### Missing translations (23 keys)

**Cardinality arrows (7):**

- `labels.cardinality` → "Кардинальность"
- `labels.arrowhead_cardinality_one` → "Один"
- `labels.arrowhead_cardinality_many` → "Много"
- `labels.arrowhead_cardinality_one_or_many` → "Один или много"
- `labels.arrowhead_cardinality_exactly_one` → "Ровно один"
- `labels.arrowhead_cardinality_zero_or_one` → "Ноль или один"
- `labels.arrowhead_cardinality_zero_or_many` → "Ноль или много"

**Chart types (4):**

- `labels.chartType_bar` → "Столбчатая диаграмма"
- `labels.chartType_line` → "Линейная диаграмма"
- `labels.chartType_radar` → "Радарная диаграмма"
- `labels.chartType_plaintext` → "Обычный текст"

**Preferences/UI (4):**

- `labels.preferences` → "Настройки"
- `labels.preferences_toolLock` → "Фиксация инструмента"
- `labels.arrowBinding` → "Привязка стрелок"
- `labels.midpointSnapping` → "Привязка к середине"

**Progress dialog (2):**

- `progressDialog.title` → "Сохранение"
- `progressDialog.defaultMessage` → "Подготовка к сохранению..."

**AI/Mermaid (1):**

- `mermaid.autoFixAvailable` → "Доступно автоисправление"

**Welcome screen (3 empty):**

- `welcomeScreen.app.center_heading` → "Ваши рисунки сохраняются в хранилище браузера."
- `welcomeScreen.app.center_heading_line2` → "Хранилище браузера может быть очищено неожиданно."
- `welcomeScreen.app.center_heading_line3` → "Сохраняйте работу в файл, чтобы не потерять её."

**Chat (2 empty):**

- `chat.generating` → "Генерация..."
- `chat.errors.mermaidParseError` → "Ошибка синтаксиса Mermaid"

### Quality fixes (13 keys)

| Key | Current | Fix |
| --- | --- | --- |
| `toolBar.frame` | "Фреймовый инструмент" | "Рамка" |
| `toolBar.freedraw` | "Чертить" | "Карандаш" |
| `toolBar.magicframe` | "Каркас для кода" | "Магическая рамка" |
| `element.magicframe` | "Каркас для кода" | "Магическая рамка" |
| `lineEditor.edit` | "Редактирование строки" | "Редактировать линию" |
| `labels.sloppiness` | "Стиль обводки" | "Небрежность" |
| `arrowhead_crowfoot_many` | "Морщинки (много)" | "Вороньи лапки (много)" |
| `arrowhead_crowfoot_one` | "Морщинки (одна)" | "Вороньи лапки (одна)" |
| `arrowhead_crowfoot_one_or_many` | "Морщинки (одна или много)" | "Вороньи лапки (одна или много)" |
| `helpDialog.zoomToFit` | "Отмастштабировать..." | "Отмасштабировать..." |
| `alerts.uploadedSecurly` | "данные защищена" | "данные защищены" |
| `toolBar.convertElementType` | "Переключение типа формы" | "Сменить тип фигуры" |
| `labels.multiSelect` | "Добавить элемент в выделенный фрагмент" | "Добавить к выделению" |

**Files:**

- `packages/excalidraw/locales/ru-RU.json`

## 4. Stroke width slider

**Current:** 3 radio buttons (thin=1, bold=2, extraBold=4) via `RadioSelection` component.

**New:** Discrete range slider with squiggle preview.

**Spec:**

- 16 discrete steps: 1 through 16, step 1
- Squiggle wave preview above slider scales with current thickness
- Preview uses `currentItemStrokeColor` and `currentItemOpacity` from appState (not fixed values)
- No tick marks, no labels — clean slider only
- Replaces `RadioSelection` inside `actionChangeStrokeWidth` PanelComponent
- New `StrokeWidthRange` component (not parametric reuse of `Range` — opacity Range is hardcoded for 0-100/step 10 and has opacity-specific multi-element logic). New component shares only visual style (slider track, thumb CSS) via shared SCSS, but is otherwise independent.

**Layout in compact popover:**

- Fits within existing `CombinedStrokeProperties` popover (~13rem width)
- Squiggle box: ~48px height, wave with padding from edges (no clipping)
- Slider below, compact

**Files:**

- `packages/excalidraw/components/StrokeWidthRange.tsx` — new component (squiggle preview + discrete slider)
- `packages/excalidraw/components/StrokeWidthRange.scss` — styles (reuse slider track/thumb CSS vars from Range.scss)
- `packages/excalidraw/actions/actionProperties.tsx` — replace PanelComponent in `actionChangeStrokeWidth`
- `packages/common/src/constants.ts` — update `STROKE_WIDTH` constants if needed

## 5. Highlighter (freedraw preset)

**Approach:** Highlighter is a preset/mode of the freedraw tool, not a separate element type. Creates standard `ExcalidrawFreeDrawElement` with preset values.

**Preset defaults:**

- `strokeWidth`: 12
- `opacity`: 40%
- `strokeColor`: current color (unchanged)

**UI — popup toggle:**

- Same pattern as selection/lasso: clicking the freedraw toolbar button opens a popup with two choices: pencil and marker
- Icon: classic highlighter marker (chisel tip, rectangular body with diagonal stripes)
- Selected tool is remembered
- Hotkey: same key as freedraw (P/X), repeated press toggles between pencil and marker

**Behavior:**

- Activating highlighter sets `currentItemStrokeWidth=12`, `currentItemOpacity=40`
- User can modify values afterward — highlighter is just a quick preset
- Switching back to pencil restores previous pencil values (need to store them)
- On canvas, marker strokes render with lower opacity, appearing as semi-transparent highlight

**Files:**

- `packages/excalidraw/components/shapes.tsx` — add highlighter variant to freedraw shape definition
- `packages/excalidraw/components/App.tsx` — tool switching logic, store/restore pencil vs marker settings
- `packages/excalidraw/components/Actions.tsx` — popup rendering for freedraw (like selection/lasso)
- `packages/excalidraw/components/icons.tsx` — new highlighter marker icon SVG
- `packages/excalidraw/types.ts` — possibly extend ToolType or add a mode field

## 6. Tooltips + Apple Pencil hover

### Tooltip unification

- Replace all native `title=` attributes with the custom `<Tooltip>` component
- Add tooltips to elements that currently have none (property buttons, action buttons)

**Groups to cover:**

- Toolbar shape buttons (replace `title=` → `<Tooltip>`)
- Stroke/fill properties in compact popover
- Action buttons (duplicate, delete, group, lock, etc.)
- Color picker buttons
- Layer actions (send to back/front)

### Hover effect on buttons

- Add CSS `:hover` and `:focus-visible` styles to interactive button classes
- Background color change on hover (subtle, consistent with excalidraw theme)
- Target classes: `.ToolIcon__icon`, `.compact-action-button`, property buttons in popovers

### Apple Pencil hover

- Works out of the box — `pointerover`/`pointermove` events fire for stylus hover
- `<Tooltip>` component uses `onPointerEnter/onPointerLeave`, which covers both mouse and pen
- No Apple Pencil-specific code needed
- `pointerType: "pen"` detection already implemented in the codebase

**Files:**

- `packages/excalidraw/components/Actions.tsx` — wrap buttons with `<Tooltip>`
- `packages/excalidraw/components/ToolButton.tsx` — replace `title=` with `<Tooltip>`
- `packages/excalidraw/components/LayerUI.tsx` — tooltips for menu items
- `packages/excalidraw/css/theme.scss` or component-specific SCSS — hover styles
- `packages/excalidraw/components/ColorPicker/` — tooltips for color buttons
