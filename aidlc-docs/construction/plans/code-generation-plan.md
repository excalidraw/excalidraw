# Code Generation Plan

## Overview

This plan outlines the step-by-step implementation of the image-to-diagram conversion feature with AI configuration management for Excalidraw.

## Implementation Strategy

**Approach**: Bottom-up implementation
1. Core services first (data layer)
2. UI components second (presentation layer)
3. Integration with existing Excalidraw systems
4. Testing and validation

**Technology Stack** (from tech.md):
- React 19.0.0 with TypeScript 4.9.4
- Jotai 2.11.0 for state management (use app-specific modules)
- Existing @excalidraw/mermaid-to-excalidraw package
- Browser APIs: LocalStorage, FileReader, Clipboard API

---

## Phase 1: Core Services Implementation

### [ ] Step 1.1: Create AIConfigurationService
**File**: `packages/excalidraw/services/AIConfigurationService.ts`

**Implementation Details**:
- Create service class with methods for credential management
- Implement secure storage using browser LocalStorage with encryption
- Support 4 providers: OpenAI, Gemini, Claude, Ollama
- Implement connection testing for each provider
- Implement model fetching from provider APIs
- Add credential validation logic

**Key Methods**:
```typescript
- saveCredentials(provider, credentials)
- getCredentials(provider)
- deleteCredentials(provider)
- testConnection(provider)
- fetchAvailableModels(provider)
- setSelectedModel(provider, modelId)
- getSelectedModel(provider)
- isConfigured()
```

**Dependencies**: None (standalone service)

**Testing**: Unit tests with mocked LocalStorage and API calls

---

### [ ] Step 1.2: Create LLM Provider Adapters
**Files**: 
- `packages/excalidraw/services/llm/OpenAIAdapter.ts`
- `packages/excalidraw/services/llm/GeminiAdapter.ts`
- `packages/excalidraw/services/llm/ClaudeAdapter.ts`
- `packages/excalidraw/services/llm/OllamaAdapter.ts`

**Implementation Details**:
- Create base interface `LLMProviderAdapter`
- Implement adapter for each provider with provider-specific API calls
- Handle authentication, request formatting, and response parsing
- Implement error handling and retry logic
- Support vision model image analysis

**Key Methods**:
```typescript
interface LLMProviderAdapter {
  testConnection(credentials): Promise<ConnectionTestResult>
  fetchModels(credentials): Promise<ModelInfo[]>
  analyzeImage(credentials, image, prompt): Promise<string>
}
```

**Dependencies**: AIConfigurationService (for credentials)

**Testing**: Unit tests with mocked API responses

---

### [ ] Step 1.3: Create LLMVisionService
**File**: `packages/excalidraw/services/LLMVisionService.ts`

**Implementation Details**:
- Orchestrate LLM provider adapters
- Get active provider from AIConfigurationService
- Route requests to appropriate adapter
- Handle rate limiting and errors
- Implement retry logic with exponential backoff

**Key Methods**:
```typescript
- analyzeImage(image, options)
- validateConnection(provider)
- getActiveProvider()
```

**Dependencies**: AIConfigurationService, LLM Provider Adapters

**Testing**: Integration tests with mocked adapters

---

### [ ] Step 1.4: Create ImageProcessingService
**File**: `packages/excalidraw/services/ImageProcessingService.ts`

**Implementation Details**:
- Handle clipboard paste events
- Handle file upload from dialog
- Handle drag and drop
- Validate image formats (PNG, JPEG, SVG, WebP, GIF)
- Optimize images for LLM processing (resize, compress)
- Convert to base64 data URLs

**Key Methods**:
```typescript
- processClipboardImage(clipboardData)
- processUploadedFiles(files)
- processDragDropImage(dragData)
- validateImage(blob)
- optimizeForAnalysis(image)
```

**Dependencies**: Browser APIs (FileReader, Canvas API)

**Testing**: Unit tests with mocked File and Blob objects

---

### [ ] Step 1.5: Create MermaidValidationService
**File**: `packages/excalidraw/services/MermaidValidationService.ts`

**Implementation Details**:
- Parse mermaid syntax using existing mermaid parser
- Identify syntax errors with line numbers
- Suggest auto-corrections for common errors
- Validate diagram semantics

**Key Methods**:
```typescript
- validateSyntax(mermaidCode)
- suggestCorrections(code, errors)
- autoCorrect(code)
- getDiagramInfo(code)
```

**Dependencies**: Mermaid parser library

**Testing**: Unit tests with valid and invalid mermaid code samples

---

### [ ] Step 1.6: Create ConversionOrchestrationService
**File**: `packages/excalidraw/services/ConversionOrchestrationService.ts`

