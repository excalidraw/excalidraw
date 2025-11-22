# Integration Test Instructions

## Purpose
Test interactions between AI feature components and existing Excalidraw functionality to ensure they work together correctly.

## Test Scenarios

### Scenario 1: AI Configuration → Image Conversion Integration
**Description**: Verify that configured AI settings are used during image conversion

**Setup**:
1. Start development server: `yarn start`
2. Open browser to http://localhost:3000
3. Open browser DevTools console

**Test Steps**:
1. Click dropdown menu (three dots icon)
2. Click "Configure AI"
3. Select OpenAI provider tab
4. Enter test API key (or use mock)
5. Select model "gpt-4-vision-preview"
6. Click "Save Configuration"
7. Close configuration dialog
8. Click dropdown menu again
9. Click "Image to diagram"
10. Upload or paste a test diagram image
11. Click "Convert to Mermaid"

**Expected Results**:
- Configuration is saved to localStorage
- Image conversion uses configured provider and model
- Conversion request includes correct API key
- Success/error message displays appropriately
- Generated mermaid code appears in preview

**Cleanup**: Clear localStorage in DevTools

---

### Scenario 2: Image Upload → Mermaid Generation → Canvas Insertion
**Description**: Test complete workflow from image to Excalidraw elements

**Setup**:
1. Prepare test image (diagram screenshot or flowchart)
2. Start development server
3. Open application in browser

**Test Steps**:
1. Open "Image to diagram" dialog
2. Upload test image via file picker
3. Verify image preview displays
4. Click "Convert to Mermaid"
5. Wait for conversion (loading state should show)
6. Review generated mermaid code in preview
7. Click "Insert into Canvas"
8. Verify elements appear on canvas

**Expected Results**:
- Image uploads successfully
- Preview shows uploaded image
- Loading indicator appears during conversion
- Mermaid code is generated and displayed
- Code is valid mermaid syntax
- Elements are inserted at canvas center
- Elements are properly formatted (Excalidraw style)
- Undo/redo works with inserted elements

**Verification**:
- Check console for errors
- Verify elements in scene (F12 → Excalidraw state)
- Test element manipulation (move, resize, delete)

---

### Scenario 3: Clipboard Paste → Conversion
**Description**: Test image paste from clipboard

**Setup**:
1. Copy an image to clipboard (screenshot or diagram)
2. Start application

**Test Steps**:
1. Open "Image to diagram" dialog
2. Click in the upload area
3. Press Ctrl+V (or Cmd+V on Mac)
4. Verify pasted image appears
5. Click "Convert to Mermaid"
6. Verify conversion completes

**Expected Results**:
- Paste event is captured
- Image data is extracted from clipboard
- Image preview displays
- Conversion proceeds normally

---

### Scenario 4: Error Handling Integration
**Description**: Test error scenarios across the integration

**Test Cases**:

#### 4a. No API Key Configured
1. Clear AI configuration
2. Try to convert image
3. **Expected**: Error message prompts to configure AI

#### 4b. Invalid API Key
1. Configure with invalid API key
2. Try to convert image
3. **Expected**: API error message displays, suggests checking configuration

#### 4c. Invalid Image Format
1. Try to upload non-image file (e.g., .txt)
2. **Expected**: Validation error, file rejected

#### 4d. Network Error
1. Disconnect network
2. Try to convert image
3. **Expected**: Network error message, retry option

#### 4e. Invalid Mermaid Code
1. Mock LLM to return invalid mermaid
2. Try conversion
3. **Expected**: Validation error, option to edit code manually

---

### Scenario 5: State Synchronization
**Description**: Verify state management across components

**Test Steps**:
1. Open AI configuration dialog
2. Change provider to Anthropic
3. Close dialog without saving
4. Reopen dialog
5. **Expected**: Changes not persisted, original provider shown

6. Change provider to Anthropic again
7. Click "Save Configuration"
8. Close dialog
9. Reopen dialog
10. **Expected**: Anthropic provider selected

11. Open image conversion dialog
12. **Expected**: Uses Anthropic configuration

---

### Scenario 6: Multiple Conversions
**Description**: Test multiple sequential conversions

**Test Steps**:
1. Convert first image
2. Insert into canvas
3. Convert second image
4. Insert into canvas
5. Verify both sets of elements exist
6. Test undo (should remove second set)
7. Test redo (should restore second set)

**Expected Results**:
- Each conversion creates new elements
- Elements don't interfere with each other
- Undo/redo stack works correctly
- No memory leaks (check DevTools memory)

---

## Setup Integration Test Environment

### 1. Start Required Services
```bash
# Start development server
cd excalidraw-app
yarn start

# Server should start on http://localhost:3000
```

### 2. Configure Test Environment
```bash
# Optional: Set up test API keys in .env.local
# (Not committed to repo)
echo "VITE_OPENAI_API_KEY=sk-test-key" > excalidraw-app/.env.local
```

### 3. Prepare Test Data
Create test images in `test-data/` directory:
- Simple flowchart
- Complex diagram
- Hand-drawn sketch
- Screenshot of existing diagram

## Run Integration Tests

### Manual Testing Checklist
- [ ] AI Configuration saves and loads correctly
- [ ] Image upload works (file picker)
- [ ] Image paste works (clipboard)
- [ ] Conversion generates valid mermaid code
- [ ] Mermaid code inserts into canvas
- [ ] Elements are properly styled
- [ ] Error handling works for all scenarios
- [ ] State persists across dialog open/close
- [ ] Multiple conversions work
- [ ] Undo/redo works with AI-generated elements
- [ ] No console errors during normal operation
- [ ] No memory leaks after multiple conversions

### Automated Integration Tests (Future)
```bash
# When implemented, run with:
yarn test:integration

# Or with specific browser:
yarn test:integration --browser=chromium
```

## Verify Service Interactions

### Check Network Requests
1. Open DevTools → Network tab
2. Perform image conversion
3. Verify:
   - Request to LLM API is made
   - Request includes correct headers (API key, content-type)
   - Response is received and parsed
   - No CORS errors

### Check State Management
1. Open React DevTools
2. Find Jotai atoms
3. Verify:
   - `aiConfigDialogOpenAtom` toggles correctly
   - `imageToMermaidDialogOpenAtom` toggles correctly
   - `aiConfigurationAtom` updates on save
   - `conversionStatusAtom` updates during conversion

### Check Error Boundaries
1. Force an error (invalid API key)
2. Verify:
   - Error boundary catches error
   - User-friendly error message displays
   - Application doesn't crash
   - User can recover (close dialog, try again)

## Performance Testing

### Conversion Performance
1. Convert small image (< 100KB)
   - **Target**: < 5 seconds
2. Convert medium image (100KB - 500KB)
   - **Target**: < 10 seconds
3. Convert large image (> 500KB)
   - **Target**: < 15 seconds or show warning

### Memory Usage
1. Perform 10 conversions
2. Check memory in DevTools
3. **Expected**: No significant memory growth
4. **Action**: If memory grows, investigate leaks

## Cleanup

After testing:
```bash
# Clear browser data
# - localStorage (AI configuration)
# - sessionStorage
# - Cookies

# Stop development server
# Ctrl+C in terminal
```

## Known Issues / Limitations

- LLM API rate limits may affect testing
- Large images may timeout
- Some diagram types convert better than others
- Mermaid syntax limitations may affect complex diagrams

## Next Steps

1. Complete manual integration testing
2. Document any issues found
3. Create automated integration tests using Playwright or Cypress
4. Set up CI/CD pipeline to run integration tests
5. Add performance benchmarks
