---
name: verify
description: Verify a code change by driving the running Excalidraw app in Chrome, capturing a screenshot, and reporting PASS/FAIL.
---

# Verify a change in the running app

You're checking that a described change actually works in the live Excalidraw app — not just that types compile. Drive the real UI, capture proof, and report.

## Steps

1. **Dev server** — Check `http://localhost:3001`. If it's not responding, start it in the background with `yarn start` and wait until it returns HTTP 200.

2. **Browser tab** — Call `tabs_context_mcp` with `createIfEmpty: true`. **Reuse an existing tab — do not create additional tabs or windows.** Pick the first tab already on `localhost:3001`; if none is, take the first tab in the group and `navigate` it there. Only call `tabs_create_mcp` if the group is literally empty. Dismiss any welcome modal with Escape.

3. **Exercise the change** — Perform the interaction sequence that demonstrates the change. Use the `computer` tool for clicks/keys, and take screenshots between key steps so you can see what's happening.

4. **Capture result** — Take a final screenshot (or `zoom`) of the relevant area with `save_to_disk: true`, and `mv` the saved file to `~/Desktop/` so the user can find it.

5. **Report** — A short verdict referencing the screenshots above:
   - **PASS** — what you saw that confirms the change works
   - **FAIL** — expected vs actual; which file/function is the likely culprit

## Notes

- Screenshots from the browser tool render inline in chat; don't add markdown image links.
- If a step fails (control not found, unexpected state), screenshot, diagnose, and adapt — don't silently skip.
- For a clean slate, `javascript_tool` → `localStorage.clear()` then reload — Excalidraw persists scenes across reloads otherwise.