**Implementation Details**:
- Orchestrate the complete conversion pipeline
- Check if AI is configured before starting
- Coordinate ImageProcessingService → LLMVisionService → MermaidValidationService → mermaid-to-excalidraw
- Implement retry logic for failed LLM calls
- Provide progress callbacks
- Handle error recovery

**Key Methods**:
```typescript
- startConversion(image, options)
- getConversionStatus(sessionId)
- cancelConversion(sessionId)
- retryConversion(sessionId, options)
```

**Dependencies**: All services above + @excalidraw/mermaid-to-excalidraw

**Testing**: Integration tests with mocked services

---

## Phase 2: State Management

### [ ] Step 2.1: Create AI Configuration Atoms
**File**: `packages/excalidraw/app-jotai.ts` (add to existing file)

**Implementation Details**:
- Create Jotai atoms for AI configuration state
- Store configured providers
- Store selected provider and model
- Store configuration dialog open state

**Atoms**:
```typescript
- aiConfiguredProvidersAtom
- aiSelectedProviderAtom
- aiSelectedModelAtom
- aiConfigDialogOpenAtom
```

**Dependencies**: Jotai (use app-jotai module, not direct jotai import)

**Testing**: Unit tests for atom behavior

---

### [ ] Step 2.2: Create Image Conversion Atoms
**File**: `packages/excalidraw/app-jotai.ts` (add to existing file)

**Implementation Details**:
- Create atoms for conversion dialog state
- Store conversion progress
- Store conversion results
- Store error states

**Atoms**:
```typescript
- imageConversionDialogOpenAtom
- conversionProgressAtom
- conversionResultAtom
- conversionErrorAtom
```

**Dependencies**: Jotai (use app-jotai module)

**Testing**: Unit tests for atom behavior

---

## Phase 3: UI Components

### [ ] Step 3.1: Create AIConfigurationDialog Component
**File**: `packages/excalidraw/components/AIConfigurationDialog.tsx`

**Implementation Details**:
- Create dialog with tabs for each provider (OpenAI, Gemini, Claude, Ollama)
- Provider-specific credential input forms
- Test connection button with loading state
- Display available models after successful test
- Model selection dropdown
- Save/Cancel/Delete buttons
- Use existing Excalidraw dialog patterns and styling

**Props**:
```typescript
interface AIConfigurationDialogProps {
  isOpen: boolean
  onClose: () => void
}
```

**Dependencies**: AIConfigurationService, Jotai atoms, @radix-ui components

**Testing**: Component tests with React Testing Library

---

### [ ] Step 3.2: Create AIConfigurationButton Component
**File**: `packages/excalidraw/components/AIConfigurationButton.tsx`

**Implementation Details**:
- Toolbar button with icon
- Show visual indicator when not configured (warning badge)
- Open AIConfigurationDialog on click
- Follow existing toolbar button patterns

**Props**:
```typescript
interface AIConfigurationButtonProps {
  onClick: () => void
}
```

**Dependencies**: Jotai atoms for configuration status

**Testing**: Component tests

---

### [ ] Step 3.3: Create ImageInputHandler Component
**File**: `packages/excalidraw/components/ImageInputHandler.tsx`

**Implementation Details**:
- Handle paste events (Ctrl+V)
- Handle drag and drop onto canvas
- Trigger file upload dialog
- Display image preview
- Show upload progress

**Props**:
```typescript
interface ImageInputHandlerProps {
  onImageReceived: (image: ProcessedImage) => void
  onError: (error: Error) => void
}
```

**Dependencies**: ImageProcessingService

**Testing**: Component tests with mocked file inputs

---

### [ ] Step 3.4: Create ConversionPreviewPanel Component
**File**: `packages/excalidraw/components/ConversionPreviewPanel.tsx`

**Implementation Details**:
- Display generated mermaid code with syntax highlighting
- Show preview of converted excalidraw elements
- Editable code textarea
- Accept/Retry/Cancel buttons
- Toggle between code view and preview view

**Props**:
```typescript
interface ConversionPreviewPanelProps {
  mermaidCode: string
  onCodeChange: (code: string) => void
  onAccept: () => void
  onRetry: () => void
}
```

**Dependencies**: Mermaid preview renderer

**Testing**: Component tests

---

### [ ] Step 3.5: Create ImageToMermaidDialog Component
**File**: `packages/excalidraw/components/ImageToMermaidDialog.tsx`

**Implementation Details**:
- Main dialog orchestrating the conversion workflow
- Check if AI is configured, show prompt if not
- Integrate ImageInputHandler
- Show conversion progress
- Integrate ConversionPreviewPanel
- Handle conversion completion and insert into canvas

**Props**:
```typescript
interface ImageToMermaidDialogProps {
  isOpen: boolean
  onClose: () => void
}
```

