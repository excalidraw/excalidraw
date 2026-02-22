# Module 06 — State Management

**Time:** 6-8 hours
**Goal:** Understand AppState, the action system, and undo/redo.

---

## Two Separate State Domains

Excalidraw splits state into two domains:

| Domain | What it holds | Where it lives |
|--------|--------------|----------------|
| **Elements** | Every object on the canvas | `Scene` class (array + maps) |
| **AppState** | Everything else (UI, tool, zoom, selection) | `App.state` (React class state) |

They're updated independently. An action can change elements, appState, or both.

---

## AppState

**File:** `packages/excalidraw/appState.ts`

AppState is a large flat object. The key fields by category:

### Active tool
```typescript
activeTool: {
  type: ToolType;            // "selection" | "rectangle" | "arrow" | ...
  locked: boolean;           // keep tool active after drawing?
  customType: string | null; // for custom tools
  lastActiveTool: ActiveTool | null;
}
```

### Selection
```typescript
selectedElementIds: Record<string, true>;  // map of selected IDs
selectedGroupIds: Record<string, true>;
editingGroupId: string | null;             // currently editing this group
```

**Why a Record, not an array?** Lookup is O(1). Checking "is element X selected?" is `selectedElementIds[x.id]` instead of `array.includes(x.id)`.

### Viewport
```typescript
scrollX: number;    // horizontal scroll offset
scrollY: number;    // vertical scroll offset
zoom: { value: number };  // 1.0 = 100%
width: number;      // canvas width in CSS pixels
height: number;     // canvas height in CSS pixels
```

### Editor state
```typescript
editingTextElement: ExcalidrawTextElement | null;  // text being edited
newElement: ExcalidrawElement | null;              // element being drawn
multiElement: ExcalidrawLinearElement | null;      // multi-point line/arrow in progress
resizingElement: ExcalidrawElement | null;
draggingElement: ExcalidrawElement | null;
```

### UI flags
```typescript
viewModeEnabled: boolean;      // read-only mode
zenModeEnabled: boolean;       // minimal UI
gridModeEnabled: boolean;      // show grid
showStats: boolean;
openDialog: { name: string } | null;
openSidebar: { name: string } | null;
```

### Styling defaults (for new elements)
```typescript
currentItemStrokeColor: string;
currentItemBackgroundColor: string;
currentItemFillStyle: FillStyle;
currentItemStrokeWidth: number;
currentItemStrokeStyle: StrokeStyle;
currentItemRoughness: number;
currentItemOpacity: number;
currentItemFontFamily: FontFamilyValues;
currentItemFontSize: number;
currentItemTextAlign: TextAlign;
currentItemRoundness: string;
```

When you draw a new rectangle, it inherits these values. When you change a property on a selected element, these values update too — so the next element you draw matches.

---

## The Action System

**Files:**
- `packages/excalidraw/actions/types.ts` — Action type definition
- `packages/excalidraw/actions/manager.tsx` — ActionManager class
- `packages/excalidraw/actions/*.tsx` — Individual actions (~30 files)

### What is an Action?

An action is a pure function that takes the current state and returns the next state:

```typescript
type Action = {
  name: string;
  label?: string;
  icon?: JSX.Element;
  keyTest?: (event: KeyboardEvent) => boolean;  // keyboard shortcut

  perform: (
    elements: ExcalidrawElement[],
    appState: AppState,
    formData: any,
    app: App,
  ) => {
    elements?: ExcalidrawElement[];
    appState?: Partial<AppState>;
    files?: BinaryFiles;
    captureUpdate: CaptureUpdateAction;  // undo tracking
  };

  predicate?: (elements, appState, app) => boolean;  // when is action available?
};
```

### Action examples

**actionDeleteSelected** (`actionDeleteSelected.tsx`):
```typescript
perform: (elements, appState) => {
  // Filter out selected elements (mark as deleted)
  // Clear selection
  return {
    elements: nextElements,
    appState: { selectedElementIds: {} },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
}
```

**actionToggleGridMode** (`actionCanvas.tsx`):
```typescript
perform: (elements, appState) => ({
  appState: { gridModeEnabled: !appState.gridModeEnabled },
  captureUpdate: CaptureUpdateAction.IMMEDIATELY,
})
```

### How actions are triggered

```typescript
// From a keyboard shortcut:
actionManager.handleKeyDown(event);
// ActionManager checks each action's keyTest() against the event

// From a UI button:
actionManager.executeAction(actionDeleteSelected, "ui");

// From code:
actionManager.executeAction(actionFinalize, "api", { event, sceneCoords });
```

### CaptureUpdateAction — Controlling Undo

The `captureUpdate` return field tells the history system what to do:

| Value | Meaning | Example |
|-------|---------|---------|
| `IMMEDIATELY` | Record this as an undo point now | User drew a shape, deleted an element |
| `EVENTUALLY` | Batch with the next IMMEDIATELY | Internal state adjustments |
| `NEVER` | Don't record | Remote collaboration updates |

---

## ActionManager

**File:** `packages/excalidraw/actions/manager.tsx`

