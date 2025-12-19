**Software Requirements Document (SRD)**

**Excalidraw Notes Mode Enhancement**

**Document Version:** 1.0  
**Date:** December 19, 2025  
**Status:** Draft  
**Author:** Product Requirements Team  
**Project:** Excalidraw Multi-Mode Platform

---

**Executive Summary**

This document outlines the strategic initiative to extend \[nav\_link:Excalidraw\]'s capability beyond whiteboard diagramming by introducing a dedicated **Notes Mode**—a complementary feature set that preserves Excalidraw's core diagramming functionality while adding comprehensive handwriting note-taking and PDF annotation capabilities inspired by industry-leading note-taking applications. The goal is to establish Excalidraw as a dual-mode platform serving both technical diagramming and document-centric note-taking workflows.

**Business Objectives**

* Expand Excalidraw's addressable market by capturing note-taking use cases currently served by competitors

* Retain Excalidraw's open-source ethos while enhancing feature parity with premium note-taking applications

* Create seamless context switching between diagramming and note-taking modes within a unified interface

* Enable PDF document annotation and handwriting capture without abandoning existing diagram workflows

* Position Excalidraw as the comprehensive tool for technical professionals balancing documentation, note-taking, and visual thinking

---

**1\. Introduction**

**1.1 Purpose**

Excalidraw currently excels as a free, open-source whiteboard tool optimized for creating hand-drawn style diagrams, flowcharts, and technical illustrations. However, user feedback and market analysis reveal a significant capability gap: Excalidraw lacks native support for structured note-taking with handwriting recognition, PDF annotation, and page-based document viewing—features standard in applications like Noteshelf\[1\].

This SRD defines the requirements for integrating a new **Notes Mode** into Excalidraw's architecture, enabling users to:

* Take handwritten notes with stylus support and handwriting recognition

* Import and annotate PDF documents with natural page-based viewing

* Maintain organized note collections with hierarchical grouping

* Record audio alongside notes (future enhancement)

* Switch fluidly between Whiteboard Mode (infinite canvas) and Notes Mode (page-based document model)

**1.2 Scope**

**In Scope:**

* Notes Mode architecture and UI implementation

* Handwriting capture and stylus support for note-taking

* PDF import, viewing, and annotation capabilities

* Page-based document rendering and navigation

* Handwriting recognition and OCR integration

* Note organization and library management

* Export functionality (PDF, images, text)

* Cross-mode switching and persistence

**Out of Scope (Future Phases):**

* Audio recording integration

* Real-time collaboration for notes (Phase 2\)

* Handwriting-to-text conversion with confidence metrics (Phase 2\)

* Advanced OCR language support beyond English (Phase 1.5)

* Mobile gesture recognition optimization (Phase 2\)

**1.3 Document Structure**

This SRD is organized into the following sections:

1. **Introduction** \- Document overview and scope

2. **Product Overview** \- Product description and vision

3. **Functional Requirements** \- Detailed feature specifications

4. **Non-Functional Requirements** \- Performance, security, and quality standards

5. **External Interfaces** \- API integrations and data formats

6. **System Architecture** \- High-level design approach

7. **Data Models** \- Document structure and persistence

8. **Assumptions and Constraints** \- Project boundaries

9. **Risk Analysis** \- Known challenges and mitigation strategies

10. **Acceptance Criteria** \- Success metrics and validation

---

**2\. Product Overview**

**2.1 Vision Statement**

Transform Excalidraw into a unified platform serving the complete knowledge capture workflow: from rapid whiteboard sketching and diagramming to structured handwritten note-taking and document annotation—all within a single, cohesive application.

**2.2 Product Description**

Excalidraw Notes Mode is a new operational context within the Excalidraw application that shifts the user experience from an infinite whiteboard paradigm to a page-based notebook paradigm. Users can:

**Whiteboard Mode (Existing)**

* Create infinite-canvas diagrams with hand-drawn aesthetics

* Collaborate in real-time on drawings

* Use shape libraries and architectural stencils

* Export as SVG, PNG, or embed in markdown

**Notes Mode (New)**

* Work within structured page layouts (letter size, A4, custom)

* Capture handwritten notes with multi-style pens and highlighters

* Import PDF documents and annotate directly on pages

* Recognize and search handwritten text

* Organize notes hierarchically (shelves, notebooks, pages)

* Record metadata (timestamps, author, subject tags)

**2.3 Target Users**

* **Technical Professionals**: Engineers, architects, DevOps specialists who sketch diagrams AND take meeting notes

* **Students**: Require both diagramming for study materials and note-taking for lectures

* **Researchers**: Need document annotation alongside conceptual sketching

* **Product Managers**: Balance wireframe sketching with specification documentation

**2.4 Key Differentiators from Competitors**

| Aspect | Excalidraw (Current) | Excalidraw with Notes Mode | Noteshelf | Microsoft OneNote |
| :---- | :---- | :---- | :---- | :---- |
| **Diagramming** | Excellent | Excellent (preserved) | Limited | Basic |
| **Handwriting Notes** | None | Full support | Excellent | Good |
| **PDF Annotation** | None | Full support | Excellent | Good |
| **Open Source** | Yes | Yes | No (proprietary) | No (proprietary) |
| **Page-based Viewing** | No | Yes (Notes Mode) | Yes | Yes |
| **Cost** | Free | Free | Freemium | Subscription |
| **Infinite Canvas** | Yes | Yes (Whiteboard Mode) | No | No |

---

**3\. Functional Requirements**

**3.1 Mode Switching and Navigation**

**FR-3.1.1: Mode Toggle Interface**

The application shall provide a persistent, easily accessible control to switch between Whiteboard Mode and Notes Mode without losing unsaved work.

