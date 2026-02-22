# Module 05 — Element System

**Time:** 6-8 hours
**Goal:** Understand the data model for everything on the canvas — types, creation, mutation, and versioning.
**Package:** `packages/element/src/`

---

## The Core Idea

Every object on the Excalidraw canvas — rectangles, arrows, text, images — is an `ExcalidrawElement`. It's a plain JavaScript object (not a class instance, not a DOM node). The element describes *what* to draw; the renderer (Module 07) decides *how* to draw it.

---

## Element Types

**File:** `packages/element/src/types.ts`

`ExcalidrawElement` is a union type:

```typescript
type ExcalidrawElement =
  | ExcalidrawGenericElement      // rectangle, diamond, ellipse
  | ExcalidrawTextElement         // text
  | ExcalidrawLinearElement       // arrow, line
  | ExcalidrawFreeDrawElement     // freedraw
  | ExcalidrawImageElement        // image
  | ExcalidrawFrameElement        // frame
  | ExcalidrawMagicFrameElement   // magic frame (AI)
  | ExcalidrawIFrameElement       // iframe
  | ExcalidrawEmbeddableElement   // embeddable
  | ExcalidrawSelectionElement;   // temporary selection box
```

### Common fields (every element has these)

```typescript
{
  // Identity
  id: string;                    // random UUID
  type: string;                  // "rectangle", "arrow", etc.
  isDeleted: boolean;            // soft-delete (not removed from array)

  // Geometry
  x: number;                     // top-left X in scene coordinates
  y: number;                     // top-left Y
  width: number;
  height: number;
  angle: number;                 // rotation in radians (0 = no rotation)

  // Styling
  strokeColor: string;           // e.g., "#000000"
  backgroundColor: string;       // e.g., "transparent"
  fillStyle: FillStyle;          // "hachure" | "cross-hatch" | "solid" | "zigzag"
  strokeWidth: number;           // 1, 2, or 4
  strokeStyle: StrokeStyle;      // "solid" | "dashed" | "dotted"
  roughness: number;             // 0 = architect, 1 = artist, 2 = cartoonist
  roundness: null | Roundness;   // corner rounding
  opacity: number;               // 0-100

  // Collaboration
  version: number;               // incremented on every mutation
  versionNonce: number;          // random, for tie-breaking
  index: FractionalIndex;        // z-order string (e.g., "a0", "a0g")
  updated: number;               // epoch timestamp

  // Relationships
  groupIds: readonly string[];   // group membership (can be nested)
  frameId: string | null;        // parent frame
  boundElements: BoundElement[] | null;  // arrows/text bound to this element

  // Other
  locked: boolean;
  link: string | null;
  seed: number;                  // random seed for RoughJS deterministic rendering
}
```

### Type-specific fields

**Linear elements (arrows, lines):**
```typescript
{
  points: readonly LocalPoint[];    // control points relative to (x, y)
  startBinding: PointBinding | null; // what the start is attached to
  endBinding: PointBinding | null;   // what the end is attached to
  startArrowhead: Arrowhead | null;  // "arrow" | "bar" | "dot" | "triangle" | null
  endArrowhead: Arrowhead | null;
  elbowed: boolean;                  // orthogonal routing
}
```

**Text elements:**
```typescript
{
  text: string;                      // the actual text content
  fontSize: number;
  fontFamily: FontFamilyValues;
  textAlign: TextAlign;              // "left" | "center" | "right"
  verticalAlign: VerticalAlign;      // "top" | "middle" | "bottom"
  containerId: string | null;        // parent container element ID
  originalText: string;              // text before wrapping
  autoResize: boolean;
  lineHeight: number;
}
```

**Image elements:**
```typescript
{
  fileId: FileId | null;             // reference to binary file data
  status: "pending" | "saved" | "error";
  scale: [number, number];
  crop: Crop | null;                 // crop region
}
```

**Freedraw elements:**
```typescript
{
  points: readonly LocalPoint[];     // raw drawing points
  pressures: readonly number[];      // pen pressure per point
  simulatePressure: boolean;
}
```

---

## Type Guards

**File:** `packages/element/src/typeChecks.ts`

TypeScript union types need narrowing. The codebase provides type guards:

```typescript
// Check element type:
isLinearElement(el)       // arrow or line
isTextElement(el)         // text
isImageElement(el)        // image
isFreeDrawElement(el)     // freedraw
isFrameElement(el)        // frame or magic frame

// Check capabilities:
isBindableElement(el)     // can arrows bind to it?
isTextBindableContainer(el) // can text be placed inside?
hasBoundTextElement(el)   // does it have text inside?
```

**Usage pattern:**
```typescript
if (isLinearElement(element)) {
  // TypeScript now knows element has .points, .startBinding, etc.
  element.points.forEach(p => ...);
}
```

---

## Element Creation

**File:** `packages/element/src/newElement.ts`

Elements are created by factory functions, not constructors:

```typescript
// Generic shapes:
const rect = newElement({
  type: "rectangle",
  x: 100,
  y: 100,
  strokeColor: "#000000",
  backgroundColor: "transparent",
  // ... all styling props
});

// Text:
const text = newTextElement({
  text: "Hello",
  fontSize: 20,
  fontFamily: FONT_FAMILY.Virgil,
  x: 50,
  y: 50,
  // ...
});

// Linear (arrows, lines):
const arrow = newLinearElement({
  type: "arrow",
  points: [pointFrom(0, 0), pointFrom(100, 50)],
  // ...
});
```

