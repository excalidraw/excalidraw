# 🧪 AI Features - Testing Guide

## ✅ Implementation Verification

### Files Created: 23 ✓

#### Services (10 files) ✓
- ✅ `packages/excalidraw/services/AIConfigurationService.ts`
- ✅ `packages/excalidraw/services/LLMVisionService.ts`
- ✅ `packages/excalidraw/services/ImageProcessingService.ts`
- ✅ `packages/excalidraw/services/MermaidValidationService.ts`
- ✅ `packages/excalidraw/services/ConversionOrchestrationService.ts`
- ✅ `packages/excalidraw/services/llm/LLMProviderAdapter.ts`
- ✅ `packages/excalidraw/services/llm/OpenAIAdapter.ts`
- ✅ `packages/excalidraw/services/llm/GeminiAdapter.ts`
- ✅ `packages/excalidraw/services/llm/ClaudeAdapter.ts`
- ✅ `packages/excalidraw/services/llm/OllamaAdapter.ts`

#### Components (6 files) ✓
- ✅ `packages/excalidraw/components/AIConfigurationDialog.tsx`
- ✅ `packages/excalidraw/components/AIConfigurationDialog.scss`
- ✅ `packages/excalidraw/components/ImageToMermaidDialog.tsx`
- ✅ `packages/excalidraw/components/ImageToMermaidDialog.scss`
- ✅ `packages/excalidraw/components/AIFeatureIntegration.tsx`
- ✅ `packages/excalidraw/components/AIToolbarButtons.tsx`

#### Integration (4 files) ✓
- ✅ `packages/excalidraw/actions/actionAI.tsx`
- ✅ `packages/excalidraw/utils/mermaidToExcalidraw.ts`
- ✅ `packages/excalidraw/ai-features.ts`
- ✅ `excalidraw-app/app-jotai.ts` (updated with atoms)

#### Documentation (3 files) ✓
- ✅ `packages/excalidraw/AI_FEATURES_README.md`
- ✅ `AI_FEATURES_PRODUCTION_READY.md`
- ✅ `aidlc-docs/construction/IMPLEMENTATION_SUMMARY.md`

---

## 🚀 How to Test in UI

### Step 1: Build the Project

```bash
# Install dependencies (if not already done)
yarn install

# Build all packages
yarn build:packages

# Or build just excalidraw package
yarn build:excalidraw
```

### Step 2: Start Development Server

```bash
# Start the development server
yarn start
```

This will start the Excalidraw app at `http://localhost:3000`

### Step 3: Integrate AI Features

You need to add the AI components to the Excalidraw app. Here's how:

#### Option A: Quick Test Integration

Create a test file: `excalidraw-app/AITestIntegration.tsx`

```tsx
import React from "react";
import { AIFeatureIntegration } from "../packages/excalidraw/components/AIFeatureIntegration";
import { AIConfigButton, ImageImportButton } from "../packages/excalidraw/components/AIToolbarButtons";

export const AITestIntegration = ({ elements, appState, onElementsChange, onAppStateChange }) => {
  return (
    <>
      {/* Dialogs */}
      <AIFeatureIntegration
        elements={elements}
        appState={appState}
        onElementsChange={onElementsChange}
        onAppStateChange={onAppStateChange}
      />
      
      {/* Toolbar Buttons - Add these to your toolbar */}
      <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 9999, display: 'flex', gap: '8px' }}>
        <AIConfigButton />
        <ImageImportButton />
      </div>
    </>
  );
};
```

Then import and use it in `excalidraw-app/App.tsx`:

```tsx
import { AITestIntegration } from "./AITestIntegration";

// Inside your App component, add:
<AITestIntegration
  elements={elements}
  appState={appState}
  onElementsChange={setElements}
  onAppStateChange={setAppState}
/>
```

#### Option B: Manual Testing via Browser Console

If you don't want to modify the app, you can test services directly in browser console:

```javascript
// Open browser console (F12)

// Import services
const { aiConfigService, llmVisionService } = await import('/packages/excalidraw/ai-features.ts');

// Test configuration
await aiConfigService.isConfigured();

// Save test credentials (OpenAI example)
await aiConfigService.saveCredentials('openai', { apiKey: 'sk-...' });

// Check status
await aiConfigService.getConfigurationStatus();
```

---

## 🧪 Testing Checklist

### Phase 1: Configuration Testing

