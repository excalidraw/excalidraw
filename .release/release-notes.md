## 🚀 Focus Timer for Workshops

### What's changed
A workshop focus timer is now available in the top-right whiteboard chrome (next to Inspiration). Facilitators can pick a 1 / 5 / 10 / 15 minute preset or enter a custom duration, then Start, Pause, Resume, and Reset a single countdown. Remaining time shows as `MM:SS` on the button while active; when time expires, the UI marks “Done” / “Time's up” and a toast confirms the timer finished.

### User impact
Facilitators can run timed brainstorming, voting, and ideation exercises without leaving the whiteboard for a separate timer app, keeping the session focused in one place.

### Technical notes
Implemented as local Layer UI state (`FocusTimer` + SCSS, mounted from `LayerUI`) following the Inspiration Panel pattern. Countdown uses a wall-clock `endsAt` so background-tab drift is avoided. Timer state does not touch the scene or persisted appState, so canvas editing and undo are unaffected. Only one timer can run per session (singleton guard).

### Testing
Manual validation against the Notion acceptance criteria (toolbar entry, presets, custom duration, controls, remaining time, expiry indication, no edit interference, singleton). No automated tests were added for this change; coverage gap noted in the Aug 9 testing report canvas.

### Known limitations
- Countdown is local to the current browser session — not broadcast to collaborators and not persisted across reload.
- No expiry sound (visual + toast only).