**Requirements:**

* Mode toggle shall be located in the top navigation bar with clear iconography (whiteboard icon vs. notebook icon)

* Switching modes shall trigger an auto-save of current work in the active mode

* Users shall receive visual confirmation of active mode through highlighting or color coding

* Keyboard shortcut (e.g., Ctrl+M or Cmd+M) shall enable quick mode switching

* A confirmation dialog shall appear if unsaved changes exist (for users without auto-save enabled)

**Acceptance Criteria:**

* \[ \] User can toggle modes within 2 seconds from any UI state

* \[ \] Auto-save completes and saves current mode's work before mode switch

* \[ \] Visual indicator clearly shows active mode at all times

* \[ \] Keyboard shortcut functions on Windows, macOS, and Linux

**FR-3.1.2: Mode-Specific UI Context**

The application shall adapt the UI toolbar, menu options, and properties panel based on the active mode.

**Whiteboard Mode UI Elements:**

* Shape library, connector tools, stencil panels

* Collaboration toolbar (share, cursor tracking)

* Presentation mode controls

* Infinite canvas navigation (zoom, pan)

**Notes Mode UI Elements:**

* Handwriting tools (pens, highlighters, eraser)

* Page navigation controls (previous/next page, page thumbnails)

* Document structure panel (notebook browser, page list)

* PDF import and annotation tools

* Handwriting recognition controls

**Acceptance Criteria:**

* \[ \] Toolbar adapts within 100ms of mode switch

* \[ \] No UI elements from inactive mode are displayed

* \[ \] All mode-specific tools are accessible within 2 clicks

* \[ \] Responsiveness tested on tablets (iPad, Android) and desktop

**3.2 Handwriting and Stylus Support**

**FR-3.2.1: Digital Pen Tools**

The Notes Mode shall provide a comprehensive pen toolset comparable to Noteshelf, supporting stylus and touch input.

**Pen Types:**

1. **Ballpoint Pen** \- Classic writing instrument appearance

2. **Felt Pen** \- Softer edges, marker-like appearance

3. **Fountain Pen** \- Calligraphic style with variable thickness

4. **Highlighter** \- Semi-transparent color overlay (3 variants)

5. **Pencil** \- Textured, erasable appearance

6. **Eraser** \- Removes ink within brush radius

**Pen Customization:**

* Color palette with 200+ preset colors \+ custom color picker

* Nib size adjustment: 0.5mm to 10mm (continuously adjustable)

* Opacity/transparency control (0-100%)

* Pressure sensitivity: enabled by default for stylus input, optional for touch

* Pen speed/smoothing: 0-100% interpolation control

**Acceptance Criteria:**

* \[ \] All 6 pen types render with distinct visual characteristics

* \[ \] Pen size adjustment updates in real-time as user writes

* \[ \] Color changes apply immediately without requiring tool reselection

* \[ \] Pressure sensitivity functions on iPad, Galaxy Tab, and Android devices with stylus support

* \[ \] Eraser removes full strokes within 2-stroke swipes

**FR-3.2.2: Handwriting Recognition and OCR**

The Notes Mode shall integrate handwriting recognition to enable text search and indexing of handwritten content.

**OCR Engine Integration:**

* Primary: \[nav\_link:Tesseract\] OCR (open-source, free)

* Alternative: Google Vision API (if handwriting recognition insufficient)

* Processing: Client-side OCR with optional server processing for high-volume documents

**Recognition Capabilities:**

* Language support: English (Phase 1), multilingual expansion (Phase 2\)

* Confidence scoring: Display recognition confidence per word

* Searchability: Index recognized text for full-text search across note library

* Background processing: OCR runs asynchronously without blocking user input

* Recognition UI: Display recognized text as overlay or in sidebar for verification

**Acceptance Criteria:**

* \[ \] OCR processes page within 3 seconds (client-side Tesseract)

* \[ \] Search returns results matching handwritten content with 85%+ accuracy threshold

* \[ \] User can toggle recognized text display on/off

* \[ \] OCR processes up to 100 pages in document without performance degradation

* \[ \] Confidence scores accurate within ±5% of manual validation

**FR-3.2.3: Palm Rejection and Handwriting Styles**

The system shall detect and accommodate varied handwriting styles and prevent accidental palm contact from interfering with writing.

**Palm Rejection:**

* Detect hand/palm proximity using stylus pressure data and touch area size

* Disable unintended touch input when active stylus is in proximity

* User configuration: Enable/disable palm rejection, adjust sensitivity

**Handwriting Style Detection:**

* Provide 6 handwriting profile presets (baseline adjustments)

* Allow users to select profile matching their writing style: natural, cursive, blocky, mixed, left-handed, tight

* Profiles adjust recognition parameters and pressure sensitivity baselines

**Acceptance Criteria:**

* \[ \] Palm rejection reduces false strokes by 95% without user intervention

* \[ \] Handwriting profiles improve recognition accuracy by 10-15% when correctly selected

* \[ \] User can switch profiles without restarting application

* \[ \] Palm rejection configurable per device (tablet-specific sensitivity)

**3.3 PDF Import and Annotation**

**FR-3.3.1: PDF Import and Page-Based Viewing**

The application shall enable users to import PDF documents and display them page-by-page within Notes Mode.

**Import Workflow:**

* File picker supporting PDF selection from device storage, cloud services (Google Drive, Dropbox, OneDrive)

* Drag-and-drop PDF import onto canvas

* Batch import: Support multiple PDFs in single import operation

* Progress indicator for import processing and PDF rendering

**Page Rendering:**

* Render PDF pages at device-native resolution (minimum 150 DPI)

