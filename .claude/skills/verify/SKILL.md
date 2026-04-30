---
name: verify
description: Verify a code change by driving the running Excalidraw app in Chrome, recording a GIF, and reporting PASS/FAIL.
---

# Verify a change in the running app

You're checking that a described change actually works in the live Excalidraw app — not just that types compile. Drive the real UI, capture proof, and report.

## Steps

1. **Dev server** — Check `http://localhost:3001`. If it's not responding, start it in the background with `yarn start` and wait until it returns HTTP 200.

2. **Browser tab** — Call `tabs_context_mcp` with `createIfEmpty: true`. **Reuse an existing tab — do not create additional tabs or windows.** Pick the first tab already on `localhost:3001`; if none is, take the first tab in the group and `navigate` it there. Only call `tabs_create_mcp` if the group is literally empty. Dismiss any welcome modal with Escape.

3. **Start recording** — Call `gif_creator` with `start_recording`, then take an initial screenshot so the first frame is captured.

4. **Exercise the change** — Perform the interaction sequence that demonstrates the change. Use `read_page`/`find` to locate controls, the `computer` tool for clicks/keys, and screenshots between key steps so you can see what's happening.

5. **Capture result** — Take a final screenshot of the relevant area. Then `gif_creator` `stop_recording` and `export` with `download: true` and a descriptive filename. Move the downloaded GIF to `~/Desktop/` so the user can find it.

6. **Report** — A short verdict referencing the screenshots above:
   - **PASS** — what you saw that confirms the change works
   - **FAIL** — expected vs actual; which file/function is the likely culprit

## Notes

- Screenshots from the browser tool render inline in chat; don't add markdown image links.
- If a step fails (control not found, unexpected state), screenshot, diagnose, and adapt — don't silently skip.
- Clear the canvas before testing if prior shapes would interfere: select-all (Cmd/Ctrl+A) then Backspace.
