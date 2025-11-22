# Component Inventory

## Application Packages
- **excalidraw-app** - Full-featured web application with collaboration features

## Core Packages
- **@excalidraw/excalidraw** - Main React component library (drawing functionality)
- **@excalidraw/element** - Element manipulation logic and utilities
- **@excalidraw/math** - Mathematical functions and vector operations
- **@excalidraw/common** - Shared utilities and constants
- **@excalidraw/utils** - Utility functions (file handling, image processing)

## Integration Packages
- **examples/with-nextjs** - Next.js integration example
- **examples/with-script-in-browser** - Vanilla JavaScript integration example

## Documentation Packages
- **dev-docs** - Docusaurus documentation site

## Infrastructure Packages
- **scripts** - Build and release automation scripts
- **firebase-project** - Firebase configuration for collaboration features

## Key External Dependencies

### Drawing & Rendering
- **roughjs** - Hand-drawn style rendering engine
- **perfect-freehand** - Smooth freehand drawing
- **points-on-curve** - Curve point calculations

### UI & State Management
- **jotai** - Atomic state management
- **@radix-ui/react-popover** - Accessible popover components
- **@radix-ui/react-tabs** - Tab components

### File & Image Processing
- **browser-fs-access** - File system access API
- **pica** - Image resizing and processing
- **image-blob-reduce** - Image compression
- **pako** - Data compression

### Mermaid Integration
- **@excalidraw/mermaid-to-excalidraw** - Converts Mermaid diagrams to Excalidraw elements

### Utilities
- **lodash.throttle** - Function throttling
- **lodash.debounce** - Function debouncing
- **nanoid** - Unique ID generation
- **clsx** - Conditional CSS class names

## Total Count
- **Total Packages**: 11
- **Application**: 1 (excalidraw-app)
- **Core Library**: 5 (excalidraw + 4 supporting packages)
- **Examples**: 2
- **Documentation**: 1
- **Infrastructure**: 2 (scripts, firebase-project)