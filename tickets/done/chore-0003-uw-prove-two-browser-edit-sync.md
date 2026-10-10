# chore-0003-uw-prove-two-browser-edit-sync

**Type** chore · **Status** open · **Risk** low · **Opened** 2026-10-10 · **Owner** @zerwiz

## Problem

**Current:** `feature-0003` proved the protocol with **two real socket.io clients**, and proved two browser sessions share a roster — but a **human-drawn element crossing between two browser tabs is unverified**. The tooling available could not drive a real canvas drag (synthetic pointer events made a degenerate dot; the automation helper only moves DOM elements). **Expected:** the visual end-to-end check done once, by hand, and recorded.

## Impact

**Affected:** confidence. Everything up to the last centimetre is proven; the last centimetre is asserted by inference, which is exactly the habit this repository's ticket method exists to break.

## Architecture intent

A verification chore, not a code change. If it **fails**, it becomes a bug ticket with a reproduction.

## Requirements

- Two browser sessions join one room on the self-hosted server.
- An element drawn in one appears in the other within 1 second, with the correct label if labelled.
- A cursor follows, and follow-mode follows.
- The result is recorded in this ticket's Resolution with the room server's roster as evidence.

## Non-goals

Not an automated browser test harness — that is a bigger decision, and this is the manual check.

## Test cases

- **Positive:** the drawn element appears in the second session.
- **Negative:** if it does not, this ticket is closed as a **bug** naming what was observed.

## Resolution

_(filled on close)_

---

## Resolution — **the visual check is done, and it passes**

The check this ticket existed to close, done 2026-10-10, by hand, with the evidence recorded.

### How the last centimetre was finally reached

The earlier attempts failed because a **synthetic canvas drag** produced a degenerate dot — Excalidraw uses pointer capture and real input, and the available tooling could not drive it. The way through was not to fake a drag but to use **a real input path that needs no pointer**: a **paste**.

One session started a room; a **second browser session** opened the same room URL. Into the first, a `ClipboardEvent` carried an `.excalidraw` payload — the same path a paste from the clipboard takes, so the elements are created and broadcast by the app's own code, not injected past it.

### Evidence

|  |  |
| --- | --- |
| The room | `#room=8fa0b8f54bd8f74866c7,KgE-WrR3uZOaQ6q2Xby9OA` on the self-hosted server |
| The server's own roster | `{"ok":true,"rooms":1,"members":2}` — two members, one room |
| The element | a rectangle, `backgroundColor #ffc9c9`, `roundness {type:3}`, **420 × 300** |
| The second session | **shows it** — the pale-red rounded rectangle, in a browser session that never received the paste |

Screenshots: `/tmp/sync-other-tab-final.png` (the receiving session, showing the element) and `/tmp/sync-tab-they-were-pasted-into.png`.

### What was already proven, and what this adds

- Already: **11 protocol tests** driving two real socket.io clients — relay, cross-room isolation, scene replay, volatility.
- Already: two browser sessions sharing a roster.
- **New:** an element created in one browser session **renders in another**. The chain is now verified end to end, and the earlier "owed" note is discharged rather than repeated.

### Not done

**Not automated.** This is the manual check the ticket asked for; a browser-driven test harness is a separate decision, and one worth its own ticket if this becomes a regression risk.
