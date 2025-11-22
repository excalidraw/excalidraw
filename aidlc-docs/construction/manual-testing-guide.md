# Manual Testing Guide

## Overview
This guide provides step-by-step instructions for manually testing the new AI features integrated into Excalidraw.

## Prerequisites
- Development server running (`yarn start`)
- Browser with DevTools open
- Test images prepared (diagrams, flowcharts, screenshots)
- Optional: Valid API keys for LLM providers

---

## Test Suite 1: UI Integration

### Test 1.1: Menu Items Visible
**Objective**: Verify new menu items appear in dropdown

**Steps**:
1. Open http://localhost:3000
2. Click the dropdown menu button (☰ or ⋮ icon in toolbar)
3. Look for AI-related menu items

**Expected Results**:
- ✅ "Text to diagram" exists (existing feature)
- ✅ "Configure AI" exists (NEW)
- ✅ "Image to diagram" exists (NEW)
- ✅ Both new items have appropriate icons
- ✅ "Image to diagram" has "AI" badge

**Pass/Fail**: ___________

---

### Test 1.2: Configure AI Dialog Opens
**Objective**: Verify configuration dialog opens and displays correctly

**Steps**:
1. Click dropdown menu
2. Click "Configure AI"
3. Observe dialog

**Expected Results**:
- ✅ Dialog opens without errors
- ✅ Dialog has tabs for providers (OpenAI, Anthropic, Google, OpenRouter)
- ✅ Default tab is selected
- ✅ Form fields are visible (API Key, Model)
- ✅ Save and Cancel buttons present
- ✅ Dialog is styled consistently with Excalidraw

**Pass/Fail**: ___________

---

### Test 1.3: Image to Diagram Dialog Opens
**Objective**: Verify image conversion dialog opens

**Steps**:
1. Click dropdown menu
2. Click "Image to diagram"
3. Observe dialog

**Expected Results**:
- ✅ Dialog opens without errors
- ✅ Upload area is visible
- ✅ Instructions are clear
- ✅ "Convert to Mermaid" button present (disabled initially)
- ✅ Close button works

**Pass/Fail**: ___________

---

## Test Suite 2: AI Configuration

### Test 2.1: OpenAI Configuration
**Objective**: Configure OpenAI provider

**Steps**:
1. Open "Configure AI" dialog
2. Select "OpenAI" tab
3. Enter API key: `sk-test-1234567890`
4. Select model: `gpt-4-vision-preview`
5. Click "Save Configuration"
6. Close dialog
7. Reopen dialog

**Expected Results**:
- ✅ Configuration saves without errors
- ✅ Success message displays
- ✅ Reopened dialog shows saved values
- ✅ API key is masked (shows as •••••)
- ✅ Model selection persists

**Pass/Fail**: ___________

---

### Test 2.2: Anthropic Configuration
**Objective**: Configure Anthropic provider

**Steps**:
1. Open "Configure AI" dialog
2. Select "Anthropic" tab
3. Enter API key: `sk-ant-test-1234`
4. Select model: `claude-3-opus-20240229`
5. Click "Save Configuration"

**Expected Results**:
- ✅ Configuration saves
- ✅ Provider switches to Anthropic
- ✅ Configuration persists

**Pass/Fail**: ___________

---

### Test 2.3: Configuration Validation
**Objective**: Test form validation

**Steps**:
1. Open "Configure AI" dialog
2. Try to save with empty API key
3. Try to save with invalid API key format
4. Try to save without selecting model

**Expected Results**:
- ✅ Empty API key shows validation error
- ✅ Invalid format shows error message
- ✅ Missing model shows error
- ✅ Save button disabled when invalid
- ✅ Error messages are clear and helpful

**Pass/Fail**: ___________

---

## Test Suite 3: Image Upload

### Test 3.1: File Upload
**Objective**: Upload image via file picker

**Steps**:
1. Open "Image to diagram" dialog
2. Click "Choose File" or upload area
3. Select a test image (PNG, JPG, or GIF)
4. Observe result

**Expected Results**:
- ✅ File picker opens
- ✅ Image uploads successfully
- ✅ Image preview displays
- ✅ Image dimensions shown
- ✅ "Convert to Mermaid" button enables
- ✅ No console errors

**Pass/Fail**: ___________

---

### Test 3.2: Drag and Drop
**Objective**: Upload image via drag and drop

