# ChatCanvas UI Design Document

## 1. Overview

The goal is to implement a "Lovart-inspired" UI Shell for Excalidraw, featuring a three-column layout:

- **Left**: Vertical Toolbar + Assets/Templates (Collapsible)
- **Center**: Infinite Canvas (Excalidraw)
- **Right**: Chat Panel (Collapsible/Resizable)

## 2. Component Architecture

We will introduce a `ChatCanvasShell` component in `excalidraw-app/components/ChatCanvas`.

### New Components:

- `ChatCanvasShell.tsx`: Main layout container.
- `ChatPanel.tsx`: Right-side chat interface.
- `SidebarDrawer.tsx`: Left-side assets/templates drawer.
- `TopBar.tsx`: Lightweight top navigation.

### State Management:

- Use existing Jotai atoms where possible.
- Introduce new atoms for:
  - `chatMessagesAtom`: Store chat history.
  - `isChatPanelOpenAtom`: Toggle chat panel.
  - `isSidebarOpenAtom`: Toggle left sidebar.
  - `selectionContextAtom`: Derived atom to track selected elements.

## 3. File Modification Plan

- `excalidraw-app/App.tsx`: Modify to support `?ui=chatcanvas` flag and wrap with `ChatCanvasShell`.
- `excalidraw-app/components/ChatCanvas/`: New directory for all ChatCanvas related components.
- `excalidraw-app/index.scss`: Add styles for the new shell.

## 4. Integration Points

- **Selection Context**: Use `excalidrawAPI.getAppState().selectedElementIds` to track selection.
- **Canvas Interaction**: Use `excalidrawAPI.updateScene` to apply AI-generated changes.
- **Mock Agent**: A local service to simulate AI responses.

## 5. Visual Style

- Modern, clean, tool-oriented.
- Rounded corners, light shadows.
- Maintain Excalidraw's hand-drawn aesthetic for the canvas elements.