**Dependencies**: All services, ImageInputHandler, ConversionPreviewPanel

**Testing**: Integration tests

---

## Phase 4: Actions and Integration

### [ ] Step 4.1: Create Configure AI Action
**File**: `packages/excalidraw/actions/actionAI.tsx` (new file)

**Implementation Details**:
- Register `actionConfigureAI` action
- Open AIConfigurationDialog
- Add to toolbar
- Follow existing action patterns

**Action Definition**:
```typescript
actionConfigureAI = {
  name: "configureAI",
  label: "Configure AI",
  icon: SettingsIcon,
  perform: (elements, appState) => ({
    appState: { ...appState, aiConfigDialogOpen: true }
  })
}
```

**Dependencies**: Action system, Jotai atoms

**Testing**: Action tests

---

### [ ] Step 4.2: Create Import Image Action
**File**: `packages/excalidraw/actions/actionAI.tsx` (add to same file)

**Implementation Details**:
- Register `actionImportImage` action
- Check if AI is configured
- Open ImageToMermaidDialog if configured
- Open AIConfigurationDialog if not configured
- Add keyboard shortcut (Ctrl+Shift+I)

**Action Definition**:
```typescript
actionImportImage = {
  name: "importImage",
  label: "Import Image to Diagram",
  icon: ImageImportIcon,
  keyTest: (event) => event.ctrlKey && event.shiftKey && event.key === 'I',
  perform: async (elements, appState) => {
    // Check configuration and open appropriate dialog
  }
}
```

**Dependencies**: Action system, AIConfigurationService, Jotai atoms

**Testing**: Action tests

---

### [ ] Step 4.3: Integrate with Toolbar
**File**: `packages/excalidraw/components/App.tsx` (modify existing)

**Implementation Details**:
- Add AIConfigurationButton to toolbar
- Add Import Image button to toolbar
- Position near existing import/export buttons
- Follow existing toolbar layout patterns

**Changes**:
- Import new components
- Add buttons to toolbar JSX
- Wire up click handlers to atoms

**Dependencies**: New components, actions

**Testing**: Visual regression tests

---

### [ ] Step 4.4: Integrate Dialogs with App
**File**: `packages/excalidraw/components/App.tsx` (modify existing)

**Implementation Details**:
- Render AIConfigurationDialog conditionally based on atom
- Render ImageToMermaidDialog conditionally based on atom
- Handle dialog close events
- Follow existing dialog integration patterns

**Changes**:
- Import new dialog components
- Add conditional rendering in JSX
- Wire up close handlers

**Dependencies**: Dialog components, Jotai atoms

**Testing**: Integration tests

---

## Phase 5: Mermaid Integration

### [ ] Step 5.1: Integrate with mermaid-to-excalidraw
**File**: `packages/excalidraw/utils/mermaidToExcalidraw.ts` (new wrapper)

**Implementation Details**:
- Create wrapper around @excalidraw/mermaid-to-excalidraw package
- Convert mermaid code to excalidraw elements
- Handle conversion errors
- Position elements appropriately on canvas

**Key Functions**:
```typescript
- convertMermaidToElements(mermaidCode, options)
- insertElementsIntoCanvas(elements, appState)
```

**Dependencies**: @excalidraw/mermaid-to-excalidraw

**Testing**: Integration tests with sample mermaid code

---

### [ ] Step 5.2: Handle Element Insertion
**File**: `packages/excalidraw/components/ImageToMermaidDialog.tsx` (update)

**Implementation Details**:
- After successful conversion, insert elements into canvas
- Position at center of viewport or cursor location
- Select newly inserted elements
- Close dialog after insertion
- Add to undo history

**Changes**:
- Call mermaid conversion wrapper
- Update app state with new elements
- Handle insertion errors

**Dependencies**: Mermaid wrapper, element utilities

**Testing**: Integration tests

---

## Phase 6: Error Handling and Polish

### [ ] Step 6.1: Implement Error Boundaries
**File**: `packages/excalidraw/components/ErrorBoundary.tsx` (use existing or create)

**Implementation Details**:
- Wrap AI components in error boundaries
- Display user-friendly error messages
- Provide retry options
- Log errors for debugging

**Dependencies**: React error boundaries

**Testing**: Error scenario tests

---

### [ ] Step 6.2: Add Loading States
**Files**: All dialog components (update)

**Implementation Details**:
- Show loading spinners during API calls
- Disable buttons during processing
- Show progress indicators for long operations
- Follow existing loading state patterns

**Changes**:
- Add loading state atoms
- Update UI to show loading indicators
- Disable interactions during loading

**Testing**: Visual tests

---

### [ ] Step 6.3: Add User Feedback Messages
**Files**: Dialog components (update)

