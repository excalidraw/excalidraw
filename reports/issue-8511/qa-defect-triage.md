# support `enter` to edit group #8511

### QA / Defect Triage Summary

Issue: Enter key does not enter group-edit mode for a selected group in Excalidraw.

Summary:
A defect was identified in the keyboard interaction flow for grouped elements. The double-click editing path functioned correctly, but the Enter-key path did not transition into group-edit mode. This created an inconsistent user experience and indicated a missing logic branch in the keyboard event handling flow.

Root cause:
The Enter-key handler included transitions for text editing, linear element editing, and frame editing, but it did not include the equivalent handling for an active selected group. As a result, the selection state was recognized, but the application did not enter the expected group-edit state.

Impact:
This issue affected grouped element editing via keyboard input and contradicted the expected behavior already present in the pointer-based interaction flow.

Remediation:
The Enter-key handling logic was updated to check for a selected group and enter group-edit mode when applicable. The fix preserves the existing behavior for other editing states and maintains the expected nested-group unwind behavior with Escape.

Validation:
The targeted regression validation used was:

```bash
cd /workspaces/excalidraw && yarn vitest run packages/excalidraw/tests/selection.test.tsx --testNamePattern='enter edits a selected group|esc unwinds nested group editing before deselecting'
```

Result from the recorded validation:
- 1 test file passed
- 2 tests passed
- 0 failed

Environment:
Local project environment. No code sandbox was used for reproduction, diagnosis, or validation.

Conclusion:
This defect was caused by a missing selected-group branch in the Enter-key interaction path. The fix restores correct keyboard behavior and is covered by targeted regression validation.