* Lazy loading: Load pages as user navigates (first 5 pages \+ adjacent pages pre-cached)

* Zoom controls: Pinch-zoom, menu zoom, fit-to-width, fit-to-page

* Pan gesture support: Two-finger drag on tablet, mouse drag on desktop

* Page navigation: Thumbnail strip, page number input, previous/next buttons, PageUp/PageDown keyboard shortcuts

**Acceptance Criteria:**

* \[ \] PDF import completes within 5 seconds for 50-page document

* \[ \] Page rendering displays at readable resolution on 7-inch and larger tablets

* \[ \] Thumbnail strip loads within 2 seconds

* \[ \] Zoom range: 50% to 500% with smooth transitions

* \[ \] Pan gesture responsive within 100ms on tablets with stylus

**FR-3.3.2: PDF Annotation Tools**

Users shall annotate PDF pages using handwriting, highlights, text boxes, and shape markup.

**Annotation Capabilities:**

1. **Handwriting Markup** \- All pen types (ballpoint, felt pen, highlighter) usable directly on PDF

2. **Highlight** \- Semi-transparent color overlay across text regions

3. **Text Annotation** \- Typed text boxes anchored to specific page regions

4. **Shape Annotations** \- Rectangles, circles, arrows for emphasis

5. **Underline/Strikethrough** \- Line tools for document editing

6. **Sticky Notes** \- Floating annotations with optional popover text

7. **Signature** \- Capture user signature for document signing

**Annotation Persistence:**

* Annotations stored separately from PDF file (non-destructive editing)

* Export with annotations embedded (option for flat or layered export)

* Annotation history: Undo/redo support for all annotation operations

* Annotation versioning: Track annotation changes with timestamps

**Acceptance Criteria:**

* \[ \] Handwriting renders smoothly on PDF pages at full resolution

* \[ \] Highlight opacity adjustable (25%, 50%, 75%, 100%)

* \[ \] Text box creation responsive within 100ms

* \[ \] Undo/redo supports 50+ annotation operations

* \[ \] Annotations export cleanly without artifacts or distortion

**FR-3.3.3: OCR for Imported PDFs**

PDFs shall be processed with OCR to enable text search and extraction.

**Requirements:**

* Automatic OCR on PDF import with progress indicator

* OCR recognition on text-based PDFs (scanned PDFs recognized as images)

* Searchable PDF text layer generation or parallel text index

* Text extraction: Copy recognized text from PDF for external use

* PDF outline recognition: Display and navigate PDF table of contents (if available)

* Bookmark creation: User-created bookmarks for document sections

**Acceptance Criteria:**

* \[ \] OCR completes for 20-page PDF within 15 seconds (background processing)

* \[ \] Search matches PDF text with 90%+ accuracy for printed documents

* \[ \] Bookmark creation accessible within 2 clicks

* \[ \] PDF outline navigation functional for documents with embedded TOC

**3.4 Page-Based Document Model**

**FR-3.4.1: Page Structure and Layout**

Notes Mode shall use a page-based document model instead of the infinite whiteboard model.

**Page Specifications:**

* **Preset Sizes**: Letter (8.5" × 11"), A4 (210mm × 297mm), Tabloid, B5, Custom

* **Orientation**: Portrait and landscape

