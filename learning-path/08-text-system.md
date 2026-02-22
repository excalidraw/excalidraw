# Module 08 — Text System

**Time:** 6-8 hours
**Goal:** Understand text measurement, wrapping, bound text, and the WYSIWYG editor.
**Key files:** `packages/element/src/textElement.ts`, `textWrapping.ts`, `textMeasurements.ts`

---

## Three Text Scenarios

| Scenario | How it's created | Constraints |
|----------|-----------------|-------------|
| **Standalone text** | Select text tool, click canvas | Auto-resizes width as you type |
| **Bound text** (in container) | Double-click a rectangle/diamond/ellipse | Width constrained by container, container height grows |
| **Arrow label** | Double-click an arrow | Fixed width (fraction of arrow length), positioned at midpoint |

All three use the same `ExcalidrawTextElement` type. The difference is whether `containerId` is set and what type of container it is.

---

## Text Measurement

**File:** `packages/element/src/textMeasurements.ts`

**The problem:** You need to know how many pixels wide "Hello World" is in 20px Virgil font. Browsers don't agree on exact measurements, and there's no sync API that's both fast and accurate.

**The solution:** Off-screen canvas measurement:

```typescript
const canvas = document.createElement("canvas");
const context = canvas.getContext("2d")!;

function measureText(text: string, font: string): { width: number; height: number } {
  context.font = font;  // e.g., "20px Virgil"
  const metrics = context.measureText(text);
  return {
    width: metrics.width,
    height: /* calculated from font size and line height */,
  };
}
```

**Key functions:**

| Function | What it does |
|----------|-------------|
| `measureText(text, font)` | Get pixel dimensions of text string |
| `getLineHeight(fontFamily, fontSize)` | Get line height for a font |
| `getFontString(element)` | Build CSS font string: `"20px Virgil"` |
| `getApproxMinLineWidth(font)` | Minimum width needed for one character |
| `getTextWidth(text, font)` | Width of a single line |

**Caching:** Font metrics are expensive, so results are cached. The container cache (`containerCache.ts`) stores pre-computed dimensions for bound text containers.

---

## Text Wrapping

**File:** `packages/element/src/textWrapping.ts`

**The problem:** Given text "Hello World this is a long sentence" and a max width of 100px, where do you break lines?

**The algorithm:**

```
wrapText(text, font, maxWidth):
  for each paragraph (split by \n):
    currentLine = ""
    for each word:
      testLine = currentLine + " " + word
      if measureText(testLine).width <= maxWidth:
        currentLine = testLine
      else:
        output currentLine
        currentLine = word
        if measureText(word).width > maxWidth:
          // Word itself is too wide — break it character by character
          binary search for break point within the word
    output currentLine
  return joined lines
```

**Edge cases handled:**
- **Long words:** Binary search to find character break point
- **CJK text:** Can break between any characters (no spaces)
- **Emoji:** Multi-byte characters (e.g., `👨‍👩‍👧` is multiple code points)
- **RTL text:** Right-to-left languages (Arabic, Hebrew)
- **Zero-width characters:** Invisible characters that affect measurement

**Binary search for line breaks:**

When a single word is wider than `maxWidth`, the code binary-searches for the character index where the word exceeds the width:

```typescript
// Pseudocode:
low = 0;
high = word.length;
while (low < high) {
  mid = (low + high) / 2;
  if (measureText(word.slice(0, mid)).width > maxWidth) {
    high = mid;
  } else {
    low = mid + 1;
  }
}
// Break word at index `low`
```

---

## Bound Text (Text in Containers)

**File:** `packages/element/src/textElement.ts`

When text is inside a rectangle/diamond/ellipse:

### Relationship

```
Rectangle (container)                    Text (bound element)
├── boundElements: [{                   ├── containerId: "rect-id"
│     type: "text",                     ├── width: container.width - padding
│     id: "text-id"                     ├── autoResize: true
│   }]                                  └── text: (wrapped to fit)
├── width: 200
└── height: auto-grows to fit text
```

### How it works

1. **User double-clicks rectangle** → creates a text element with `containerId` set
2. **Text is wrapped** to `container.width - 2 * BOUND_TEXT_PADDING`
3. **Container height adjusts** to fit the wrapped text
4. **Text is centered** (vertically and horizontally based on alignment settings)

