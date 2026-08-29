# support `enter` to edit group #8511

### QA Defect Ticket

Issue:
Enter key does not enter group-edit mode for a selected group in Excalidraw.

Summary:
A defect was identified in the keyboard interaction flow for grouped elements. Double-click editing worked correctly, but the Enter-key path did not transition into group-edit mode. This created an inconsistent user experience and indicated a missing logic branch in the keyboard handling flow.

Root Cause:
The Enter-key handler included transitions for text, linear, and frame editing, but it did not include a corresponding path for an active selected group. The selection state was recognized, but the application did not enter the expected group-edit state.

Impact:
Keyboard editing for grouped elements did not behave consistently with the existing pointer-based interaction flow.

Remediation:
The Enter-key logic was updated to check for an active selected group and enter group-edit mode when applicable. The fix preserves the expected behavior for other editing states and maintains nested-group unwind behavior with Escape.

Validation:

```bash
cd /workspaces/excalidraw && yarn vitest run packages/excalidraw/tests/selection.test.tsx --testNamePattern='enter edits a selected group|esc unwinds nested group editing before deselecting'
```

Result:
- 1 test file passed
- 2 tests passed
- 0 failed

Environment:
Local project environment. No code sandbox was used for reproduction, diagnosis, or validation.

Conclusion:
This issue was caused by a missing selected-group branch in the Enter-key interaction path. The fix restores correct keyboard behavior and is covered by targeted regression validation.