All factory functions call `_newElementBase()` which assigns:
- `id` via `randomId()`
- `version: 1`
- `versionNonce: 0`
- `seed` via `randomInteger()` (for RoughJS)
- `isDeleted: false`
- `updated` via `getUpdatedTimestamp()`

---

## Element Mutation

**File:** `packages/element/src/mutateElement.ts`

**The rule:** Never assign to element properties directly.

```typescript
// WRONG — breaks history, collaboration, caching:
element.x = 200;

// RIGHT — tracks the change:
scene.mutateElement(element, { x: 200 });
```

### What mutateElement does

1. Copies the update properties onto the element object
2. Increments `element.version`
3. Regenerates `element.versionNonce` (random)
4. Updates `element.updated` timestamp
5. Optionally triggers a scene update (re-render)

### Why?

Three systems depend on knowing when elements change:

| System | Uses |
|--------|------|
| **Rendering** | Invalidates cached canvas when version changes |
| **Collaboration** | Compares versions to resolve conflicts |
| **History** | Records old state for undo |

If you directly assign `element.x = 200`, none of these systems know anything changed.

### newElementWith — Immutable copy

```typescript
const updated = newElementWith(element, { x: 200 });
// Returns a NEW object with the change. Original is untouched.
```

Used when you need to create a modified copy (for export, undo snapshots). `mutateElement` modifies in-place (for live editing where copying every frame would be expensive).

---

## Versioning for Collaboration

Every element carries two version fields:

```typescript
{
  version: 42,           // sequential counter, incremented on every mutation
  versionNonce: 1847362, // random number, regenerated on every mutation
}
```

When two users edit the same element simultaneously:

```
User A: version=5, versionNonce=100
User B: version=5, versionNonce=200

Conflict resolution:
  if (A.version > B.version) → keep A
  if (A.version === B.version) → lower nonce wins → keep A (100 < 200)
```

This creates a **total ordering** without a central server. Every conflict resolves deterministically — both users arrive at the same result independently.

See Module 10 for the full collaboration system.

---

## Soft Deletion

Elements are never removed from the array. Instead:

```typescript
scene.mutateElement(element, { isDeleted: true });
```

**Why not splice from the array?**
- Undo needs to restore deleted elements
- Collaboration needs to propagate deletions
- Other elements may reference the deleted element's ID (bindings)

The renderer filters out deleted elements: `elements.filter(el => !el.isDeleted)`.

---

## The Scene Container

**File:** `packages/element/src/Scene.ts`

`Scene` manages the element array and provides efficient lookups:

```typescript
class Scene {
  // The source of truth:
  private elements: ExcalidrawElement[];

  // Derived indexes (kept in sync):
  private elementsMap: Map<string, ExcalidrawElement>;       // by ID
  private nonDeletedElements: NonDeletedExcalidrawElement[]; // filtered

  // Mutation:
  insertElement(element);
  mutateElement(element, updates);
  replaceAllElements(newElements);

  // Queries:
  getElement(id): ExcalidrawElement | undefined;
  getNonDeletedElements(): NonDeletedExcalidrawElement[];
  getElementsMap(): Map<string, ExcalidrawElement>;
}
```

**Key insight:** `replaceAllElements()` rebuilds all derived maps. This is called on major state changes (load, undo, remote sync). Individual mutations use `mutateElement()` which is cheaper.

---

## Z-Ordering

Elements are drawn in array order — later elements appear on top. The `index` field (a fractional index string) determines order:

```
elements[0].index = "a0"   ← drawn first (bottom)
elements[1].index = "a1"
elements[2].index = "a2"   ← drawn last (top)
```

To move an element between two others without reindexing everything:

```
generateNKeysBetween("a0", "a1", 1)  →  ["a0V"]

// Result:
elements[0].index = "a0"
elements[1].index = "a0V"   ← inserted here
elements[2].index = "a1"
elements[3].index = "a2"
```

This is critical for collaboration — you can't use array indices because inserting at position 2 would renumber everything after it, causing phantom version bumps across all users.

More details in [Module 10 — Collaboration](10-collaboration.md).

---

## Bound Elements

Elements can reference each other through `boundElements`:

```typescript
// A rectangle with a text label and an arrow attached:
rectangle.boundElements = [
  { type: "text", id: "text-123" },
  { type: "arrow", id: "arrow-456" },
];

// The text element points back:
textElement.containerId = rectangle.id;

// The arrow element points back:
arrow.startBinding = { elementId: rectangle.id, focus: 0, gap: 5 };
```

**Bidirectional references:** Both sides maintain a reference. When you delete a rectangle, the code must also update any bound arrows and text. This bookkeeping is in `binding.ts` and `textElement.ts`.

---

## Exercises

1. Read `types.ts` — find `ExcalidrawElementBase` (the common fields). Write down every field and what you think it does.
2. Read `newElement.ts` — trace what `_newElementBase()` does step by step.
3. Read `mutateElement.ts` — understand why it bumps `version` and `versionNonce`.
4. In the running app, draw a rectangle, then double-click it to add text. In the console, find both elements and examine their `boundElements` and `containerId` fields.
5. Read `typeChecks.ts` — pick 3 type guards and search for where they're used in the codebase.
6. Draw 3 overlapping rectangles. In the console, check their `index` values. Reorder them with "Send to Back" and check again.

---

**Next:** [Module 06 — State Management](06-state-management.md)