**Implementation Details**:
- Success messages after configuration save
- Error messages with actionable suggestions
- Warning messages for missing configuration
- Use existing toast/notification system if available

**Changes**:
- Add toast notifications
- Display inline error messages
- Show validation feedback

**Testing**: User interaction tests

---

## Phase 7: Documentation and Examples

### [ ] Step 7.1: Add JSDoc Comments
**Files**: All service and component files (update)

**Implementation Details**:
- Add comprehensive JSDoc comments to all public methods
- Document parameters and return types
- Add usage examples
- Document error conditions

**Testing**: Documentation review

---

### [ ] Step 7.2: Create Usage Examples
**File**: `examples/image-to-diagram/` (new directory)

**Implementation Details**:
- Create example showing how to use the feature
- Document configuration steps
- Show different provider setups
- Include troubleshooting guide

**Testing**: Example validation

---

## Phase 8: Testing

### [ ] Step 8.1: Unit Tests for Services
**Files**: `packages/excalidraw/services/__tests__/` (new directory)

**Implementation Details**:
- Test AIConfigurationService with mocked LocalStorage
- Test LLM adapters with mocked API responses
- Test ImageProcessingService with mocked File objects
- Test MermaidValidationService with sample code
- Achieve >80% code coverage

**Testing Framework**: Vitest (from tech.md)

---

### [ ] Step 8.2: Component Tests
**Files**: `packages/excalidraw/components/__tests__/` (add to existing)

**Implementation Details**:
- Test all new components with React Testing Library
- Test user interactions (clicks, inputs, drag-drop)
- Test conditional rendering
- Test error states

**Testing Framework**: Vitest + @testing-library/react

---

### [ ] Step 8.3: Integration Tests
**Files**: `packages/excalidraw/__tests__/integration/` (new directory)

**Implementation Details**:
- Test complete conversion workflow
- Test configuration → conversion → insertion flow
- Test error recovery scenarios
- Test with different providers

**Testing Framework**: Vitest

---

### [ ] Step 8.4: Manual Testing Checklist
**File**: `aidlc-docs/construction/manual-testing-checklist.md` (new)

**Implementation Details**:
- Create checklist for manual testing
- Test with real LLM providers
- Test different image types and sizes
- Test error scenarios
- Test browser compatibility

---

## Implementation Order Summary

1. **Services Layer** (Steps 1.1-1.6) - Core business logic
2. **State Management** (Steps 2.1-2.2) - Application state
3. **UI Components** (Steps 3.1-3.5) - User interface
4. **Actions & Integration** (Steps 4.1-4.4) - Connect to Excalidraw
5. **Mermaid Integration** (Steps 5.1-5.2) - Diagram conversion
6. **Polish** (Steps 6.1-6.3) - Error handling and UX
7. **Documentation** (Steps 7.1-7.2) - Code docs and examples
8. **Testing** (Steps 8.1-8.4) - Comprehensive testing

---

## Key Integration Points

### Existing Excalidraw Patterns to Follow:
1. **State Management**: Use `app-jotai.ts`, never import from `jotai` directly
2. **Import Order**: Follow ESLint rules for import organization
3. **Type Imports**: Use `@typescript-eslint/consistent-type-imports`
4. **Path Aliases**: Use `@excalidraw/*` for internal packages
5. **Component Style**: Follow existing component patterns in `packages/excalidraw/components/`
6. **Action System**: Follow patterns in `packages/excalidraw/actions/`

### Files to Reference:
- `packages/excalidraw/components/TTDDialog/TTDDialog.tsx` - Dialog patterns
- `packages/excalidraw/actions/` - Action registration patterns
- `packages/excalidraw/app-jotai.ts` - State management patterns
- `packages/excalidraw/components/App.tsx` - Main app integration

---

## Success Criteria

- [ ] All services implemented and tested
- [ ] All UI components implemented and tested
- [ ] Feature integrated into Excalidraw toolbar
- [ ] Configuration persists in LocalStorage
- [ ] Image conversion works with all 4 providers
- [ ] Error handling provides clear user feedback
- [ ] No impact on existing Excalidraw functionality
- [ ] Code follows Excalidraw conventions and passes linting
- [ ] Documentation complete
- [ ] Tests pass with >80% coverage

---

## Estimated Effort

- **Phase 1 (Services)**: 8-10 hours
- **Phase 2 (State)**: 2-3 hours
- **Phase 3 (UI)**: 10-12 hours
- **Phase 4 (Integration)**: 4-5 hours
- **Phase 5 (Mermaid)**: 3-4 hours
- **Phase 6 (Polish)**: 3-4 hours
- **Phase 7 (Docs)**: 2-3 hours
- **Phase 8 (Testing)**: 6-8 hours

**Total**: 38-49 hours of development time
