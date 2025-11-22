# Component Dependencies

## Dependency Matrix

| Component | Depends On | Dependency Type | Reason |
|-----------|------------|-----------------|---------|
| ImageToMermaidDialog | ImageInputHandler | Composition | Handles image input UI |
| ImageToMermaidDialog | ConversionPreviewPanel | Composition | Shows conversion results |
| ImageToMermaidDialog | ConversionOrchestrationService | Service | Manages conversion pipeline |
| ImageInputHandler | ImageProcessingService | Service | Processes uploaded images |
| ImageInputHandler | Browser APIs | External | File, Clipboard, DragDrop APIs |
| ConversionPreviewPanel | MermaidValidationService | Service | Validates mermaid syntax |
| ConversionPreviewPanel | @excalidraw/mermaid-to-excalidraw | External | Converts to excalidraw elements |
| ConversionOrchestrationService | LLMVisionService | Service | Analyzes images with LLM |
| ConversionOrchestrationService | MermaidValidationService | Service | Validates generated code |
| ConversionOrchestrationService | ImageProcessingService | Service | Processes input images |
| LLMVisionService | HTTP Client | External | Makes API calls to LLM services |
| ImageProcessingService | Canvas API | External | Image manipulation and conversion |
| MermaidValidationService | Mermaid Parser | External | Validates mermaid syntax |
| actionImportImage | ImageToMermaidDialog | UI | Opens conversion dialog |
| TTDDialog | ImageToMermaidDialog | Integration | Adds image import tab |

## Dependency Graph

```mermaid
graph TD
    subgraph "UI Layer"
        A[ImageToMermaidDialog]
        B[ConversionPreviewPanel]
        C[ImageInputHandler]
        D[TTDDialog]
        E[actionImportImage]
    end
    
    subgraph "Service Layer"
        F[ConversionOrchestrationService]
        G[LLMVisionService]
        H[ImageProcessingService]
        I[MermaidValidationService]
    end
    
    subgraph "External Dependencies"
        J[Browser APIs]
        K[HTTP Client]
        L[@excalidraw/mermaid-to-excalidraw]
        M[Mermaid Parser]
        N[Canvas API]
    end
    
    subgraph "Existing Excalidraw"
        O[Action System]
        P[App State]
        Q[Dialog System]
    end
    
    A --> C
    A --> B
    A --> F
    E --> A
    D --> A
    
    C --> H
    B --> I
    B --> L
    F --> G
    F --> H
    F --> I
    
    C --> J
    G --> K
    H --> N
    I --> M
    
    E --> O
    A --> P
    A --> Q
```

## Communication Patterns

### Event-Driven Communication
Components communicate through events and callbacks to maintain loose coupling:

```typescript
// Image input events
interface ImageInputEvents {
  onImageReceived: (imageData: ImageData) => void;
  onInputError: (error: Error) => void;
  onInputProgress: (progress: number) => void;
}

// Conversion events
interface ConversionEvents {
  onConversionStart: (sessionId: string) => void;
  onConversionProgress: (status: ConversionStatus) => void;
  onConversionComplete: (result: ConversionResult) => void;
  onConversionError: (error: ConversionError) => void;
}

// Preview events
interface PreviewEvents {
  onCodeChange: (code: string) => void;
  onPreviewReady: (elements: ExcalidrawElement[]) => void;
  onUserAction: (action: 'accept' | 'retry' | 'edit') => void;
}
```

### Service Injection Pattern
Services are injected into components to enable testing and configuration:

```typescript
interface ServiceContainer {
  llmVisionService: LLMVisionService;
  imageProcessingService: ImageProcessingService;
  mermaidValidationService: MermaidValidationService;
  conversionOrchestrationService: ConversionOrchestrationService;
}

// Component receives services through props or context
const ImageToMermaidDialog: React.FC<{
  services: ServiceContainer;
  config: UserPreferences;
}> = ({ services, config }) => {
  // Component implementation
};
```

### State Management Integration
Components integrate with Excalidraw's existing Jotai-based state management:

```typescript
// New atoms for image-to-mermaid feature
const imageToMermaidConfigAtom = atom<ImageToMermaidConfig>({
  llmService: { provider: 'openai', model: 'gpt-4-vision-preview' },
  previewMode: 'preview',
  maxRetries: 3
});

const conversionSessionAtom = atom<ConversionSession | null>(null);

const imageToMermaidDialogAtom = atom<boolean>(false);

// Usage in components
const ImageToMermaidDialog = () => {
  const [config] = useAtom(imageToMermaidConfigAtom);
  const [session, setSession] = useAtom(conversionSessionAtom);
  const [isOpen, setIsOpen] = useAtom(imageToMermaidDialogAtom);
  
  // Component logic
};
```

## Data Flow Patterns

### Unidirectional Data Flow
Data flows down through props and events flow up through callbacks:

