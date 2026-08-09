---
name: prepare-release
description: Review the completed feature and prepare concise release notes for publication to the engineering release-notes Slack channel.
---

# Prepare Release

Use this skill after a feature has been implemented, debugged and validated.

## Workflow

1. Inspect the current branch diff against the target branch.

2. Review:
   - the implemented functionality
   - relevant requirements from the current conversation
   - tests that were added or executed
   - any known limitations

3. Verify that the release notes describe only functionality actually present in the implementation.

4. Generate release notes using the following structure:

## 🚀 <Feature name>

### What's changed
A concise explanation of the functionality delivered.

### User impact
Explain why the change is useful.

### Technical notes
Summarise important implementation details without excessive code-level detail.

### Testing
Summarise the validation performed.

### Known limitations
Include only when applicable.

5. Keep the finished release notes concise enough for a Slack message.

6. Save the final release notes to:

.release/release-notes.md

7. Do not modify application code while preparing the release notes.

8. Tell the user when the release notes are ready for publication.
