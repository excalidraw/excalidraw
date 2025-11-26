# AI Features Integration Guide

## Overview

This package includes AI-powered image-to-diagram conversion features for Excalidraw. Users can upload diagram images and convert them to editable Excalidraw elements using LLM vision models.

## Supported Providers

- **OpenAI** - GPT-4 Vision, GPT-4 Omni
- **Google Gemini** - Gemini Pro Vision, Gemini 1.5 Pro/Flash
- **AWS Claude (Bedrock)** - Claude 3 Opus, Sonnet, Haiku, 3.5 Sonnet
- **Ollama** - Local models (llava, bakllava, etc.)

## Quick Integration

### Option 1: Use AIFeatureIntegration Component

```tsx
import { AIFeatureIntegration } from "@excalidraw/excalidraw/ai-features";

function MyApp() {
  return (
    <div>
      <Excalidraw
        // ... your props
      />
      <AIFeatureIntegration
        elements={elements}
        appState={appState}
        onElementsChange={setElements}
        onAppStateChange={setAppState}
      />
    </div>
  );
}
```

### Option 2: Add Toolbar Buttons

```tsx
import { AIConfigButton, ImageImportButton } from "@excalidraw/excalidraw/ai-features";

// In your toolbar component
<AIConfigButton />
<ImageImportButton />
```

### Option 3: Use Actions

```tsx
import { actionConfigureAI, actionImportImage } from "@excalidraw/excalidraw/ai-features";

// Actions are automatically registered
// Keyboard shortcuts:
// - Ctrl+Shift+A: Configure AI
// - Ctrl+Shift+I: Import Image
```

## Manual Integration

### 1. Add Dialogs to Your App

```tsx
import {
  AIConfigurationDialog,
  ImageToMermaidDialog,
} from "@excalidraw/excalidraw/ai-features";

function MyApp() {
  const handleInsertMermaid = async (mermaidCode: string) => {
    const { convertMermaidToElements, insertElementsIntoCanvas } = await import(
      "@excalidraw/excalidraw/ai-features"
    );

    const newElements = await convertMermaidToElements(mermaidCode);
    const { elements: updated, appState: updatedState } = insertElementsIntoCanvas(
      newElements,
      appState,
      elements
    );

    setElements(updated);
    setAppState(updatedState);
  };

  return (
    <>
      <Excalidraw />
      <AIConfigurationDialog />
      <ImageToMermaidDialog onInsertMermaid={handleInsertMermaid} />
    </>
  );
}
```

### 2. Control Dialog State

```tsx
import { useAtom } from "jotai";
import {
  aiConfigDialogOpenAtom,
  imageToMermaidDialogOpenAtom,
} from "@excalidraw/excalidraw/ai-features";

function MyComponent() {
  const [configOpen, setConfigOpen] = useAtom(aiConfigDialogOpenAtom);
  const [importOpen, setImportOpen] = useAtom(imageToMermaidDialogOpenAtom);

  return (
    <>
      <button onClick={() => setConfigOpen(true)}>Configure AI</button>
      <button onClick={() => setImportOpen(true)}>Import Image</button>
    </>
  );
}
```

## User Workflow

### First-Time Setup

1. User clicks "Configure AI" button
2. Selects provider tab (OpenAI/Gemini/Claude/Ollama)
3. Enters credentials:
   - **OpenAI**: API key
   - **Gemini**: API key
   - **Claude**: AWS Client ID, Secret, Region
   - **Ollama**: Endpoint URL (e.g., http://localhost:11434)
4. Clicks "Test Connection"
5. Selects model from dropdown
6. Clicks "Save & Use This Model"

### Converting Images

1. User clicks "Import Image" button (or Ctrl+Shift+I)
2. Uploads image or pastes from clipboard (Ctrl+V)
3. Clicks "Convert to Diagram"
4. AI analyzes image and generates mermaid code
5. User reviews/edits generated code
6. Clicks "Insert into Canvas"
7. Diagram appears as editable Excalidraw elements

## API Usage

### Check Configuration Status

```tsx
import { aiConfigService } from "@excalidraw/excalidraw/ai-features";

const isConfigured = await aiConfigService.isConfigured();
const status = await aiConfigService.getConfigurationStatus();
```

### Programmatic Conversion

```tsx
import {
  imageProcessingService,
  conversionOrchestrationService,
} from "@excalidraw/excalidraw/ai-features";

// Process image
const processedImage = await imageProcessingService.processUploadedFiles(files);

// Convert to mermaid
const mermaidCode = await conversionOrchestrationService.startConversion(
  processedImage[0],
  {
    progressCallback: (status) => console.log(status.message),
  }
);
```

## Styling

The components use CSS custom properties for theming. Ensure these variables are defined:

```css
:root {
  --color-primary: #6965db;
  --color-primary-dark: #5753c6;
  --color-primary-light: rgba(105, 101, 219, 0.1);
  --color-gray-10: #f5f5f5;
  --color-gray-20: #e0e0e0;
  --color-gray-30: #d0d0d0;
  --color-gray-60: #757575;
  --color-gray-80: #424242;
  --color-surface-primary: #ffffff;
  --color-text-primary: #1e1e1e;
  --color-success: #4caf50;
  --color-success-light: #e8f5e9;
  --color-success-dark: #2e7d32;
  --color-danger: #f44336;
  --color-danger-light: #ffebee;
  --color-danger-dark: #c62828;
}
```

## Security Notes

- Credentials are stored in browser LocalStorage with basic encryption
- No credentials are sent to any server except the configured LLM provider
- Users are responsible for their own API keys and costs
- For production, consider implementing additional security measures

## Troubleshooting

### "No AI provider configured" error
- User needs to configure at least one provider first
- Open AI Configuration dialog and complete setup

### "Connection failed" error
- Check API credentials are correct
- Verify network connectivity
- For Ollama, ensure service is running locally

### "Failed to convert diagram" error
- Image may be too complex or unclear
- Try with a clearer/simpler diagram
- Check LLM provider has vision capabilities

### Mermaid syntax errors
- The service includes auto-correction
- Users can manually edit generated code
- Retry conversion with different settings

## Dependencies

Required packages:
- `@excalidraw/mermaid-to-excalidraw` - For mermaid conversion
- `jotai` - For state management (use app-specific modules)
- `react` - React 19.0.0+

## License

MIT - Same as Excalidraw

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the implementation summary in `aidlc-docs/construction/IMPLEMENTATION_SUMMARY.md`
3. Open an issue on GitHub

## Credits

Built using the AI-DLC (AI-Driven Development Life Cycle) workflow.