```typescript
// Parent component manages state
const ImageToMermaidDialog = () => {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [mermaidCode, setMermaidCode] = useState<string>('');
  const [conversionStatus, setConversionStatus] = useState<ConversionStatus>('idle');
  
  return (
    <div>
      <ImageInputHandler 
        onImageReceived={setImageData}
        supportedFormats={config.supportedFormats}
      />
      
      <ConversionPreviewPanel
        mermaidCode={mermaidCode}
        onCodeChange={setMermaidCode}
        status={conversionStatus}
      />
    </div>
  );
};
```

### Service-to-Component Communication
Services communicate with components through callbacks and promises:

```typescript
// Service method with callback
const conversionService = {
  async convertImage(
    imageData: ImageData,
    options: ConversionOptions,
    progressCallback: (status: ConversionStatus) => void
  ): Promise<string> {
    progressCallback({ stage: 'processing', progress: 0 });
    
    const processedImage = await imageProcessingService.process(imageData);
    progressCallback({ stage: 'analyzing', progress: 30 });
    
    const mermaidCode = await llmVisionService.analyzeImage(processedImage);
    progressCallback({ stage: 'validating', progress: 70 });
    
    const validatedCode = await mermaidValidationService.validate(mermaidCode);
    progressCallback({ stage: 'complete', progress: 100 });
    
    return validatedCode;
  }
};
```

## Integration with Existing Excalidraw Architecture

### Action System Integration
New actions follow existing patterns and integrate with the action manager:

```typescript
// Register new action following existing pattern
export const actionImportImage = register({
  name: "importImage",
  label: "Import Image to Diagram",
  icon: ImageImportIcon,
  trackEvent: { category: "import", action: "image" },
  perform: async (elements, appState, _, app) => {
    // Action implementation
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

// Add to existing actions export
export { actionImportImage } from "./actionImportImage";
```

### Dialog System Integration
New dialog extends existing dialog patterns:

```typescript
// Extend existing dialog types
type ExcalidrawDialog = 
  | { name: "ttd"; tab: "text-to-diagram" | "mermaid" }
  | { name: "imageToMermaid" }
  | { name: "export" }
  | null;

// Dialog component follows existing patterns
const ImageToMermaidDialog = () => {
  const appState = useUIAppState();
  
  if (appState.openDialog?.name !== "imageToMermaid") {
    return null;
  }
  
  return (
    <Dialog
      className="image-to-mermaid-dialog"
      onCloseRequest={() => app.setOpenDialog(null)}
      size={1200}
      title="Import Image to Diagram"
    >
      {/* Dialog content */}
    </Dialog>
  );
};
```

### Mermaid Integration
Leverages existing mermaid-to-excalidraw integration:

```typescript
// Use existing mermaid conversion utilities
import { convertMermaidToExcalidraw } from "../TTDDialog/common";

const convertToExcalidraw = async (mermaidCode: string) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const data = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({ elements: [], files: null });
  
  await convertMermaidToExcalidraw({
    canvasRef,
    data,
    mermaidToExcalidrawLib,
    setError,
    mermaidDefinition: mermaidCode,
  });
  
  return data.current.elements;
};
```

## Dependency Injection and Testing

### Service Container Pattern
```typescript
// Service container for dependency injection
class ServiceContainer {
  private services = new Map<string, any>();
  
  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }
  
  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    return service;
  }
}

// React context for service injection
const ServiceContext = React.createContext<ServiceContainer | null>(null);

export const useService = <T>(name: string): T => {
  const container = useContext(ServiceContext);
  if (!container) {
    throw new Error('ServiceContext not found');
  }
  return container.get<T>(name);
};
```

### Mock Services for Testing
```typescript
// Mock implementations for testing
class MockLLMVisionService implements LLMVisionService {
  async analyzeImage(image: ImageBlob): Promise<AnalysisResult> {
    return {
      mermaidCode: 'flowchart TD\n  A --> B',
      confidence: 0.95,
      processingTime: 100
    };
  }
}

// Test setup
const createTestContainer = (): ServiceContainer => {
  const container = new ServiceContainer();
  container.register('llmVisionService', new MockLLMVisionService());
  container.register('imageProcessingService', new MockImageProcessingService());
  return container;
};
```

## Error Propagation and Handling

### Error Boundary Pattern
```typescript
// Error boundary for image-to-mermaid feature
class ImageToMermaidErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ImageToMermaid error:', error, errorInfo);
    trackEvent('error', 'image-to-mermaid', error.message);
  }
  
  render() {
    if (this.state.hasError) {
      return <ImageToMermaidErrorFallback error={this.state.error} />;
    }
    
    return this.props.children;
  }
}
```

### Service Error Handling
```typescript
// Centralized error handling for services
class ServiceErrorHandler {
  static handle(error: Error, context: string): void {
    console.error(`Service error in ${context}:`, error);
    
    if (error instanceof NetworkError) {
      // Handle network errors
      showToast('Network error. Please check your connection.');
    } else if (error instanceof RateLimitError) {
      // Handle rate limiting
      showToast('Rate limit exceeded. Please try again later.');
    } else if (error instanceof ValidationError) {
      // Handle validation errors
      showToast('Invalid input. Please check your data.');
    } else {
      // Handle unknown errors
      showToast('An unexpected error occurred. Please try again.');
    }
  }
}
```