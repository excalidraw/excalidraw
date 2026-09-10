# support `enter` to edit group #8511

### QA / Bug Triage Report

#### Summary
This report documents a defect affecting the Enter-to-edit interaction for selected groups in Excalidraw. The issue was reproduced in the local project environment and was confirmed to be caused by a missing keyboard interaction path rather than a rendering or sandbox-related condition.

The defect manifested as follows:
- A group could be selected successfully
- Double-click editing worked correctly
- Pressing Enter did not enter group-edit mode
- The keyboard flow failed to follow the expected group-edit state transition

No code sandbox was used in the reproduction, diagnosis, or validation of this issue.

---

### Reproduction Details

#### Test 01 — Original report evidence
Reviewed

The reported issue was assessed against the observed interaction model. The reproduction showed that the selected group did not respond correctly to the Enter key despite the equivalent double-click interaction functioning normally. This created an inconsistency in expected keyboard behavior and identified the issue as a logic gap in the interaction handler.

Observations:
- Group selection was functional
- Double-click edit flow was correct
- Enter key path did not transition into group-edit mode
- The issue was isolated to the keyboard input flow

#### Test 02 — Root cause validation
Confirmed match

A detailed review of the event handling logic confirmed the root cause. The Enter-key handler included branching for:
- text editing
- linear element editing
- frame editing

However, it did not include a corresponding branch for an active selected group. As a result, the application recognized the selection but did not enter the proper edit state when the user pressed Enter.

This issue was reproduced and validated directly in the project codebase and was not dependent on a sandboxed or externally hosted environment.

---

### Root Cause

The defect was caused by a missing group-edit branch in the keyboard event handling path. The application already supported the desired behavior through the double-click interaction, but the Enter-key route failed to call the same group-edit logic. This created a behavioral mismatch between pointer-based editing and keyboard-driven editing.

---

### Repair / Remediation

The remediation consisted of adding the missing selected-group branch to the Enter-key handling flow. The logic now checks for an active selected group and transitions into group-edit mode as expected. The fix preserves the existing behavior for other editing contexts and maintains correct nested-group unwind behavior when Escape is used.

---

### Verification

Verification was performed with a focused regression check:

```bash
cd /workspaces/excalidraw && yarn vitest run packages/excalidraw/tests/selection.test.tsx --testNamePattern='enter edits a selected group|esc unwinds nested group editing before deselecting'
```

Result:
- Test file passed: 1
- Tests passed: 2
- Tests failed: 0
- Exit code: 0

---

### Conclusion

This defect was classified as a keyboard interaction logic issue in the selected group edit path. The root cause was a missing state transition in the Enter-handling branch. The issue was corrected in the local codebase and confirmed through regression testing. No code sandbox was used for reproduction or validation, and the fix was verified in the actual project environment.
