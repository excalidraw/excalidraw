# ChatCanvas UI

A Lovart-inspired UI Shell for Excalidraw that combines infinite canvas drawing with real-time chat interaction and AI-powered canvas manipulation.

## Features

### 1. Three-Column Layout

- **Left Sidebar**: Assets and templates drawer (collapsible)
- **Center**: Infinite Excalidraw canvas (unchanged core functionality)
- **Right Panel**: Chat interface for user-AI interaction (collapsible and resizable)
- **Top Bar**: Lightweight navigation with export and settings

### 2. Chat Interface

- Real-time message history
- Selection context indicator showing how many elements are selected
- Support for multi-line input (Shift+Enter for new line, Enter to send)
- Loading states and error handling
- Message timestamps and context references

### 3. Selection → Chat Context Bridge

- Automatically tracks selected elements on the canvas
- Displays selection count in the chat panel
- Sends element details to the agent for context-aware responses
- Supports element properties: ID, type, text, position, colors, styles, etc.

### 4. Mock AI Agent

The mock agent supports the following operations:

#### Color Changes

- Recognizes color keywords: red, blue, green, yellow, purple, orange
- Example: "Make it red" → Changes stroke and background color

#### Alignment

- Recognizes: "align", "center"
- Example: "Center align" → Centers text alignment

#### Styling

- Recognizes: "bold", "thicker"
- Example: "Make it bold" → Increases stroke width

#### Duplication

- Recognizes: "duplicate", "copy"
- Example: "Duplicate this" → Creates copies of selected elements

#### Add Notes

- Recognizes: "add note", "add text"
- Example: "Add note: Important" → Adds a yellow note to the canvas

### 5. Template Library

Built-in templates available in the left sidebar:

- **Wireframe**: Basic UI wireframe layout
- **Flowchart**: Process flowchart with shapes
- **Mindmap**: Mind mapping structure

Templates can be loaded with a single click and elements are automatically added to the canvas.

## Usage

### Enabling ChatCanvas UI

Add the query parameter `?ui=chatcanvas` to the URL:

```
http://localhost:3000/?ui=chatcanvas
```

### Component Structure

```
ChatCanvasShell (Main container)
├── TopBar (Navigation)
├── SidebarDrawer (Left - Assets/Templates)
├── Canvas (Center - Excalidraw)
└── ChatPanel (Right - Chat interface)
```

### State Management

All state is managed using Jotai atoms in `atoms.ts`:

- `chatMessagesAtom`: Chat message history
- `isChatPanelOpenAtom`: Chat panel visibility
- `isSidebarOpenAtom`: Sidebar visibility
- `chatPanelWidthAtom`: Right panel width
- `sidebarWidthAtom`: Left sidebar width
- `selectionContextAtom`: Current selection information
- `isAgentLoadingAtom`: Agent loading state
- `agentErrorAtom`: Agent error messages

### Hooks

#### `useSelectionContext(excalidrawAPI)`

Tracks selected elements and updates the selection context atom.

#### `useAgentResponse(excalidrawAPI)`

Handles agent responses and applies canvas operations.

#### `useTemplateLoader(excalidrawAPI)`

Loads templates and adds them to the canvas.

## File Structure

```
components/ChatCanvas/
├── atoms.ts                          # Jotai state management
├── ChatCanvasShell.tsx               # Main container component
├── ChatCanvasShell.scss              # Shell styles
├── TopBar.tsx                        # Top navigation
├── TopBar.scss                       # Top bar styles
├── ChatPanel.tsx                     # Chat interface
├── ChatPanel.scss                    # Chat panel styles
├── SidebarDrawer.tsx                 # Left sidebar
├── SidebarDrawer.scss                # Sidebar styles
├── ExcalidrawChatCanvasWrapper.tsx   # Integration wrapper
├── useSelectionContext.ts            # Selection tracking hook
├── useAgentResponse.ts               # Agent response handler
├── useTemplateLoader.ts              # Template loading hook
├── mockAgent.ts                      # Mock AI agent
├── templates.ts                      # Template definitions
├── index.ts                          # Exports
└── README.md                         # This file
```

## Integration with App.tsx

To enable ChatCanvas UI, modify `excalidraw-app/App.tsx`:

```tsx
import {
  ChatCanvasShell,
  ExcalidrawChatCanvasWrapper,
} from "./components/ChatCanvas";

// In the ExcalidrawWrapper component:
const isChatCanvasMode =
  new URLSearchParams(window.location.search).get("ui") === "chatcanvas";

if (isChatCanvasMode && excalidrawAPI) {
  return (
    <ExcalidrawChatCanvasWrapper
      excalidrawAPI={excalidrawAPI}
      title="ChatCanvas"
    >
      {/* Excalidraw content */}
    </ExcalidrawChatCanvasWrapper>
  );
}
```

## Known Limitations

1. **Selection Polling**: Currently uses 200ms polling interval to track selection changes. In production, this should use Excalidraw's event system for better performance.

2. **Mock Agent Only**: The agent is completely mocked and doesn't connect to a real AI backend. Implement actual API calls in `mockAgent.ts` for production.

3. **Template Elements**: Template elements use simplified properties. Complex elements with advanced styling may need additional configuration.

4. **Mobile Support**: The three-column layout may need responsive adjustments for smaller screens.

## Future Enhancements

1. **Real AI Integration**: Connect to OpenAI, Claude, or other LLM APIs
2. **Advanced Templates**: Add more pre-built templates (UML, ERD, Gantt, etc.)
3. **Collaborative Features**: Support real-time collaboration with other users
4. **Custom Agents**: Allow users to define custom agent behaviors
5. **History Management**: Implement undo/redo for agent actions
6. **Export Options**: Add export to various formats (SVG, PDF, etc.)
7. **Performance Optimization**: Replace polling with event-based selection tracking
8. **Accessibility**: Improve keyboard navigation and screen reader support

## Testing

To test the ChatCanvas UI:

1. Start the dev server: `yarn start`
2. Navigate to `http://localhost:3000/?ui=chatcanvas`
3. Try the following:
   - Select elements on the canvas and see the count update in the chat panel
   - Type a message like "Make it red" and send it
   - Click on a template to load it
   - Resize the chat panel and sidebar by dragging the edges

## Troubleshooting

### Chat panel not showing

- Check that `isChatPanelOpen` is `true` in the atoms
- Verify that the `ChatCanvasShell` is properly wrapping the Excalidraw component

### Selection not updating

- The selection tracking uses a 200ms polling interval. Try selecting elements again.
- Check the browser console for any errors

### Templates not loading

- Ensure the template elements have valid properties
- Check that `excalidrawAPI` is not null before loading templates

## Contributing

To add new features or templates:

1. Add new atoms to `atoms.ts` if needed
2. Create new components in the `ChatCanvas` directory
3. Update this README with new features
4. Test thoroughly before submitting a PR

## License

This component is part of Excalidraw and follows the same MIT License.