* **Margins**: Customizable (default: 0.5" all sides)

* **Page Backgrounds**: Blank, lined, dotted grid, Cornell note format, ruled music staff

* **Page Numbers**: Automatic numbering with position/format customization

**Document Structure:**

* Single note \= Document (contains multiple pages)

* Notes organized in folders/notebooks (hierarchical structure)

* Each page has metadata: title, creation date, modification date, tags, handwriting language

**Acceptance Criteria:**

* \[ \] Page dimensions render accurately (verified by ruler measurement)

* \[ \] Preset templates load without delay

* \[ \] Custom page size supports ranges: 4" × 6" to 17" × 22"

* \[ \] Background templates apply consistently across pages

* \[ \] Page numbering updates automatically when pages added/deleted

**FR-3.4.2: Page Navigation**

Users shall navigate through multi-page documents efficiently.

**Navigation Controls:**

* **Thumbnail Strip**: Vertical sidebar showing page thumbnails with drag-to-reorder capability

* **Page Navigator**: Dropdown showing current page and total page count (e.g., "Page 5 of 23")

* **Keyboard Shortcuts**:

  * Page Up / Page Down \- Previous/next page

  * Home / End \- First/last page

  * Ctrl+G or Cmd+G \- Go to page dialog

* **Swipe Navigation**: Left/right swipe on touch devices to navigate pages

* **Breadcrumb Navigation**: Show document \> notebook \> page hierarchy

**Acceptance Criteria:**

* \[ \] Thumbnail loading time \<500ms per page

* \[ \] Page switching responsive within 200ms

* \[ \] Thumbnail drag-to-reorder reflects in page navigation

* \[ \] Keyboard navigation works in all UI states

* \[ \] Swipe navigation optional (configurable for user preference)

**FR-3.4.3: Multi-Page Editing**

The application shall support seamless editing across multiple pages within a single document.

**Requirements:**

* Add new page: Insert blank page at current position, append to end, or duplicate current page

* Delete page: Confirmation required before permanent deletion

* Move pages: Drag pages in thumbnail strip to reorder

* Copy/paste between pages: Content clipboard persists across pages

* Search across all pages: Full-text search returns results with page numbers

* Batch operations: Select multiple pages for bulk operations (delete, move, export)

**Acceptance Criteria:**

* \[ \] New page creation completes within 200ms

* \[ \] Page deletion includes undo option (within same session)

* \[ \] Drag-to-reorder within thumbnail strip responsive and smooth

* \[ \] Search returns up to 100 results per query with pagination

* \[ \] Batch operations handle up to 100 pages without lag

**3.5 Note Organization and Library**

**FR-3.5.1: Hierarchical Organization**

Notes shall be organized in a hierarchical structure similar to Noteshelf's shelf system.

**Organizational Levels:**

1. **Shelf** \- Top-level category (e.g., "Work", "Personal", "Projects")

2. **Notebook** \- Collection within shelf (e.g., "Q4 Planning", "Meeting Notes")

3. **Note/Document** \- Individual document containing pages

4. **Page** \- Single page within note

**Organization Features:**

* Drag-and-drop reordering at all levels

* Rename shelves, notebooks, notes in-place or via dialog

* Color-coded shelves for quick visual identification

* Search/filter by shelf, notebook, date range, tags

* Recent items quick access

* Favorites/starred notes for quick access

**Acceptance Criteria:**

* \[ \] Hierarchy displayed in left sidebar with expand/collapse controls

* \[ \] Drag-and-drop responsive without lag

* \[ \] Rename operations update across application without restart

* \[ \] Search returns results within 1 second for 1000+ documents

* \[ \] Favorites list updates in real-time when star status changed

**FR-3.5.2: Metadata and Tagging**

Each note shall support rich metadata for searchability and organization.

**Metadata Fields:**

* **Title** \- Document name

* **Created Date** \- Auto-populated

* **Modified Date** \- Auto-updated on changes

* **Tags** \- User-defined keywords (up to 10 per document)

* **Subject** \- Category (e.g., "Meeting", "Lecture", "Personal")

* **Author** \- User name (for future collaboration)

* **Notebook** \- Parent notebook reference

* **Custom Fields** \- User-defined metadata (Phase 2\)

**Tag Management:**

* Tag autocomplete based on previously used tags

* Tag cloud visualization showing frequently used tags

* Bulk tag operations: Apply/remove tags across multiple documents

**Acceptance Criteria:**

* \[ \] All metadata fields editable from document properties dialog

* \[ \] Autocomplete suggests 5 matching tags within 100ms

* \[ \] Tag-based filtering returns results immediately

* \[ \] Metadata persists across app restarts and syncs

**3.6 Export and Sharing**

**FR-3.6.1: Export Formats**

Notes shall be exportable in multiple formats for sharing and archival.

**Export Options:**

1. **PDF** \- Pages rendered with annotations embedded (standard format)

2. **Images** \- Individual pages as JPEG/PNG with selectable DPI (150-300 DPI default)

3. **Markdown** \- Recognized text extracted to markdown with metadata headers

4. **SVG** \- Vector format preserving pen strokes for lossless editing

5. **Excalidraw Format** \- Native format preserving all metadata and editability

6. **ZIP Archive** \- Multiple export formats bundled for complete document backup

**Export Dialog:**

* Format selection with preview

* Page range selection (current page, range, all pages)

* Quality settings (resolution for images, compression, text extraction)

* Metadata inclusion option (embed metadata in PDF)

* Auto-naming based on document title and date

**Acceptance Criteria:**

* \[ \] Export completes within 5 seconds for 20-page document

* \[ \] PDF export maintains pen stroke fidelity

* \[ \] Image export DPI options verified with measurement tools

* \[ \] Markdown extraction preserves text with 95% accuracy

* \[ \] ZIP archive includes all selected formats with proper directory structure

**FR-3.6.2: Sharing and Collaboration (Phase 2\)**

Notes shall support sharing with view-only and edit permissions (future enhancement).

**Sharing Features (Deferred):**

* Generate shareable links with expiration options

* Invite specific users with edit/view permissions

* Shared note commenting and @mentions

* Real-time collaboration on shared notes

* Revision history with change tracking

---

**4\. Non-Functional Requirements**

**4.1 Performance**

**NFR-4.1.1: Response Time**

* **Page Navigation**: \< 200ms between pages

* **Tool Selection**: \< 100ms for pen/tool switching

* **Handwriting Latency**: \< 100ms between stylus input and rendering (target: \< 50ms)

* **OCR Processing**: \< 3 seconds per page (background, non-blocking)

* **PDF Import**: \< 5 seconds for 50-page document

* **File Save**: \< 2 seconds for 100-page document

**NFR-4.1.2: Scalability**

* **Document Size**: Support documents up to 1,000 pages without performance degradation

* **File Size**: Handle files up to 500 MB (compressed storage format)

* **Annotation Density**: Support up to 10,000 annotations per page without lag

* **Search Index**: Index up to 100,000 pages within application instance

* **Real-time Collaboration**: Support 20+ simultaneous editing sessions (Phase 2\)

**4.2 Usability**

**NFR-4.2.1: Accessibility**

* **WCAG 2.1 Level AA Compliance**: All UI elements keyboard accessible

* **Color Contrast**: Minimum 4.5:1 ratio for text, 3:1 for graphics

* **Screen Reader Support**: Alternative text for icons, semantic HTML markup

* **Keyboard Navigation**: Complete app functionality accessible via keyboard shortcuts

* **Text Scaling**: Support up to 200% text scaling without UI breakage

* **Left-Handed Support**: Toolbar repositionable for left-handed users

**NFR-4.2.2: Multi-Device Support**

* **Desktop**: Windows 10+, macOS 10.14+, Linux (Ubuntu 20.04+)

* **Tablets**: iPad (iOS 14+), Android tablets (6.0+)

* **Stylus Support**: Apple Pencil, Microsoft Surface Pen, Android stylus devices

* **Touch Support**: Optimized touch targets (minimum 44×44 px)

* **Screen Sizes**: Responsive design supporting 5-inch to 27-inch displays

**4.3 Security and Privacy**

**NFR-4.3.1: Data Protection**

* **Encryption**: Local notes encrypted at rest using AES-256 (future: end-to-end encryption for sync)

* **File Permissions**: Documents stored with OS-level file permissions

* **Privacy by Default**: No telemetry or analytics without explicit user consent

* **Data Retention**: User retains full control; deletion is permanent with recovery option (7-day trash)

**NFR-4.3.2: Authentication (Sync/Cloud Features)**

* OAuth 2.0 for cloud provider authentication (Google Drive, Dropbox, OneDrive)

* Local operation does not require authentication

* API tokens stored securely with device credential storage

* Session timeout: 24 hours for cloud sync features

**4.4 Reliability**

**NFR-4.4.1: Availability**

* **Uptime**: 99.9% for cloud services (if implemented in Phase 2\)

* **Local Operation**: 100% available (no internet required for core functionality)

* **Offline Support**: Full functionality without network connection

* **Auto-Save**: Save work every 30 seconds (user-configurable)

* **Crash Recovery**: Recover unsaved work from last 5 minutes on crash

**NFR-4.4.2: Data Integrity**

* **File Format Validation**: Verify file integrity on open

* **Undo/Redo Stack**: Support up to 100 undo operations per session

* **File Backup**: Automatic daily backup of changed documents (user-configurable)

* **Version Control**: Maintain change history with timestamps

**4.5 Compatibility**

**NFR-4.5.1: Format Compatibility**

* Import Noteshelf documents (future interoperability)

* Import OneNote notebooks (roadmap feature)

* Export to standard formats (PDF, SVG, PNG, Markdown)

* Maintain backward compatibility with existing Excalidraw documents

* Support reading/writing common note formats (markdown, OPML)

**4.6 Maintainability**

**NFR-4.6.1: Code Quality**

* **Test Coverage**: Minimum 80% code coverage for critical paths

* **Documentation**: Inline code comments, architecture documentation, API docs

* **Code Standards**: ESLint configuration, Prettier formatting

* **Dependency Management**: Regular security updates, minimize external dependencies

* **Modular Architecture**: Separate Notes Mode from Whiteboard Mode for independent updates

---

**5\. External Interfaces**

**5.1 File System Integration**

**Input Files:**

* PDF documents (PDF 1.4+)

* Image files (JPEG, PNG, WEBP)

* Markdown files (for import as notes)

* Excalidraw native format (.excalidraw)

**Output Files:**

* Excalidraw Notes format (.excalidraw or .excalidraw-notes extension)

* PDF (embedded annotations)

* PNG/JPEG (individual pages)

* Markdown (extracted text)

* SVG (vector representation)

**5.2 OS Integration**

**Desktop:**

* System file picker for document selection

* System print dialog for printing notes

* System clipboard integration (copy/paste between Notes Mode and external apps)

* OS-level file association (open .excalidraw-notes files directly)

**Mobile/Tablet:**

* Camera integration for document scanning (iOS: Camera, Android: Android Intent)

* Cloud storage provider APIs (Google Drive, iCloud Drive, OneDrive)

* Document picker (iOS Files, Android Storage Access Framework)

* Share extensions (iOS Share Sheet, Android Share Menu)

**5.3 Third-Party Services (Future)**

* **OCR**: Google Vision API (fallback for complex handwriting) \- Phase 1.5

* **Cloud Storage**: Google Drive, Dropbox, OneDrive SDK integration \- Phase 2

* **Handwriting Recognition**: Google Handwriting Input API (optional) \- Phase 2

* **AI Features**: Summarization, translation APIs (Phase 2\)

**5.4 API Requirements**

**Internal APIs:**

* Notes service API (CRUD operations on notes)

* Page service API (page management, rendering)

* Annotation service API (create, update, delete annotations)

* Export service API (generate exports)

* Search service API (full-text search, tag queries)

**External APIs** (Future):

* REST API for accessing note data programmatically

* Webhook support for external integrations

* IFTTT/Zapier integration (Phase 3\)

---

**6\. System Architecture**

**6.1 High-Level Architecture**

┌─────────────────────────────────────────────────────────────┐  
│ Excalidraw Application │  
├──────────────────────────┬──────────────────────────────────┤  
│ Whiteboard Mode UI │ Notes Mode UI │  
│ (Existing) │ (New) │  
├──────────────────────────┼──────────────────────────────────┤  
│ Unified Core Layer │  
│ ┌─────────────────────────────────────────────────────┐ │  
│ │ Mode Manager │ File Manager │ History/Undo │ │  
│ └─────────────────────────────────────────────────────┘ │  
├──────────────────────────┬──────────────────────────────────┤  
│ Whiteboard Engine │ Notes Engine (New) │  
│ \- Infinite Canvas │ \- Page Renderer │  
│ \- Shape Library │ \- Handwriting Processor │  
│ \- Collaboration │ \- PDF Processor │  
│ │ \- Annotation Engine │  
│ │ \- OCR Integration │  
├──────────────────────────┼──────────────────────────────────┤  
│ Storage & Persistence │  
│ ┌─────────────────────────────────────────────────────┐ │  
│ │ Local Storage (IndexedDB/SQLite) │ │  
│ │ File System API (Electron / Native) │ │  
│ │ Cloud Sync (Phase 2\) │ │  
│ └─────────────────────────────────────────────────────┘ │  
└─────────────────────────────────────────────────────────────┘

**6.2 Technology Stack (Recommended)**

**Frontend:**

* Framework: React 18+ (leverage existing Excalidraw codebase)

* Canvas Rendering: HTML5 Canvas \+ WebGL (for performance)

* State Management: Redux or Zustand

* Styling: CSS-in-JS (emotion/styled-components)

**Backend/Runtime:**

* Desktop: Electron framework for native app capabilities

* Web: Progressive Web App (PWA) with service workers

* Rendering: PDF.js for PDF rendering, Tesseract.js for OCR

**Storage:**

* Local: IndexedDB (web), SQLite (Electron)

* File System: Electron File API or File System Access API

* Compression: ZIP.js for archive creation

**OCR/Recognition:**

* Tesseract.js (lightweight, open-source)

* Optional: Google Vision API (Phase 1.5)

**6.3 Data Flow Architecture**

User Input (Stylus/Touch)  
↓  
Input Handler (gesture recognition, pressure sensitivity)  
↓  
Stroke Processor (smoothing, recognition)  
↓  
Rendering Engine (canvas updates)  
↓  
Auto-Save Trigger  
↓  
Storage Layer (IndexedDB \+ File System)

---

**7\. Data Models**

**7.1 Document Structure (JSON Schema)**

{  
"id": "uuid",  
"type": "excalidraw-notes",  
"version": "1.0",  
"metadata": {  
"title": "Meeting Notes \- Q4 Planning",  
"created": "2025-12-19T10:00:00Z",  
"modified": "2025-12-19T15:30:00Z",  
"author": "[user@example.com](mailto:user@example.com)",  
"subject": "Meeting",  
"tags": \["q4", "planning", "important"\],  
"notebook": "Work/Planning"  
},  
"pages": \[  
{  
"id": "page-uuid",  
"number": 1,  
"title": "Agenda",  
"created": "2025-12-19T10:00:00Z",  
"layout": {  
"width": 816,  
"height": 1056,  
"margins": { "top": 36, "right": 36, "bottom": 36, "left": 36 },  
"background": "blank"  
},  
"content": {  
"strokes": \[  
{  
"id": "stroke-uuid",  
"type": "handwriting",  
"points": \[\[100, 100\], \[105, 105\], \[110, 110\]\],  
"penType": "ballpoint",  
"color": "\#000000",  
"width": 2.0,  
"opacity": 1.0,  
"timestamp": 1703084400000,  
"pressureData": \[0.5, 0.7, 0.8\]  
}  
\],  
"annotations": \[  
{  
"id": "annotation-uuid",  
"type": "highlight",  
"bounds": { "x": 100, "y": 120, "width": 200, "height": 20 },  
"color": "\#FFFF00",  
"opacity": 0.3  
}  
\]  
},  
"ocrData": {  
"recognized": "Agenda items for Q4 review",  
"language": "en",  
"confidence": 0.92,  
"processed": "2025-12-19T10:05:00Z"  
}  
}  
\],  
"pdfAttachments": \[  
{  
"id": "pdf-uuid",  
"filename": "project-spec.pdf",  
"imported": "2025-12-19T12:00:00Z",  
"pages": 45,  
"annotations": \[\]  
}  
\]  
}

**7.2 Stroke Data Structure**

Each handwritten stroke shall be stored with full fidelity for reconstruction:

{  
"id": "stroke-uuid",  
"type": "handwriting",  
"penType": "ballpoint|felt|fountain|highlighter|pencil|eraser",  
"color": "\#RRGGBBAA",  
"width": 2.5,  
"opacity": 1.0,  
"points": \[\[x1, y1\], \[x2, y2\], ...\],  
"pressureData": \[0.5, 0.7, 0.8, ...\],  
"timestamp": 1703084400000,  
"pageId": "page-uuid",  
"boundingBox": { "x": 50, "y": 100, "width": 300, "height": 200 }  
}

**7.3 Annotation Data Structure**

Annotations are stored separately for non-destructive editing:

{  
"id": "annotation-uuid",  
"type": "highlight|textbox|shape|underline|sticky",  
"pageId": "page-uuid",  
"bounds": { "x": 100, "y": 120, "width": 200, "height": 20 },  
"color": "\#FFFF00",  
"opacity": 0.3,  
"content": "Optional text for textbox or sticky",  
"created": "2025-12-19T10:05:00Z",  
"modified": "2025-12-19T10:06:00Z"  
}

---

**8\. Assumptions and Constraints**

**8.1 Assumptions**

1. **User Device Capability**: Target devices support HTML5 Canvas and WebGL for smooth rendering

2. **Internet Connectivity**: Initial version operates offline; cloud sync is Phase 2 enhancement

3. **File Storage**: Users have adequate local storage (minimum 100 MB for test documents)

4. **Stylus Availability**: Tablet users have access to capacitive or active stylus; app gracefully degrades to touch

5. **PDF Structure**: Imported PDFs are well-formed (PDF 1.4+); corrupted PDFs rejected gracefully

6. **OCR Accuracy**: Tesseract.js OCR achieves 85%+ accuracy for English printed text; scanned documents may require manual correction

7. **Collaboration Requirements**: Real-time collaboration is Phase 2; Phase 1 focuses on single-user local workflows

**8.2 Constraints**

**Technical Constraints**

1. **Platform**: Must support desktop (Windows, macOS, Linux) and tablets (iPad, Android) from day one

2. **Browser Compatibility**: Minimum Chrome/Edge 90+, Firefox 88+, Safari 14+

3. **File Format**: Use JSON-based format for extensibility; support PDF as read-only format

4. **Performance**: Canvas rendering must maintain 60 FPS on iPad Air 2 (2014 baseline)

5. **Storage**: Local storage limited by device; cloud storage optional in Phase 2

6. **Code Size**: Bundle size under 5 MB for web version (after compression)

**Organizational Constraints**

1. **Timeline**: Phase 1 delivery within 6 months (MVP functionality)

2. **Team**: Require handwriting UI expert, OCR integration engineer, PDF specialist

3. **Open Source**: Must maintain open-source license compatibility (Apache 2.0)

4. **Dependencies**: Minimize external dependencies; prefer battle-tested libraries

5. **Testing**: Achieve 80% test coverage before release

**User Constraints**

1. **Learning Curve**: Users familiar with Excalidraw should adopt Notes Mode within 1 hour

2. **Data Portability**: Users must be able to export and migrate notes easily

3. **Privacy**: No mandatory cloud account; local operation is primary use case

4. **Backward Compatibility**: Existing Excalidraw documents must remain fully functional

---

**9\. Risk Analysis**

**9.1 Technical Risks**

**Risk 1: Handwriting Latency on Tablets**

**Severity**: High | **Probability**: Medium

**Description**: HTML5 Canvas \+ JavaScript may not achieve \<50ms latency for handwriting on lower-end Android tablets, impacting user experience.

**Mitigation:**

* Benchmark latency across device range (iPad 6th gen, Galaxy Tab S6, Lenovo Tab) early

* Implement WebGL acceleration for stroke rendering

* Use requestAnimationFrame for optimal timing

* Profile and optimize hot paths during Phase 1

* Fallback: Feature flag to enable "performance mode" with reduced effects

**Contingency**: If latency cannot meet target, document as known limitation; educate users through tutorials

**Risk 2: OCR Recognition Accuracy Insufficient**

**Severity**: High | **Probability**: Medium

**Description**: Tesseract.js may achieve \<80% accuracy for handwritten text, making search unreliable.

**Mitigation:**

* Prototype Tesseract vs. Google Vision API accuracy early

* Implement confidence scoring and manual correction workflow

* Allow users to toggle OCR on/off

* Provide "OCR suggestions" rather than automatic indexing

* Plan Phase 1.5 upgrade path to more advanced recognition

**Contingency**: Launch with OCR as experimental feature; collect accuracy metrics for future improvement

**Risk 3: PDF Rendering Performance at Scale**

**Severity**: Medium | **Probability**: Medium

**Description**: Rendering 1000+ page PDF may cause memory bloat and browser crashes.

**Mitigation:**

* Implement aggressive page caching (load pages on-demand)

* Use PDF.js worker threads for off-main-thread rendering

* Limit simultaneous loaded pages to 10 (current \+ 9 adjacent)

* Implement garbage collection for unused page textures

* Monitor memory usage and warn users of large documents

**Contingency**: Implement document splitting for very large PDFs; recommend splitting at 500 pages

**Risk 4: File Format Lock-In**

**Severity**: Medium | **Probability**: Low

**Description**: Custom JSON format may become difficult to migrate away from if users accumulate large libraries.

**Mitigation:**

* Design format with versioning support

* Maintain export capabilities to open formats (PDF, Markdown, SVG)

* Plan import paths from Noteshelf/OneNote early

* Document format specification in GitHub wiki

* Support community tool development for format conversion

**Contingency**: Commit to supporting format import/export for 5+ years minimum

**9.2 Market Risks**

**Risk 5: Feature Parity Difficulty**

**Severity**: High | **Probability**: High

**Description**: Noteshelf and OneNote have mature feature sets; achieving full parity may delay launch and fragment features across phases.

**Mitigation:**

* Define "Phase 1 MVP" with non-negotiable features only

* Defer advanced features (audio recording, real-time collab) to Phase 2+

* Focus Phase 1 on handwriting quality and PDF annotation

* Communicate roadmap clearly to manage user expectations

* Gather early feedback to prioritize Phase 2 features

**Contingency**: Soft launch to beta users; iterate based on feedback before general release

**Risk 6: User Migration from Noteshelf**

**Severity**: Medium | **Probability**: Medium

**Description**: Users with existing Noteshelf libraries may hesitate to switch without direct import capability.

**Mitigation:**

* Plan Noteshelf import in Phase 1.5 (reverse-engineer format)

* Provide migration guide and support documentation

* Offer one-time migration assistance tool

* Emphasize Excalidraw advantages (open-source, free, diagramming integration)

* Create comparison matrix highlighting Excalidraw strengths

**Contingency**: Provide Noteshelf export → PDF → Excalidraw import workflow as workaround

**9.3 Resource Risks**

**Risk 7: Insufficient OCR/Handwriting Expertise**

**Severity**: Medium | **Probability**: Medium

**Description**: Team may lack expertise in handwriting recognition, stylus handling, and OCR integration.

**Mitigation:**

* Hire or contract OCR specialist for Phase 1

* Conduct prototype spikes before committing to timeline

* Use pre-built libraries (Tesseract.js, PDF.js) rather than building from scratch

* Document learnings in team wiki

* Schedule knowledge transfer sessions

**Contingency**: Plan extended Phase 1 timeline if expertise gaps discovered

---

**10\. Acceptance Criteria and Success Metrics**

**10.1 Phase 1 Acceptance Criteria**

**Functionality**

* \[ \] Mode toggle between Whiteboard and Notes Mode functional

* \[ \] Handwriting with 6 pen types renders smoothly (60 FPS target)

* \[ \] Pressure sensitivity works on iOS, Android, Windows stylus devices

* \[ \] PDF import and page-based viewing functional

* \[ \] PDF annotation (handwriting, highlight, text) works

* \[ \] Handwriting recognition and search functional (85%+ accuracy threshold)

* \[ \] Page navigation responsive (\< 200ms)

* \[ \] Export to PDF, PNG, Markdown functional

* \[ \] Document organization (shelves, notebooks) functional

* \[ \] Undo/redo supports 50+ operations

* \[ \] Auto-save every 30 seconds

* \[ \] Crash recovery restores work from last 5 minutes

**Quality**

* \[ \] 80% test coverage for critical paths

* \[ \] Zero known data loss bugs

* \[ \] Handwriting latency \< 150ms on iPad Air 2

* \[ \] PDF rendering responsive for 100+ page documents

* \[ \] No crashes in 8-hour extended use testing

* \[ \] Accessibility audit: WCAG 2.1 Level A compliance

**User Experience**

* \[ \] First-time user completes tutorial in \< 10 minutes

* \[ \] Mode switching intuitive without documentation

* \[ \] Handwriting quality comparable to Noteshelf subjective assessment

* \[ \] Export workflow requires \< 3 steps

* \[ \] All tools discoverable from main toolbar

**10.2 Success Metrics (Post-Launch)**

**Adoption Metrics**

* 10,000+ downloads in first 3 months

* 4.5+ app store rating (minimum 500 reviews)

* 2,000+ GitHub stars (comparison: Noteshelf not open-source)

**Engagement Metrics**

* Average 2+ documents per user

* 30-day retention rate \> 40%

* Daily active user count \> 20% of downloads

**Quality Metrics**

* Crash-free sessions \> 99%

* Average session duration \> 15 minutes

* User-reported bugs resolved within 2 weeks

**Feature Metrics**

* Handwriting recognition accuracy \> 88%

* Page load time \< 200ms (95th percentile)

* PDF documents up to 500 pages supported smoothly

**10.3 Phase 2 Acceptance Criteria (Future)**

* Real-time collaboration on shared notes (2+ simultaneous users)

* Audio recording during note-taking

* Noteshelf/OneNote import capability

* Advanced handwriting-to-text conversion

* Cloud sync with conflict resolution

* Comments and @mentions on shared notes

* Custom metadata fields

---

**11\. Glossary and Definitions**

| Term | Definition |
| :---- | :---- |
| **Whiteboard Mode** | Original Excalidraw mode featuring infinite canvas for diagramming |
| **Notes Mode** | New mode featuring page-based document model for note-taking and annotation |
| **Handwriting Recognition** | OCR technology identifying handwritten text and enabling search |
| **Stylus** | Active or capacitive pen input device for digital writing on tablets |
| **Palm Rejection** | Technology preventing unintended hand contact from registering as input |
| **Stroke** | Single continuous handwriting mark from pen down to pen up |
| **Annotation** | Markup applied to PDF (highlight, text box, shape) |
| **OCR** | Optical Character Recognition; technology converting images of text to searchable text |
| **Shelf** | Top-level organizational container for note collections |
| **Notebook** | Secondary organizational container within a shelf |
| **Page** | Single unit within a note document |
| **PDF.js** | Mozilla library for rendering PDF documents in browsers |
| **Tesseract.js** | Open-source JavaScript library for OCR |
| **Non-Destructive Editing** | Annotations stored separately from source document, preserving original |

---

**12\. Appendix: Technology Roadmap**

**Phase 1 (Months 1-6): Core Notes Functionality**

* ✓ Notes Mode UI and mode switching

* ✓ Handwriting capture with pressure sensitivity

* ✓ PDF import and page viewing

* ✓ PDF annotation (handwriting, highlight)

* ✓ Handwriting recognition (Tesseract.js)

* ✓ Page navigation and organization

* ✓ Export (PDF, PNG, Markdown)

**Phase 1.5 (Months 5-7): Import/Export Enhancement**

* ✓ Noteshelf document import

* ✓ OneNote notebook import (evaluation)

* ✓ Advanced export (SVG, ZIP archives)

* ✓ Cloud provider file picker (Google Drive, Dropbox)

**Phase 2 (Months 8-14): Collaboration & Intelligence**

* ✓ Cloud sync (Google Drive, iCloud, OneDrive)

* ✓ Real-time collaborative editing

* ✓ Comments and @mentions

* ✓ Audio recording alongside notes

* ✓ Advanced handwriting-to-text with confidence

* ✓ Translation and summarization AI features

**Phase 3 (Months 15+): Ecosystem Integration**

* ✓ REST API for external access

* ✓ IFTTT/Zapier integration

* ✓ Community plugin architecture

* ✓ Handwriting style library

* ✓ Custom notebook templates

---

**13\. References**

\[1\] Noteshelf. (2025). Noteshelf 3: AI Digital Notes. Retrieved from [https://www.noteshelf.net](https://www.noteshelf.net)

---

**Document Approval:**

| Role | Name | Date | Signature |
| :---- | :---- | :---- | :---- |
| Product Manager | \[TBD\] | \[TBD\] |  |
| Technical Lead | \[TBD\] | \[TBD\] |  |
| Engineering Manager | \[TBD\] | \[TBD\] |  |
| Design Lead | \[TBD\] | \[TBD\] |  |

---

**Document Version History:**

| Version | Date | Author | Changes |
| :---- | :---- | :---- | :---- |
| 0.5 | 2025-12-15 | Product Team | Initial draft \- core requirements |
| 0.8 | 2025-12-18 | Product Team | Added risk analysis, data models, architecture |
| 1.0 | 2025-12-19 | Product Team | Final review and approval ready |

---

**Next Steps:**

1. **Stakeholder Review** (1 week) \- Collect feedback from product, engineering, design teams

2. **Architecture Review** (1 week) \- Technical deep-dive on implementation approach

3. **Prototype Validation** (2 weeks) \- Build proof-of-concept for handwriting \+ PDF features

4. **Timeline Refinement** (1 week) \- Adjust Phase 1 schedule based on prototype learnings

5. **Engineering Kickoff** (Week 1 of Phase 1\) \- Begin implementation of core Notes Mode