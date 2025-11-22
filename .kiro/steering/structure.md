# Project Organization & Structure

## Repository Layout

```
excalidraw/
├── .github/                    # GitHub workflows and templates
├── .husky/                     # Git hooks configuration
├── excalidraw-app/            # Web application (excalidraw.com)
├── packages/                   # Monorepo packages
│   ├── common/                # Shared utilities and constants
│   ├── element/               # Element manipulation logic
│   ├── math/                  # Mathematical operations
│   ├── utils/                 # Utility functions
│   └── excalidraw/           # Main React component library
├── examples/                   # Integration examples
│   ├── with-nextjs/          # Next.js integration
│   └── with-script-in-browser/ # Vanilla JS integration
├── scripts/                    # Build and release scripts
├── dev-docs/                  # Development documentation (Docusaurus)
├── firebase-project/          # Firebase configuration
└── public/                    # Static assets
```

## Package Dependencies

```
excalidraw (main package)
├── depends on: common, element, math, utils
├── exports: React component + CSS

element
├── depends on: common, math
├── exports: Element manipulation functions

math
├── depends on: common
├── exports: Vector operations, geometry utils

utils
├── depends on: various external libs
├── exports: Utility functions (standalone)

common
├── no internal dependencies
├── exports: Constants, shared utilities
```

## Key Directories

### `/packages/excalidraw/` (Main Library)
- `components/` - React UI components
- `actions/` - User action handlers
- `scene/` - Scene management
- `renderer/` - Canvas rendering logic
- `data/` - Data persistence and serialization
- `locales/` - Internationalization files
- `css/` - Styling and themes

### `/excalidraw-app/` (Web Application)
- `components/` - App-specific components
- `collab/` - Real-time collaboration
- `data/` - Firebase integration
- `share/` - Sharing functionality

### `/packages/element/src/`
- Element creation, manipulation, and utilities
- Collision detection, bounds calculation
- Text handling and measurements

### `/packages/math/src/`
- Vector operations and geometric calculations
- Point manipulation and transformations

### `/packages/common/src/`
- Shared constants and enums
- Common utility functions
- Type definitions

## File Naming Conventions

- **Components**: PascalCase (e.g., `LayerUI.tsx`, `ToolButton.tsx`)
- **Utilities**: camelCase (e.g., `exportUtils.ts`, `sceneUtils.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `APP_NAME`, `DEFAULT_EXPORT_PADDING`)
- **Types**: PascalCase with descriptive names (e.g., `ExcalidrawElement`, `AppState`)

## Import/Export Patterns

### Internal Package Imports
```typescript
// Use path aliases for internal packages
import { KEYS } from "@excalidraw/common";
import { newElement } from "@excalidraw/element";
import { rotate } from "@excalidraw/math";
```

### Component Organization
- Each major component in its own file
- Related components grouped in directories
- Shared components in `/components/` root
- Feature-specific components in subdirectories

### State Management
- Use app-specific Jotai modules (`editor-jotai.ts`, `app-jotai.ts`)
- Never import directly from `jotai` package
- Atoms organized by feature/domain

## Testing Structure

- Tests co-located with source files (`.test.ts`, `.test.tsx`)
- Shared test utilities in `/tests/` directories
- Snapshot tests in `__snapshots__/` directories
- Integration tests in dedicated test files

## Configuration Files

- **Root level**: Workspace configuration (package.json, tsconfig.json)
- **Package level**: Individual package configs
- **Build**: Custom scripts in `/scripts/` directory
- **CI/CD**: GitHub Actions in `.github/workflows/`

## Documentation

- **API docs**: Generated from TypeScript definitions
- **Dev docs**: Docusaurus site in `/dev-docs/`
- **Examples**: Working examples in `/examples/`
- **README**: Package-specific documentation in each package