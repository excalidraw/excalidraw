# Optimizing Interactions in Complex Layouts

Maintain high frame rates (60FPS) and eliminate interaction latency during drag-and-drop or heavy mutations in complex, multi-column layouts like Kanban boards or massive data grids.

## Overview

In complex layouts, performing a minor change to a single item—such as dragging a card or editing a cell—can trigger a chain reaction of style and layout calculations that forces the browser to reflow the entire page. This results in dropped frames and high Interaction to Next Paint (INP) latency.

By applying `content-visibility: auto` to self-contained layout regions (like columns in a Kanban board), you can isolate rendering work.

### Mechanism for On-Screen Elements

It is important to understand how `content-visibility: auto` benefits elements that are **already visible on the screen**:

*   For visible elements, the browser **does not** skip rendering.
*   Instead, the performance benefit comes entirely from the **CSS containments** that the property automatically enforces (i.e., layout, style, and paint).
*   This containment acts as a boundary. If a mutation occurs inside a container with containment applied, the browser knows that the changes cannot affect the geometry or styles of elements outside that container. The page reflow is isolated, preventing a global layout recalculation.

## Implementation

### 1. Identify Containment Regions

Apply `content-visibility: auto` to large, self-contained containers that represent isolated layout units (e.g., grid columns, board lists).

```css
.board-column {
  /* Apply containment boundaries */
  content-visibility: auto;
  
  /* Mandatory: Provide a placeholder size to prevent layouts shifts.
     For a vertical column, define a reasonable width and height. 
     - 'auto' is optional and enables the browser to remember the actual size
       once rendered. It must be paired with a <length> value to be used for
       the first render.
     - '300px' is the estimated width of this element. This can be any valid
      CSS <length> value. Replace it with the expected width of your
      component.
     - '800px' is the estimated height of this element. This can be any valid
      CSS <length> value. Replace it with the expected height of your
      component.
   */
  contain-intrinsic-size: auto 300px auto 800px;
}
```

### 2. Manage Interactions

Ensure that interactions occurring inside the column benefit from the containment.

```javascript
// Example: Drag and drop item movement
function moveItemToColumn(itemId, columnId) {
  const item = document.getElementById(itemId);
  const column = document.getElementById(columnId);
  
  // The browser will only reflow this specific column, 
  // not the entire board layout!
  column.appendChild(item);
}
```

### Fallback strategies

Baseline status for content-visibility: Newly available. It's been Baseline since 2025-09-15.
Supported by: Chrome 108 (Nov 2022), Edge 108 (Dec 2022), Firefox 130 (Sep 2024), and Safari 26 (Sep 2025).

The property degrades gracefully. In unsupported browsers:
*   The property is ignored, and mutations will cause the standard global reflow.
*   To achieve a similar isolation effect in older browsers, you can fall back to applying containment manually:

```css
@supports not (content-visibility: auto) {
  .board-column {
    /* Manual fallback for containment */
    contain: layout style paint;
  }
}
```