#### Test OpenAI Configuration
1. ✅ Click "Configure AI" button (or press Ctrl+Shift+A)
2. ✅ Select "OpenAI" tab
3. ✅ Enter API key: `sk-...` (get from https://platform.openai.com/api-keys)
4. ✅ Click "Test Connection"
5. ✅ Verify success message appears
6. ✅ Verify models dropdown shows: GPT-4 Vision, GPT-4 Omni, GPT-4 Omni Mini
7. ✅ Select a model
8. ✅ Click "Save & Use This Model"
9. ✅ Verify dialog closes

#### Test Gemini Configuration
1. ✅ Click "Configure AI" button
2. ✅ Select "Gemini" tab
3. ✅ Enter API key: `AIza...` (get from https://makersuite.google.com/app/apikey)
4. ✅ Click "Test Connection"
5. ✅ Verify success message
6. ✅ Verify models dropdown shows: Gemini Pro Vision, Gemini 1.5 Pro, Gemini 1.5 Flash
7. ✅ Select a model
8. ✅ Click "Save & Use This Model"

#### Test Claude/AWS Configuration
1. ✅ Click "Configure AI" button
2. ✅ Select "Claude (AWS)" tab
3. ✅ Enter AWS Client ID: `AKIA...`
4. ✅ Enter AWS Client Secret: `...`
5. ✅ Select AWS Region: `us-east-1`
6. ✅ Click "Test Connection"
7. ✅ Verify success message
8. ✅ Verify models dropdown shows: Claude 3 Opus, Sonnet, Haiku, 3.5 Sonnet
9. ✅ Select a model
10. ✅ Click "Save & Use This Model"

#### Test Ollama Configuration
1. ✅ Ensure Ollama is running: `ollama serve`
2. ✅ Install a vision model: `ollama pull llava`
3. ✅ Click "Configure AI" button
4. ✅ Select "Ollama" tab
5. ✅ Enter endpoint: `http://localhost:11434`
6. ✅ Click "Test Connection"
7. ✅ Verify success message
8. ✅ Verify models dropdown shows installed vision models
9. ✅ Select a model
10. ✅ Click "Save & Use This Model"

### Phase 2: Image Upload Testing

#### Test File Upload
1. ✅ Click "Import Image" button (or press Ctrl+Shift+I)
2. ✅ Click the upload area
3. ✅ Select a diagram image (PNG, JPEG, etc.)
4. ✅ Verify image preview appears
5. ✅ Verify "Convert to Diagram" button is enabled

#### Test Clipboard Paste
1. ✅ Copy an image to clipboard (screenshot or image file)
2. ✅ Click "Import Image" button
3. ✅ Press Ctrl+V in the dialog
4. ✅ Verify image preview appears

#### Test Drag & Drop
1. ✅ Click "Import Image" button
2. ✅ Drag an image file from file explorer
3. ✅ Drop it onto the upload area
4. ✅ Verify image preview appears

### Phase 3: Conversion Testing

#### Test Simple Diagram Conversion
1. ✅ Upload a simple flowchart image
2. ✅ Click "Convert to Diagram"
3. ✅ Verify progress bar appears
4. ✅ Verify progress messages update
5. ✅ Wait for conversion to complete
6. ✅ Verify mermaid code appears in text area
7. ✅ Verify code is editable
8. ✅ Click "Insert into Canvas"
9. ✅ Verify diagram appears on canvas
10. ✅ Verify elements are selectable and editable

#### Test Complex Diagram
1. ✅ Upload a complex diagram with multiple nodes
2. ✅ Follow conversion steps
3. ✅ Verify all nodes are captured
4. ✅ Verify connections are correct

#### Test Error Handling
1. ✅ Try converting without configuring AI
   - Should show "Configure AI" prompt
2. ✅ Try with invalid credentials
   - Should show error message
3. ✅ Try with unsupported image format
   - Should show validation error
4. ✅ Try with very large image
   - Should optimize automatically

### Phase 4: Integration Testing

#### Test Keyboard Shortcuts
1. ✅ Press Ctrl+Shift+A
   - Should open AI Configuration dialog
2. ✅ Press Ctrl+Shift+I
   - Should open Import Image dialog
3. ✅ Press Escape
   - Should close dialogs

#### Test State Persistence
1. ✅ Configure a provider and save
2. ✅ Refresh the page
3. ✅ Open AI Configuration dialog
4. ✅ Verify credentials are still there
5. ✅ Verify selected model is remembered

#### Test Multiple Providers
1. ✅ Configure OpenAI
2. ✅ Configure Gemini
3. ✅ Switch between providers
4. ✅ Verify each works independently
5. ✅ Delete one provider
6. ✅ Verify others still work

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module" errors
**Solution**: Run `yarn build:packages` to build all packages

### Issue: Dialogs don't appear
**Solution**: Ensure AIFeatureIntegration component is added to your app

### Issue: "No AI provider configured"
**Solution**: Configure at least one provider in AI Configuration dialog

### Issue: Ollama connection fails
**Solution**: 
- Ensure Ollama is running: `ollama serve`
- Install a vision model: `ollama pull llava`
- Check endpoint URL is correct: `http://localhost:11434`

### Issue: AWS Claude authentication fails
**Solution**:
- Verify AWS credentials are correct
- Ensure IAM user has Bedrock permissions
- Check AWS region supports Bedrock (us-east-1, us-west-2, etc.)

### Issue: Image upload fails
**Solution**:
- Check image format is supported (PNG, JPEG, WebP, GIF)
- Ensure image size is under 10MB
- Try optimizing the image first

### Issue: Conversion produces invalid mermaid
**Solution**:
- Try with a clearer/simpler diagram
- Manually edit the generated code
- Use "Try Again" button to retry

---

## 📊 Expected Results

### Successful Configuration
- ✅ Green checkmark with "Connected successfully" message
- ✅ Models dropdown populated
- ✅ Selected model saved

### Successful Conversion
- ✅ Progress bar reaches 100%
- ✅ Valid mermaid code generated
- ✅ Code is editable
- ✅ Diagram inserts into canvas
- ✅ Elements are selectable

### Successful Integration
- ✅ Toolbar buttons visible
- ✅ Keyboard shortcuts work
- ✅ Dialogs open/close properly
- ✅ State persists across refreshes
- ✅ No console errors

---

## 🔍 Debugging Tips

### Enable Verbose Logging
Open browser console and run:
```javascript
localStorage.setItem('debug', 'excalidraw:*');
```

### Check Service Status
```javascript
// In browser console
const { aiConfigService } = await import('/packages/excalidraw/ai-features.ts');
const status = await aiConfigService.getConfigurationStatus();
console.log(status);
```

### Test Individual Services
```javascript
// Test image processing
const { imageProcessingService } = await import('/packages/excalidraw/ai-features.ts');

// Test mermaid validation
const { mermaidValidationService } = await import('/packages/excalidraw/ai-features.ts');
const result = await mermaidValidationService.validateSyntax('flowchart TD\n  A --> B');
console.log(result);
```

### Check LocalStorage
```javascript
// View stored credentials (encrypted)
console.log(localStorage.getItem('excalidraw_ai_credentials'));

// View selected provider
console.log(localStorage.getItem('excalidraw_ai_selected_provider'));

// View selected model
console.log(localStorage.getItem('excalidraw_ai_selected_model'));
```

---

## ✅ Verification Checklist

Before marking as complete, verify:

- [ ] All 23 files created
- [ ] No TypeScript errors: `yarn test:typecheck`
- [ ] No linting errors: `yarn test:code`
- [ ] Build succeeds: `yarn build:packages`
- [ ] Dev server starts: `yarn start`
- [ ] At least one provider configured successfully
- [ ] Image upload works (all 3 methods)
- [ ] Conversion produces valid mermaid code
- [ ] Diagram inserts into canvas correctly
- [ ] Elements are editable after insertion
- [ ] State persists after refresh
- [ ] No console errors during normal operation

---

## 🎯 Success Criteria

### Minimum Viable Test
1. ✅ Configure OpenAI (easiest to test)
2. ✅ Upload a simple flowchart image
3. ✅ Convert to diagram
4. ✅ Insert into canvas
5. ✅ Verify elements are editable

### Full Feature Test
1. ✅ All 4 providers configured
2. ✅ All 3 upload methods tested
3. ✅ Multiple diagram types converted
4. ✅ Error scenarios handled gracefully
5. ✅ State persistence verified

---

## 📝 Test Report Template

```markdown
# AI Features Test Report

**Date**: [Date]
**Tester**: [Name]
**Environment**: [Browser, OS]

## Configuration Tests
- [ ] OpenAI: Pass/Fail - [Notes]
- [ ] Gemini: Pass/Fail - [Notes]
- [ ] Claude: Pass/Fail - [Notes]
- [ ] Ollama: Pass/Fail - [Notes]

## Upload Tests
- [ ] File Upload: Pass/Fail - [Notes]
- [ ] Clipboard Paste: Pass/Fail - [Notes]
- [ ] Drag & Drop: Pass/Fail - [Notes]

## Conversion Tests
- [ ] Simple Diagram: Pass/Fail - [Notes]
- [ ] Complex Diagram: Pass/Fail - [Notes]
- [ ] Error Handling: Pass/Fail - [Notes]

## Integration Tests
- [ ] Keyboard Shortcuts: Pass/Fail - [Notes]
- [ ] State Persistence: Pass/Fail - [Notes]
- [ ] Canvas Insertion: Pass/Fail - [Notes]

## Issues Found
1. [Issue description]
2. [Issue description]

## Overall Status
- [ ] Ready for Production
- [ ] Needs Fixes
- [ ] Blocked

## Notes
[Additional observations]
```

---

## 🚀 Ready to Test!

**Everything is implemented and ready for testing.**

Start with:
1. `yarn build:packages`
2. `yarn start`
3. Add AIFeatureIntegration to your app
4. Follow the testing checklist above

**Good luck with testing!** 🎉
