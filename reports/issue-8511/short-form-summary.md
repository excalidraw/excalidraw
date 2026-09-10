# support `enter` to edit group #8511

### Short Form Summary

Issue: Enter does not enter group-edit mode for a selected group in Excalidraw.

Root cause: Missing selected-group branch in the Enter-key event handling flow.

Impact: Keyboard interaction for grouped elements was inconsistent with the existing double-click editing path.

Remediation: Added the missing group-edit branch and preserved expected nested group / Escape behavior.

Validation:

```bash
cd /workspaces/excalidraw && yarn vitest run packages/excalidraw/tests/selection.test.tsx --testNamePattern='enter edits a selected group|esc unwinds nested group editing before deselecting'
```

Result:
- 1 test file passed
- 2 tests passed
- 0 failed

Environment: Local project environment. No code sandbox was used for reproduction, diagnosis, or validation.

Conclusion: The defect was caused by a missing selected-group branch in the Enter-key interaction path. The fix restores correct keyboard behavior and is supported by targeted regression validation.
