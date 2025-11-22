# Requirements: Mermaid Diagram Renderer for Excalidraw

## Introduction

This feature converts Mermaid diagram code into native Excalidraw elements (shapes, arrows, text) so that diagrams are rendered visually on the canvas rather than displayed as text code.

## Glossary

- **Mermaid**: A text-based diagramming language that uses simple syntax to create flowcharts, sequence diagrams, etc.
- **Excalidraw Element**: Native canvas objects (rectangles, arrows, text, etc.) that can be drawn and manipulated
- **Image to Diagram**: Feature that uses Gemini AI to convert uploaded images to Mermaid code
- **Canvas**: The Excalidraw drawing surface where elements are rendered

## Requirements

### Requirement 1: Mermaid Code Parsing

**User Story:** As a user, I want the system to parse Mermaid code so that it can be converted into visual elements

#### Acceptance Criteria

1. WHEN Mermaid code is generated from an image, THE System SHALL parse the Mermaid syntax into a structured format
2. THE System SHALL support flowchart diagram types (graph TD, graph LR)
3. THE System SHALL extract nodes, edges, and labels from the Mermaid code
4. IF parsing fails, THEN THE System SHALL display an error message to the user

### Requirement 2: Node Rendering

**User Story:** As a user, I want Mermaid nodes to be rendered as Excalidraw rectangles so that I can see the diagram structure

#### Acceptance Criteria

1. THE System SHALL create an Excalidraw rectangle element for each Mermaid node
2. THE System SHALL position nodes with appropriate spacing (minimum 200px horizontal, 150px vertical)
3. THE System SHALL set node text as the label from Mermaid syntax
4. THE System SHALL auto-size rectangles based on text content
5. WHEN multiple nodes exist, THE System SHALL arrange them in a logical layout based on diagram direction

### Requirement 3: Edge Rendering

**User Story:** As a user, I want Mermaid edges to be rendered as Excalidraw arrows so that I can see relationships between nodes

#### Acceptance Criteria

1. THE System SHALL create an Excalidraw arrow element for each Mermaid edge
2. THE System SHALL bind arrow start point to source node
3. THE System SHALL bind arrow end point to target node
4. WHERE edge has a label, THE System SHALL add text element near the arrow midpoint
5. THE System SHALL support different arrow types (solid, dashed) based on Mermaid syntax

### Requirement 4: Layout Algorithm

**User Story:** As a user, I want diagrams to be automatically laid out so that they are readable and well-organized

#### Acceptance Criteria

1. THE System SHALL implement a hierarchical layout algorithm for top-down graphs
2. THE System SHALL implement a left-to-right layout algorithm for LR graphs
3. THE System SHALL avoid overlapping nodes
4. THE System SHALL center the generated diagram on the canvas
5. THE System SHALL maintain consistent spacing between elements

### Requirement 5: Integration with Image to Diagram

**User Story:** As a user, I want the Mermaid renderer to work seamlessly with the Image to Diagram feature so that uploaded images become visual diagrams

#### Acceptance Criteria

1. WHEN Gemini generates Mermaid code from an image, THE System SHALL automatically render it as Excalidraw elements
2. THE System SHALL replace the current text-only output with visual diagram rendering
3. THE System SHALL preserve the "Add to canvas" button functionality
4. IF rendering fails, THEN THE System SHALL fall back to displaying Mermaid code as text

### Requirement 6: Error Handling

**User Story:** As a user, I want clear error messages when diagram rendering fails so that I can understand what went wrong

#### Acceptance Criteria

1. IF Mermaid parsing fails, THEN THE System SHALL display "Unable to parse Mermaid diagram"
2. IF layout calculation fails, THEN THE System SHALL display "Unable to layout diagram"
3. THE System SHALL log detailed error information to console for debugging
4. THE System SHALL provide a fallback to display raw Mermaid code when rendering fails

## Non-Functional Requirements

### Performance
- Diagram rendering SHALL complete within 2 seconds for diagrams with up to 50 nodes
- Layout calculation SHALL not block the UI thread

### Usability
- Generated diagrams SHALL be immediately editable after being added to canvas
- Node positions SHALL be adjustable by dragging
- Arrow connections SHALL remain bound to nodes when nodes are moved

### Maintainability
- Mermaid parsing logic SHALL be separated into a dedicated module
- Layout algorithm SHALL be configurable for future enhancements
- Code SHALL follow existing Excalidraw TypeScript patterns
