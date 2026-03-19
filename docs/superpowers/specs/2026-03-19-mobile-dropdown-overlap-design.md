# Mobile Dropdown Overlap Fix

**Date:** 2026-03-19
**Status:** Approved

## Problem

On mobile (phone formFactor), toolbar dropdowns are invisible because they render behind `MobileShapeActions`:

1. **Toolbar dropdowns overlapped** — ToolPopover (shapes, selection, freedraw/highlighter, linear) and DropdownMenu (extra tools) render inline (no portal) inside `App-bottom-bar` with `z-index: 4`. `MobileShapeActions` sits above them with `z-index: 999` (Actions.scss:191). All toolbar dropdowns that open upward are fully hidden.

2. **PropertiesPopover mispositioned** — Stroke settings popup (CombinedShapeProperties) uses `side="bottom"` on mobile portrait (PropertiesPopover.tsx:52). The trigger is in `MobileShapeActions` near the screen bottom — there's no room below. Radix collision detection produces a tiny artifact instead of the full popup.

## Solution

### Bug 1: Hide MobileShapeActions when toolbar dropdown is open (Approach B)

**Mechanism:** CSS-only via `:has()` selector.

When any Radix popover/dropdown trigger inside `.App-toolbar` has `data-state="open"`, hide `.mobile-shape-actions`:

```css
.App-bottom-bar:has(.App-toolbar [data-state="open"]) > .mobile-shape-actions {
  visibility: hidden;
}
```

- `visibility: hidden` preserves layout (no jump), unlike `display: none`
- Zero JS/React changes — pure CSS
- `:has()` browser support: Safari 15.4+ (Mar 2022), Chrome 105+ (Aug 2022) — sufficient for target audience

Additionally, raise toolbar dropdown z-index above the current value of 4 to ensure proper layering.

### Bug 2: Fix PropertiesPopover direction on mobile portrait

Change `side` from `"bottom"` to `"top"` for mobile portrait in `PropertiesPopover.tsx`:

```tsx
// Before
side={isMobilePortrait ? "bottom" : "right"}

// After
side={isMobilePortrait ? "top" : "right"}
```

This opens the popup upward from the trigger, where there is ample space.

## Files to Modify

| File | Change |
|------|--------|
| `packages/excalidraw/components/Actions.scss` | Add `:has()` rule to hide `.mobile-shape-actions` when toolbar dropdown open |
| `packages/excalidraw/components/ToolPopover.scss` | Raise z-index for `.tool-popover-content` on mobile |
| `packages/excalidraw/components/MobileToolBar.scss` | Raise z-index for extra tools dropdown on mobile |
| `packages/excalidraw/components/PropertiesPopover.tsx` | Change `side` to `"top"` on mobile portrait |

## Testing

- On mobile (or DevTools phone emulation):
  - Open shape presets dropdown → should be fully visible, MobileShapeActions hidden
  - Open freedraw/highlighter dropdown → same
  - Open extra tools dropdown → same
  - Close any dropdown → MobileShapeActions reappears
  - Tap stroke settings in MobileShapeActions → popup opens upward with slider, opacity