The ActionManager:
1. Holds a registry of all actions
2. Routes keyboard events to matching actions
3. Executes actions and applies state updates
4. Provides `renderAction()` for toolbar buttons

```typescript
class ActionManager {
  actions: Record<string, Action>;

  registerAction(action: Action): void;

  handleKeyDown(event: KeyboardEvent): boolean;
  // Iterates all actions, checks keyTest(), executes first match

  executeAction(action: Action, source: string, value?: any): void;
  // Calls action.perform(), applies result to App state

  renderAction(name: string): JSX.Element;
  // Returns the UI widget for this action (button, toggle, etc.)
}
```

### Key actions to know

| Action | File | Shortcut | What it does |
|--------|------|----------|-------------|
| `actionCopy` | actionClipboard.tsx | Ctrl+C | Copy to clipboard |
| `actionPaste` | actionClipboard.tsx | Ctrl+V | Paste from clipboard |
| `actionDeleteSelected` | actionDeleteSelected.tsx | Delete/Backspace | Soft-delete selected |
| `actionUndo` | actionHistory.tsx | Ctrl+Z | Undo |
| `actionRedo` | actionHistory.tsx | Ctrl+Shift+Z | Redo |
| `actionGroup` | actionGroup.tsx | Ctrl+G | Group selected |
| `actionUngroup` | actionGroup.tsx | Ctrl+Shift+G | Ungroup |
| `actionFinalize` | actionFinalize.tsx | Escape/Enter | Finish drawing current element |
| `actionAlign*` | actionAlign.tsx | — | Align selected elements |
| `actionFlip*` | actionFlip.ts | — | Flip horizontally/vertically |
| `actionDuplicateSelection` | actionDuplicateSelection.tsx | Ctrl+D | Duplicate |

---

## Undo/Redo

**File:** `packages/excalidraw/history.ts`

### The model

Two stacks of deltas:

```
undoStack: [delta3, delta2, delta1]   ← most recent on top
redoStack: [delta4]
```

A delta records *what changed* between two states — not the full state. This keeps memory usage low.

### How it works

**When user performs an action (captureUpdate: IMMEDIATELY):**
1. Calculate delta between previous state and current state
2. Push delta onto `undoStack`
3. Clear `redoStack`

**When user presses Ctrl+Z (undo):**
1. Pop delta from `undoStack`
2. Apply inverse of delta to current state
3. Push the inverse onto `redoStack`

**When user presses Ctrl+Shift+Z (redo):**
1. Pop delta from `redoStack`
2. Apply it to current state
3. Push inverse onto `undoStack`

### What's in a delta?

```typescript
type HistoryDelta = {
  elements: ElementsDelta;   // which elements changed, old vs new values
  appState: AppStateDelta;   // which appState fields changed
};
```

### Important: What's NOT undoable

- Remote collaboration changes (`NEVER`)
- Zoom/scroll changes
- UI state (which dialog is open)

Only element mutations and select appState changes are tracked.

---

## Jotai Atoms in Practice

While `AppState` holds most state in `App.state`, some state lives in Jotai atoms:

```typescript
// Example: packages/excalidraw/components/Stats/stats.ts
export const statsAtom = atom<StatsState>({
  open: false,
  panels: {},
});
```

Atoms are used for state that:
- Is only needed by a few components (not the whole tree)
- Changes frequently (avoids re-rendering the entire App)
- Is UI-local (sidebar open/closed, tooltip visible, etc.)

The bulk of application state stays in `App.state` (AppState) because it needs to flow to the canvas renderer and action system, which don't use React hooks.

---

## State Flow Diagram

```
User clicks/types/drags
        │
        ▼
App.tsx event handler
(handleCanvasPointerDown, handleKeyDown, etc.)
        │
        ├──► Direct setState()         (simple state changes)
        │
        └──► actionManager.executeAction(action)
                    │
                    ▼
              action.perform(elements, appState)
                    │
                    ▼
              Returns { elements?, appState?, captureUpdate }
                    │
                    ├──► Apply to App.state / Scene
                    │
                    └──► captureUpdate === IMMEDIATELY?
                              │
                              ├── Yes → Push delta to undoStack
                              └── No  → Skip (or batch)
                    │
                    ▼
              React re-renders
              Canvas re-renders
```

---

## Exercises

1. Read `packages/excalidraw/appState.ts` — find the `getDefaultAppState()` function. Note every field and its default value.
2. Open `packages/excalidraw/actions/actionDeleteSelected.tsx`. Read the `perform` function. Trace what happens to elements and appState.
3. Open `packages/excalidraw/actions/actionHistory.tsx`. Find the undo action. Understand the relationship between `undoStack`, `redoStack`, and `captureUpdate`.
4. In the running app, draw 3 shapes. Undo twice. Redo once. In the console, try to access the history state via `h` to see the stacks.
5. Search for `captureUpdate: CaptureUpdateAction.IMMEDIATELY` in the actions folder. Count how many actions record undo points.
6. Search for `captureUpdate: CaptureUpdateAction.NEVER` — what kinds of state changes are NOT undoable?

---

**Next:** [Module 07 — Rendering Engine](07-rendering-engine.md)