### Key functions

| Function | What it does |
|----------|-------------|
| `getBoundTextElement(container)` | Find the text element inside a container |
| `getContainerElement(textElement)` | Find the container of a bound text |
| `computeContainerDimensionForBoundText(container, text)` | Calculate container height to fit text |
| `computeBoundTextPosition(container, text)` | Get (x, y) position for the text |
| `handleBindTextResize(container)` | Re-wrap and reposition text after container resize |

### Container resize flow

```
User resizes rectangle
  → handleBindTextResize(rectangle)
    → get maxWidth = rectangle.width - padding
    → wrapText(text, font, maxWidth)
    → measure wrapped text height
    → if height > rectangle.height:
        mutateElement(rectangle, { height: newHeight })
    → position text centered in container
```

---

## Arrow Labels

Arrow labels work similarly to bound text but with unique positioning:

```typescript
// Arrow label width is a fraction of arrow length:
labelWidth = ARROW_LABEL_WIDTH_FRACTION * arrowLength;

// Position at arrow midpoint:
midPoint = curvePointAtParameter(arrowCurve, 0.5);
textElement.x = midPoint.x - labelWidth / 2;
textElement.y = midPoint.y - textHeight / 2;
```

When the arrow moves, the label repositions. When the label is too wide, it wraps within the calculated width.

Arrow labels are rendered to a **separate offscreen canvas** and composited onto the main canvas. This prevents the text from being visible outside the arrow's visual bounds.

---

## WYSIWYG Text Editor

**Directory:** `packages/excalidraw/wysiwyg/`

When you double-click a text element (or a container), a real DOM `<textarea>` is created and positioned exactly over the canvas text:

```
Canvas (text rendered as pixels)
  ↓ user double-clicks
DOM <textarea> appears on top of canvas
  ↓ user types
Canvas text hidden, textarea shows live edits
  ↓ user clicks away or presses Escape
<textarea> removed, text element updated, canvas re-renders
```

### How the textarea is positioned

```typescript
// Get element's screen position:
const { x, y } = sceneCoordsToViewportCoords(element.x, element.y);

// Create textarea at that position:
textarea.style.position = "fixed";
textarea.style.left = `${x}px`;
textarea.style.top = `${y}px`;
textarea.style.width = `${element.width}px`;
textarea.style.font = getFontString(element);
textarea.style.color = element.strokeColor;
textarea.style.transform = `rotate(${element.angle}rad)`;
```

### On finish editing

```typescript
// Update element with new text:
mutateElement(textElement, {
  text: wrappedText,
  originalText: rawText,
  width: measuredWidth,
  height: measuredHeight,
});

// If bound to container, resize container:
if (containerId) {
  handleBindTextResize(container);
}

// Remove textarea:
textarea.remove();

// Clear editing state:
setState({ editingTextElement: null });
```

---

## Font System

**Directory:** `packages/excalidraw/fonts/`

Excalidraw ships 13 font families. The primary ones:

| Font | Style | Used for |
|------|-------|----------|
| Excalifont | Hand-drawn | Default font |
| Virgil | Hand-drawn | Legacy default |
| Cascadia | Monospace | Code-like text |
| Comic Shanns | Comic | Casual text |
| Liberation Sans | Clean | Professional text |

Fonts are loaded as WOFF2 files. The `subset/` directory contains HarfBuzz WASM for font subsetting — when exporting, only the glyphs actually used are included to reduce file size.

---

## Exercises

1. Read `textMeasurements.ts` — find `measureText()`. Understand how it uses the canvas context.
2. Read `textWrapping.ts` — `wrapText()`. Trace through the line-breaking logic with a simple example: "Hello World Test" at 60px max width.
3. Read `textElement.ts` — find `getBoundTextElement()` and `handleBindTextResize()`. Trace the resize flow.
4. In the running app: create a rectangle, double-click it, type a long sentence. Watch the rectangle grow vertically. Inspect both elements in the console.
5. In the running app: create an arrow, double-click it to add a label. Resize the arrow — watch the label reposition.
6. Open `packages/excalidraw/wysiwyg/` — find where the `<textarea>` is created and positioned. Note the coordinate transform from scene to viewport.

---

**Next:** [Module 09 — Binding & Arrows](09-binding-and-arrows.md)