**Steps**:
1. Open "Image to diagram" dialog
2. Drag an image file from file explorer
3. Drop it on the upload area
4. Observe result

**Expected Results**:
- ✅ Drop zone highlights on drag over
- ✅ Image uploads on drop
- ✅ Preview displays correctly
- ✅ Button enables

**Pass/Fail**: ___________

---

### Test 3.3: Clipboard Paste
**Objective**: Paste image from clipboard

**Steps**:
1. Copy an image to clipboard (screenshot or copy image)
2. Open "Image to diagram" dialog
3. Click in upload area
4. Press Ctrl+V (Cmd+V on Mac)
5. Observe result

**Expected Results**:
- ✅ Paste event is captured
- ✅ Image appears in preview
- ✅ Button enables
- ✅ Works with screenshots
- ✅ Works with copied images

**Pass/Fail**: ___________

---

### Test 3.4: Invalid File Types
**Objective**: Test file type validation

**Steps**:
1. Try to upload .txt file
2. Try to upload .pdf file
3. Try to upload .svg file

**Expected Results**:
- ✅ Non-image files rejected
- ✅ Clear error message displays
- ✅ Suggests valid formats (PNG, JPG, GIF)
- ✅ Upload area remains empty

**Pass/Fail**: ___________

---

## Test Suite 4: Image Conversion

### Test 4.1: Successful Conversion (Mock)
**Objective**: Test conversion with mocked LLM response

**Setup**: Configure AI with test API key

**Steps**:
1. Upload a simple flowchart image
2. Click "Convert to Mermaid"
3. Wait for conversion
4. Observe result

**Expected Results**:
- ✅ Loading indicator appears
- ✅ "Converting..." message shows
- ✅ Conversion completes (or shows mock result)
- ✅ Mermaid code preview displays
- ✅ Code is properly formatted
- ✅ "Insert into Canvas" button appears
- ✅ No console errors

**Pass/Fail**: ___________

---

### Test 4.2: Conversion Error Handling
**Objective**: Test error scenarios

**Test Cases**:

#### 4.2a: No Configuration
1. Clear AI configuration
2. Try to convert image
3. **Expected**: Error prompts to configure AI first

**Pass/Fail**: ___________

#### 4.2b: Invalid API Key
1. Configure with invalid key
2. Try to convert
3. **Expected**: API error message, suggests checking config

**Pass/Fail**: ___________

#### 4.2c: Network Error
1. Disconnect network
2. Try to convert
3. **Expected**: Network error message, retry option

**Pass/Fail**: ___________

---

### Test 4.3: Mermaid Code Preview
**Objective**: Verify mermaid code preview functionality

**Steps**:
1. Complete a successful conversion
2. Review the mermaid code preview
3. Try to edit the code (if editable)

**Expected Results**:
- ✅ Code is displayed in monospace font
- ✅ Code is syntax highlighted (if implemented)
- ✅ Code is readable and properly formatted
- ✅ Copy button works (if implemented)
- ✅ Edit functionality works (if implemented)

**Pass/Fail**: ___________

---

## Test Suite 5: Canvas Insertion

### Test 5.1: Insert Diagram Elements (NEW - Mermaid Rendering)
**Objective**: Insert converted diagram as actual shapes into canvas

**Steps**:
1. Complete image conversion (should generate Mermaid code)
2. Click "Add to canvas" button
3. Observe canvas

**Expected Results**:
- ✅ Dialog closes
- ✅ **Diagram renders as actual shapes** (rectangles, arrows, text) NOT as text code
- ✅ Nodes appear as rectangles with labels
- ✅ Arrows connect nodes properly
- ✅ Layout is hierarchical and readable
- ✅ Elements are positioned starting at (100, 100)
- ✅ Elements are properly styled (blue stroke, light blue fill)
- ✅ All elements are selectable
- ✅ Elements can be moved individually
- ✅ Arrows remain connected to nodes when nodes move
- ✅ Text labels are centered in nodes
- ✅ Elements can be resized
- ✅ Elements can be deleted

**Pass/Fail**: ___________

---

### Test 5.2: Multiple Insertions
**Objective**: Test multiple conversions and insertions

**Steps**:
1. Convert and insert first image
2. Convert and insert second image
3. Verify both sets of elements

**Expected Results**:
- ✅ Both sets of elements exist
- ✅ Elements don't overlap (positioned appropriately)
- ✅ Each set is independently manipulable
- ✅ No interference between sets

