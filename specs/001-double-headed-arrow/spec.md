# Feature Specification: Double-Headed Arrow

**Feature Branch**: `001-double-headed-arrow`
**Created**: 2025-12-13
**Status**: Draft
**Input**: User description: "Add a new line type: line with arrows at both ends. New toolbar button/option for double-headed arrows. Feature persists correctly in save/load operations."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draw Double-Headed Arrows (Priority: P1)

Users can select and draw lines with arrows at both ends to represent bidirectional relationships, data flows, or reciprocal connections in their diagrams.

**Why this priority**: Core functionality - without the ability to draw double-headed arrows, the feature delivers no value. This is the minimum viable increment.

**Independent Test**: Can be fully tested by selecting the double-headed arrow tool, drawing a line between two points, and verifying arrows appear at both ends with the hand-drawn aesthetic preserved.

**Acceptance Scenarios**:

1. **Given** the Excalidraw canvas is open, **When** user selects the double-headed arrow tool from the toolbar and draws a line, **Then** the line displays arrows at both the start and end points
2. **Given** a double-headed arrow is selected, **When** user adjusts the line's control points, **Then** both arrow heads maintain proper orientation and scale
3. **Given** a double-headed arrow exists on canvas, **When** user changes line properties (color, stroke width, style), **Then** both arrow heads reflect the property changes consistently

---

### User Story 2 - Persist Double-Headed Arrows (Priority: P2)

Users can save drawings containing double-headed arrows and reload them with full fidelity, ensuring work is not lost and can be shared with collaborators.

**Why this priority**: Without persistence, users lose their work. This is critical for the feature to be production-ready but depends on P1 being functional first.

**Independent Test**: Create a drawing with double-headed arrows, save it (export/save to file), reload it in a fresh session, and verify arrows render identically.

**Acceptance Scenarios**:

1. **Given** a canvas with double-headed arrows, **When** user saves the drawing to a file, **Then** the file format correctly stores the double-headed arrow type
2. **Given** a saved file containing double-headed arrows, **When** user loads the file, **Then** double-headed arrows render with correct visual appearance and properties
3. **Given** a collaborative session, **When** one user draws a double-headed arrow, **Then** other users see the arrow in real-time with both heads visible

---

### User Story 3 - Convert Between Arrow Types (Priority: P3)

Users can convert existing arrows to double-headed arrows and vice versa, enabling quick diagram modifications without redrawing elements.

**Why this priority**: Quality-of-life improvement that enhances workflow efficiency but not essential for basic functionality.

**Independent Test**: Draw a single-headed arrow, access the arrow type selector, change to double-headed, and verify the conversion preserves all other properties (position, color, stroke).

**Acceptance Scenarios**:

1. **Given** an existing single-headed arrow, **When** user selects it and changes arrow type to double-headed, **Then** a second arrow head appears at the opposite end without changing line position or properties
2. **Given** an existing line without arrows, **When** user selects it and changes type to double-headed arrow, **Then** arrow heads appear at both ends
3. **Given** an existing double-headed arrow, **When** user changes type to single-headed, **Then** one arrow head is removed based on standard arrow direction

---

### Edge Cases

- What happens when a double-headed arrow has zero length (both endpoints at same position)?
- How does the system handle very short arrows where arrow heads would overlap?
- What happens when arrow properties are modified during collaborative editing conflicts?
- How are double-headed arrows handled when exporting to formats that don't support bidirectional arrows (SVG fallback)?
- What happens when users import files from older versions that don't have double-headed arrow type?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a new line element type representing arrows with heads at both endpoints
- **FR-002**: System MUST provide a toolbar button/selector for choosing double-headed arrows as a drawing tool
- **FR-003**: Users MUST be able to draw double-headed arrows using the same interaction pattern as existing line tools (click-drag or click-click)
- **FR-004**: System MUST render arrow heads at both line endpoints with consistent size, orientation, and hand-drawn aesthetic
- **FR-005**: System MUST preserve double-headed arrow type and properties during save operations (export to .excalidraw format)
- **FR-006**: System MUST correctly restore double-headed arrows when loading saved files
- **FR-007**: System MUST sync double-headed arrows in real-time collaboration sessions
- **FR-008**: Double-headed arrows MUST support all standard line properties: color, stroke width, stroke style (solid, dashed, dotted), opacity
- **FR-009**: Double-headed arrows MUST support all standard line editing operations: moving, resizing, rotating, control point adjustment
- **FR-010**: System MUST maintain arrow head orientation based on line direction at each endpoint
- **FR-011**: System MUST scale arrow heads proportionally with line stroke width
- **FR-012**: Users MUST be able to select double-headed arrows for editing using standard selection tools

### Key Entities *(include if feature involves data)*

- **Double-Headed Arrow Element**: A line element with arrow markers at both the start point and end point. Key attributes include: start position (x, y), end position (x, y), stroke properties (color, width, style, opacity), arrow head size, element ID, z-index, and element type identifier distinguishing it from other line types.

- **Arrow Head Marker**: Visual representation of directional indicator at line endpoints. Attributes include: position (derived from line endpoint), orientation angle (perpendicular to line direction at endpoint), size (proportional to stroke width), and style properties inherited from parent line element.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can draw a double-headed arrow and see both arrow heads rendered within 100ms of completing the draw gesture (60fps interaction maintained)
- **SC-002**: Double-headed arrows saved and reloaded show pixel-perfect fidelity (no visual degradation or property loss)
- **SC-003**: 100% of double-headed arrow interactions complete without errors in the browser console (zero regression in error rate)
- **SC-004**: File size increase for drawings with double-headed arrows is less than 5% compared to equivalent single-headed arrows (minimal storage overhead)
- **SC-005**: Double-headed arrows render at 60fps during collaborative editing with 10+ concurrent users (no performance degradation)
- **SC-006**: Users can complete the task "draw a double-headed arrow between two shapes" in under 5 seconds on first attempt (intuitive discoverability)
