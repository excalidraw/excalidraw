# AI Features Integration - Design

## Overview

This design integrates AI-powered features into Excalidraw's hamburger menu, ensuring proper state management through Jotai and correct dialog rendering with provider context.

## Architecture

### Component Hierarchy

```
App.tsx
├── EditorJotaiProvider (wraps AI dialogs)
│   ├── AIConfigurationDialog
│   └── ImageToMermaidDialog
└── AppMainMenu.tsx
    └── AI Menu Items (Configure AI, Image to diagram)
```

### State Management

- **Jotai Atoms**: Defined in `app-jotai.ts` for app-level state
- **Editor Atoms**: Defined in `editor-jotai.ts` for editor-specific state
- **Provider Context**: EditorJotaiProvider wraps dialogs to provide atom access

## Components and Interfaces

### AppMainMenu.tsx

**Purpose**: Render hamburger menu with AI feature menu items

**Key Changes**:
- Add "Configure AI" menu item with settings icon
- Add "Image to diagram" menu item with image icon
- Position below existing "Wireframe to code" button
- Wire up click handlers to open respective dialogs

### App.tsx

**Purpose**: Main application component that renders dialogs and provides context

**Key Changes**:
- Import AI dialog components
- Import EditorJotaiProvider
- Wrap AI dialogs in EditorJotaiProvider
- Preserve existing AIComponents rendering

### Jotai Store Files

**app-jotai.ts**: App-level atoms for dialog open/close state
**editor-jotai.ts**: Editor-level atoms if needed for AI features

## Data Models

### Dialog State Atoms

```typescript
// In app-jotai.ts
export const isAIConfigDialogOpenAtom = atom(false);
export const isImageToMermaidDialogOpenAtom = atom(false);
```

## Error Handling

### Provider Context Errors
- **Issue**: "Missing Provider" errors when dialogs use Jotai atoms
- **Solution**: Wrap dialogs in EditorJotaiProvider

### Import Ordering
- **Issue**: ESLint import/order warnings
- **Solution**: Follow project import ordering rules (external → internal → relative)

## Testing Strategy

### Manual Testing
1. Open hamburger menu and verify AI menu items appear
2. Click "Configure AI" and verify dialog opens without errors
3. Click "Image to diagram" and verify dialog opens without errors
4. Verify "Wireframe to code" still works
5. Test keyboard shortcuts if implemented
6. Verify no console errors or warnings

### Build Verification
1. Run `yarn build` to ensure no TypeScript errors
2. Run `yarn test:code` to ensure no ESLint errors
3. Verify development server runs without errors