**Pass/Fail**: ___________

---

### Test 5.3: Undo/Redo
**Objective**: Test undo/redo with AI-generated elements

**Steps**:
1. Insert elements from conversion
2. Press Ctrl+Z (undo)
3. Press Ctrl+Shift+Z (redo)

**Expected Results**:
- ✅ Undo removes inserted elements
- ✅ Redo restores elements
- ✅ Undo/redo stack works correctly
- ✅ No errors in console

**Pass/Fail**: ___________

---

## Test Suite 6: Keyboard Shortcuts

### Test 6.1: Configure AI Shortcut
**Objective**: Test Ctrl+Shift+A shortcut

**Steps**:
1. Press Ctrl+Shift+A (Cmd+Shift+A on Mac)
2. Observe result

**Expected Results**:
- ✅ Configure AI dialog opens
- ✅ Shortcut works from any state
- ✅ Shortcut shown in menu

**Pass/Fail**: ___________

---

### Test 6.2: Image to Diagram Shortcut
**Objective**: Test Ctrl+Shift+I shortcut

**Steps**:
1. Press Ctrl+Shift+I (Cmd+Shift+I on Mac)
2. Observe result

**Expected Results**:
- ✅ Image to diagram dialog opens
- ✅ Shortcut works from any state
- ✅ Shortcut shown in menu

**Pass/Fail**: ___________

---

## Test Suite 7: Browser Compatibility

### Test 7.1: Chrome/Chromium
**Browser**: Chrome/Edge/Brave

**Tests**: Run all test suites above

**Pass/Fail**: ___________

---

### Test 7.2: Firefox
**Browser**: Firefox

**Tests**: Run all test suites above

**Pass/Fail**: ___________

---

### Test 7.3: Safari
**Browser**: Safari (macOS)

**Tests**: Run all test suites above

**Pass/Fail**: ___________

---

## Test Suite 8: Performance

### Test 8.1: Dialog Load Time
**Objective**: Measure dialog open performance

**Steps**:
1. Open DevTools Performance tab
2. Start recording
3. Open Configure AI dialog
4. Stop recording
5. Measure time

**Expected Results**:
- ✅ Dialog opens in < 100ms
- ✅ No layout thrashing
- ✅ Smooth animation

**Pass/Fail**: ___________

---

### Test 8.2: Image Processing Time
**Objective**: Measure image upload and preview time

**Steps**:
1. Upload 1MB image
2. Measure time to preview

**Expected Results**:
- ✅ Preview appears in < 500ms
- ✅ No UI freezing
- ✅ Smooth experience

**Pass/Fail**: ___________

---

### Test 8.3: Memory Usage
**Objective**: Check for memory leaks

**Steps**:
1. Open DevTools Memory tab
2. Take heap snapshot
3. Perform 10 conversions
4. Take another heap snapshot
5. Compare

**Expected Results**:
- ✅ No significant memory growth
- ✅ Objects are garbage collected
- ✅ No detached DOM nodes

**Pass/Fail**: ___________

---

## Test Suite 9: Accessibility

### Test 9.1: Keyboard Navigation
**Objective**: Test keyboard-only navigation

**Steps**:
1. Use Tab to navigate through dialogs
2. Use Enter to activate buttons
3. Use Escape to close dialogs

**Expected Results**:
- ✅ All interactive elements are focusable
- ✅ Focus order is logical
- ✅ Focus indicators are visible
- ✅ Escape closes dialogs
- ✅ Enter activates buttons

**Pass/Fail**: ___________

---

### Test 9.2: Screen Reader
**Objective**: Test with screen reader

**Steps**:
1. Enable screen reader (NVDA, JAWS, VoiceOver)
2. Navigate through AI features
3. Listen to announcements

**Expected Results**:
- ✅ Buttons have descriptive labels
- ✅ Form fields have labels
- ✅ Error messages are announced
- ✅ Loading states are announced
- ✅ Success messages are announced

**Pass/Fail**: ___________

---

## Summary

### Overall Results
- Total Tests: ___________
- Passed: ___________
- Failed: ___________
- Blocked: ___________

### Critical Issues Found
1. ___________
2. ___________
3. ___________

### Minor Issues Found
1. ___________
2. ___________
3. ___________

### Recommendations
1. ___________
2. ___________
3. ___________

### Sign-off
- Tester: ___________
- Date: ___________
- Status: ☐ Approved ☐ Needs Work
