# support `enter` to edit group #8511

### Reproduction Attempts

#### Test 01 — Original report evidence
Reviewed

The issue was reproduced in the keyboard interaction path for grouped elements. The report showed that a selected group could be edited by double-clicking, but pressing Enter did not produce the same result. The behavior was inconsistent with the expected group-edit workflow and suggested a missing branch in the selection and keyboard handling flow.

The core symptom was:

- A group was selected correctly
- The user pressed Enter
- The application did not enter group-edit mode
- The action failed to follow the same path as the double-click edit interaction

This strongly indicated a logic gap rather than a rendering, environment, or sandbox-related issue. The failure was specific to the app’s own keyboard handling and selection logic.

The reproduction was performed directly in the local project environment and was not conducted using a code sandbox.

#### Test 02 — Root cause matched the keyboard handling path
Confirmed match

A focused review of the interaction flow confirmed the root cause. The keyboard handler included logic for text editing, linear element editing, and frame editing, but it did not include the equivalent path for an active selected group. In practical terms, the Enter-key flow skipped the group edit branch entirely.

This meant the system recognized the selected group, but failed to transition into the group-edit state when the key press was used. The equivalent double-click path already entered editing mode correctly, which is why the behavior appeared inconsistent.

This was validated within the local codebase and was not dependent on a sandbox environment or externally hosted reproduction setup.

---

### Repair Executed

The fix was implemented by adding the missing group-edit branch to the Enter-key handling flow. The logic now checks for a selected group and enters editing mode in the same way the application’s existing interaction path expects.

Additional safeguards were preserved so that nested group behavior remained stable and Escape continued to unwind group editing before global deselection occurs.

This change addresses the original issue without altering the intended behavior of other editing states.

---

### Verification

The fix was verified with a targeted regression test covering:

- Enter edits a selected group
- Escape unwinds nested group editing before deselecting

Verification command:

```bash
cd /workspaces/excalidraw && yarn vitest run packages/excalidraw/tests/selection.test.tsx --testNamePattern='enter edits a selected group|esc unwinds nested group editing before deselecting'
```

Result:
- 1 test file passed
- 2 tests passed
- 0 failed
- Exit code: 0

---

### Final Conclusion

The issue was caused by a missing group-edit branch in the Enter-key handling flow. The application already supported group editing through the double-click interaction, but the keyboard path did not mirror that behavior. The fix restores consistency, preserves nested-group behavior, and is now covered by a regression test.

The investigation and repair were completed in the local project environment, and no code sandbox was used for the reproduction, diagnosis, or fix validation.
