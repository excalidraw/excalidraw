# Component Architecture

## Component Overview

The image-to-diagram conversion feature will integrate with Excalidraw's existing architecture through several new components and modifications to existing ones.

## New Components

### ImageToMermaidConverter
**Purpose**: Core component that orchestrates the image-to-mermaid conversion pipeline
**Responsibilities**:
- Manage image input from multiple sources (paste, upload, drag & drop)
- Interface with configurable LLM services
- Handle mermaid code generation and validation
- Manage conversion state and error handling
- Coordinate with existing mermaid-to-excalidraw integration

**Interfaces**:
```typescript
interface ImageToMermaidConverterProps {
  onConversionComplete: (mermaidCode: string) => void;
  onError: (error: Error) => void;
  config: LLMServiceConfig;
}
```

### ImageInputHandler
**Purpose**: Handle multiple image input methods
**Responsibilities**:
- Process clipboard paste events
- Handle file upload dialog
- Manage drag and drop functionality
- Validate image formats and size limits
- Convert images to appropriate format for LLM processing

**Interfaces**:
```typescript
interface ImageInputHandlerProps {
  onImageReceived: (imageData: ImageData) => void;
  supportedFormats: string[];
  maxFileSize: number;
}

interface ImageData {
  blob: Blob;
  dataUrl: string;
  format: string;
  size: number;
}
```

### LLMServiceManager
**Purpose**: Abstract interface for different LLM vision services
**Responsibilities**:
- Provide unified interface for multiple LLM providers
- Handle service-specific authentication and configuration
- Manage rate limiting and error handling
- Support both online and offline models

**Interfaces**:
```typescript
interface LLMServiceManager {
  analyzeImage(imageData: ImageData, prompt?: string): Promise<string>;
  validateMermaidCode(code: string): Promise<boolean>;
  refineMermaidCode(code: string, error: string): Promise<string>;
}

interface LLMServiceConfig {
  provider: 'openai' | 'ollama' | 'custom';
  apiKey?: string;
  endpoint?: string;
  model?: string;
  offline?: boolean;
}
```

### ImageToMermaidDialog
**Purpose**: UI dialog for the image-to-mermaid conversion workflow
**Responsibilities**:
- Provide image input interface
- Display conversion progress and status
- Show preview of generated mermaid code
- Allow editing of generated code before conversion
- Handle user preferences and configuration

**Interfaces**:
```typescript
interface ImageToMermaidDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConvert: (mermaidCode: string) => void;
  config: UserPreferences;
}
```

### ConversionPreviewPanel
**Purpose**: Preview and editing interface for generated mermaid code
**Responsibilities**:
- Display generated mermaid code with syntax highlighting
- Provide editing capabilities
- Show preview of converted excalidraw elements
- Handle accept/retry/edit actions

**Interfaces**:
```typescript
interface ConversionPreviewPanelProps {
  mermaidCode: string;
  onCodeChange: (code: string) => void;
  onAccept: () => void;
  onRetry: () => void;
  previewMode: 'code' | 'preview' | 'both';
}
```

## Modified Components

### Actions (Toolbar Integration)
**Modifications**: Add new "Import Image" action to the toolbar
**New Action**:
```typescript
const actionImportImage = register({
  name: "importImage",
  label: "Import Image to Diagram",
  icon: ImageImportIcon,
  trackEvent: { category: "import", action: "image" },
  perform: async (elements, appState, _, app) => {
    return {
      appState: {
        ...appState,
        openDialog: { name: "imageToMermaid" }
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.I,
});
```

### App State
**Modifications**: Extend app state to support image-to-mermaid dialog
**New State Properties**:
```typescript
interface AppState {
  // ... existing properties
  openDialog: 
    | { name: "ttd"; tab: "text-to-diagram" | "mermaid" }
    | { name: "imageToMermaid" }
    | null;
  
  imageToMermaidConfig: {
    llmService: LLMServiceConfig;
    previewMode: 'direct' | 'preview';
    maxRetries: number;
  };
}
```

### TTDDialog Integration
**Modifications**: Extend existing TTD dialog to include image import tab
**New Tab**: Add "Image Import" tab alongside existing "Text to Diagram" and "Mermaid" tabs

## Component Dependencies

```mermaid
graph TD
    A[ImageToMermaidDialog] --> B[ImageInputHandler]
    A --> C[ImageToMermaidConverter]
    A --> D[ConversionPreviewPanel]
    
    C --> E[LLMServiceManager]
    C --> F[MermaidValidator]
    C --> G[ExistingMermaidToExcalidraw]
    
    B --> H[FileAPI]
    B --> I[ClipboardAPI]
    B --> J[DragDropAPI]
    
    E --> K[OpenAIService]
    E --> L[OllamaService]
    E --> M[CustomLLMService]
    
    A --> N[ExistingTTDDialog]
    A --> O[ExistingActionSystem]
```

## Integration Points

### With Existing Mermaid System
- Reuse existing `@excalidraw/mermaid-to-excalidraw` package
- Integrate with existing TTDDialog structure
- Leverage existing mermaid validation and conversion logic

### With Action System
- Register new `actionImportImage` action
- Integrate with existing keyboard shortcuts system
- Follow existing action patterns for state management

### With File Handling
- Leverage existing `browser-fs-access` for file operations
- Use existing image processing utilities from `data/image.ts`
- Follow existing patterns for binary file handling

### With State Management
- Use existing Jotai atoms for state management
- Follow existing patterns for dialog state
- Integrate with existing app state structure

## Error Handling Strategy

### Component-Level Error Boundaries
- Each major component has its own error handling
- Graceful degradation when services are unavailable
- User-friendly error messages with actionable suggestions

### Service-Level Error Handling
- Retry logic for transient failures
- Fallback options when primary service fails
- Rate limiting and quota management

### User Experience Error Handling
- Clear progress indicators during processing
- Ability to cancel long-running operations
- Option to manually edit generated code when automatic generation fails