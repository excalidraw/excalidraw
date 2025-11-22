# Move "Image to diagram" Feature Summary

## Objective
Move the "Image to diagram" button from the left hamburger menu to the right toolbar dropdown menu under the "Generate" section.

## Changes Made

### 1. Removed from Hamburger Menu
**Commit:** `f83165eb - refactor: remove 'Image to diagram' from hamburger menu`

**Files Changed:**
- `excalidraw-app/components/AppMainMenu.tsx`

**Changes:**
- Removed `ImageIcon` and `imageToMermaidDialogOpenAtom` imports
- Removed "Image to diagram" menu item
- Cleaned up unused imports

---

### 2. Added Tunnel Infrastructure
**Commit:** `215ababe - feat: add ImageToMermaidDialogTrigger with tunnel pattern`

**Files Changed:**
- `packages/excalidraw/components/ImageToMermaidDialogTrigger.tsx` (new file)
- `packages/excalidraw/context/tunnels.ts`
- `packages/excalidraw/index.tsx`

**Changes:**
- Created `ImageToMermaidDialogTrigger` component using tunnel pattern
- Added `ImageToMermaidDialogTriggerTunnel` to tunnels context
- Exported trigger from main index
- Trigger accepts `jotaiStore` prop for proper store connection
- Follows same pattern as `TTDDialogTrigger` for consistency

---

### 3. Added to Toolbar Dropdown
**Commit:** `7437859f - feat: add 'Image to diagram' to toolbar Generate section`

**Files Changed:**
- `packages/excalidraw/components/Actions.tsx`
- `packages/excalidraw/components/MobileToolBar.tsx`

**Changes:**
- Added `ImageToMermaidDialogTriggerTunnel.Out` to Actions.tsx
- Added `ImageToMermaidDialogTriggerTunnel.Out` to MobileToolBar.tsx
- Positioned after "Mermaid t
o Excalidraw" in Generate section
- Includes AI badge for consistency
- Works on both desktop and mobile toolbars

---

### 4. Connected Trigger to App Store
**Commit:** `6b3f24a7 - fix: connect ImageToMermaidDialogTrigger to appJotaiStore`

**Files Changed:**
- `excalidraw-app/App.tsx`

**Changes:**
- Imported `ImageToMermaidDialogTrigger` in App.tsx
- Rendered trigger component with `appJotaiStore` prop
- Ensures trigger and dialog use same Jotai store
- Fixes issue where dialog wasn't opening from toolbar button

---

### 5. Fixed Dialog Store Connection
**Commit:** `9620a13f - fix: ensure AI dialogs use app-level Jotai store`

**Files Changed:**
- `packages/excalidraw/components/ImageToMermaidDialog.tsx`
- `packages/excalidraw/components/AIConfigurationDialog.tsx`

**Changes:**
- `ImageToMermaidDialog` imports from `app-jotai`
- `AIConfigurationDialog` imports from `app-jotai`
- Both dialogs rendered at app level, must use `appJotaiStore`
- Fixes store mismatch between trigger and dialogs

---

## Technical Details

### The Jotai Store Challenge

The application has TWO separate Jotai stores:

1. **`appJotaiStore`** - Wraps the entire excalidraw-app
   - Used by: App-level components, dialogs rendered outside Excalidraw component
   
2. **`editorJotaiStore`** - Wraps the Excalidraw component internals
   - Used by: Components inside the Excalidraw component

### The Solution

The key insight was that:
- The **dialogs** (`ImageToMermaidDialog`, `AIConfigurationDialog`) are rendered at the **app level** (outside the Excalidraw component)
- The **trigger** is rendered **inside** the Excalidraw component via tunnels
- They need to communicate through the **same store**

**Solution:** Pass `appJotaiStore` as a prop to the trigger, so it sets atoms in the same store the dialogs are reading from.

### Tunnel Pattern

The tunnel pattern allows components to "teleport" their rendering to different parts of the component tree:

```
App.tsx
├── <ImageToMermaidDialogTrigger jotaiStore={appJotaiStore} />  ← Injects into tunnel
└── <Excalidraw>
    └── <Actions>
        └── <ImageToMermaidDialogTriggerTunnel.Out />  ← Renders here
```

---

## Testing Checklist

- [x] No TypeScript errors
- [x] "Image to diagram" removed from hamburger menu
- [x] "Image to diagram" appears in toolbar dropdown under "Generate"
- [x] Button appears on both desktop and mobile
- [x] Clicking button opens ImageToMermaidDialog
- [x] Dialog functionality works correctly
- [x] AI badge displays correctly

---

## Files Summary

### New Files
- `packages/excalidraw/components/ImageToMermaidDialogTrigger.tsx`

### Modified Files
- `excalidraw-app/components/AppMainMenu.tsx`
- `packages/excalidraw/context/tunnels.ts`
- `packages/excalidraw/index.tsx`
- `packages/excalidraw/components/Actions.tsx`
- `packages/excalidraw/components/MobileToolBar.tsx`
- `excalidraw-app/App.tsx`
- `packages/excalidraw/components/ImageToMermaidDialog.tsx`
- `packages/excalidraw/components/AIConfigurationDialog.tsx`

---

## Commits Ready to Push

```bash
f83165eb - refactor: remove 'Image to diagram' from hamburger menu
215ababe - feat: add ImageToMermaidDialogTrigger with tunnel pattern
7437859f - feat: add 'Image to diagram' to toolbar Generate section
6b3f24a7 - fix: connect ImageToMermaidDialogTrigger to appJotaiStore
9620a13f - fix: ensure AI dialogs use app-level Jotai store
```

All commits are clean, focused, and ready to push!
