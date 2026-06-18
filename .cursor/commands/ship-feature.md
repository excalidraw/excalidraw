# /ship-feature

You are implementing a change in the Excalidraw monorepo end-to-end, **plan-first**.

> Best run inside Plan mode (Shift+Tab in the chat input). This command also enforces a plan-first gate in the prompt below, so it behaves correctly even if Plan mode isn't toggled — but Plan mode gives the cleanest review/approve experience.

## 0. STOP — plan before any edit (hard gate)

- **Do NOT edit, create, or delete any file in this turn.** This turn is read-only.
- Your only output this turn is a plan (sections 1–2). You must wait for my explicit approval (I will reply "approved" or similar) before making a single change.
- If you are tempted to start editing, stop and ask for approval instead.

## 1. Understand

- A GitHub issue number or URL will be provided (e.g. #1234). Use the GitHub MCP `issue_read` tool to fetch the title, body, and labels, then restate the acceptance criteria in your own words.
- Identify which package(s) the change belongs in. Respect the boundary `excalidraw → element → math → common`.

## 2. Plan (read-only — present this, then STOP)

- List the exact files you will touch and why.
- Name the action(s)/component(s) involved and the test you will write.
- Call out any public `@excalidraw/*` type changes — those are breaking and need a note.
- End with: "Awaiting approval to implement." Then stop and make no edits.

## 3. Implement (only after I approve)

- Make the change following the auto-attached rules (React/components, core-packages, testing).
- Keep element mutations inside the Action system + history. No direct mutation.
- Add or update a Vitest test that fails without the change.

## 4. Verify

- Run `yarn test:typecheck`, lint, and the relevant `yarn test` path. Fix what breaks.
- Note: the afterFileEdit hook auto-formats and logs each edit — don't hand-format.

## 5. Hand off

- Summarize the change, the test added, and any follow-ups.
- Stage a conventional-commit message. Do NOT push to main (the policy hook will block it).
- Open a draft PR on **chuysmans/excalidraw only** — never target excalidraw/excalidraw: `gh pr create --repo chuysmans/excalidraw --base master --title "..." --body "Closes #1234"`
- If using GitHub MCP for the PR, ensure the repo is `chuysmans/excalidraw`.
