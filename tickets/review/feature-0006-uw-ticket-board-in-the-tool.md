# feature-0006-uw-ticket-board-in-the-tool

**Type** feature · **Status** open · **Risk** medium · **Opened** 2026-10-10 · **Owner** @zerwiz

## Problem

**Current:** tickets are files under `tickets/`, readable only by whoever has the clone. The team shares a tool but cannot see what work is open, in progress or awaiting review without reading the repository.

**Expected:** a **Tickets** view in the tool showing the four columns — open, in-progress, review, done — read from the repository's `tickets/` directory.

## Impact

**Affected:** the team. It closes the gap the file-based system leaves open: no shared triage view. **Risk if not built:** tickets exist but nobody looks; the contract discipline decays. **Urgency:** low — the files are authoritative either way. Build this after the collaboration and settings work, not before.

## Architecture intent

The **files remain the source of truth**; the board is a read-only projection of them. Writing through the UI is deliberately out of scope, so the board can never become a second, divergent backlog.

## Requirements

- A `Tickets` view renders four columns from `tickets/{open,in-progress,review,done}/`.
- Each card shows the ticket's title, type, status, risk and owner, parsed from the filename and the header line.
- Selecting a card renders the ticket body — Problem, Impact, Requirements, Non-goals, Test cases, Constraints.
- The view marks a ticket whose header is malformed, or whose filename id disagrees with its Owner, using the same rule `bin/guards/ticket-ids.sh` enforces.
- With no tickets present, the view renders an empty state; it does not error.
- The view is read-only. There is no edit, drag or create action in v1.

## Constraints

- The tickets directory is read through a server endpoint (the tool is a browser app and cannot read the filesystem directly); that endpoint is read-only and serves only `tickets/**`.
- No ticket content is sent to a third-party host.
- File paths served are confined to the tickets root; a path traversal request is refused.
- The render is correct under both light and dark themes.

## Non-goals

- No editing, moving or creating tickets from the UI.
- No burndown, velocity or time tracking.
- No GitHub Issues sync.
- No replacement of the files — the view is a lens, not a store.

## Test cases

- **Positive:** with the current `tickets/open/` set, the view lists every ticket under the correct column with its owner and risk.
- **Positive:** opening a card shows all five contract sections.
- **Negative:** a malformed filename or a mismatched Owner is visibly flagged, matching `bin/guards/ticket-ids.sh`.
- **Negative:** a request for `../RULES/08-tickets.md` through the tickets endpoint is refused.
- **Compatibility:** the view renders with an empty `tickets/` directory.

## Operations

**Rollout:** ship behind the app menu. **Observability:** the endpoint logs requests, never ticket bodies. **Rollback:** hide the view; the files are unaffected.

## Resolution

_(filled on close)_

## Resolution

**Landed** on `feat/ticket-board` (2026-10-10).

### The server

`server/tickets/` — dependency-free, **read-only**:

| File | What |
| --- | --- |
| `tickets.mjs` | the pure logic: filename + header parsing, `buildCard` (which records the same mismatches the guard flags), `buildBoard`, `columnOf`, `safeResolve`, `readConfig`. |
| `index.mjs` | the server: `GET /api/tickets`, `GET /api/tickets/<column>/<file>`, `GET /healthz`, CORS, and a 405 for anything that is not `GET`. |
| `tickets.test.mjs` | 17 `node --test` cases. |

### Requirements, met

- **Four columns** read from `tickets/{open,in-progress,review,done}/`, in workflow order.
- **Cards** carry title, type, risk and owner, parsed from the filename and the header line.
- **A card opens the ticket body.**
- **Malformed names and Owner mismatches are flagged** with the same rule the guard enforces — `buildCard` reports `problems`, and the server re-checks against the repo's own `tickets/DEVIDS`.
- **Empty state** renders; a missing column directory is empty, not an error.
- **Read-only.** Only `GET` is served; there is no write path anywhere.
- **The path never escapes.** `columnOf` accepts only `<status>/<file>.md` (so `_templates/` and `README.md` are unreachable), and `safeResolve` refuses any traversal — belt and braces.
- Both themes: the styles use the app's CSS variables throughout.

### Verified

- **17 server tests** (`yarn test:server`, now covering both services: 33 total).
- **Full suite: 144 files, 2489 tests passed** · `yarn test:typecheck` clean · `yarn build:app` built · eslint clean.
- **Live against the real repository:**
  - `GET /healthz` → `{"ok":true,"root":"<the repo root>"}` _(redacted — see the note at the foot of this ticket)_
  - `GET /api/tickets` → **7 tickets: 3 open, 4 review**, each with type/risk/owner and **zero problems**
  - `GET /api/tickets/review/chore-0001-…md` → the markdown
  - **Traversal refused** — `../../RULES/08-tickets.md`, `..%2f..%2fRULES%2f…`, `open%2f..%2f..%2f..%2fetc%2fpasswd` and `%2e%2e%2f…%2fAGENTS.md` all → `404 {"error":"not a ticket path"}`; `_templates/feature.md` → the same, because only the four status folders are servable.
  - **In the browser**, the menu shows **Tickets** beside Settings, and the dialog rendered the four columns with all seven real tickets (screenshot: `/tmp/excalidraw-ticket-board.png`).

### Not done, deliberately

- **No editing, moving or creating from the UI.** The files stay the source of truth; a write path is what would let the board become a second, divergent backlog.
- **The body renders as pre-formatted text, not rendered markdown.** The contract asks that the body renders; a markdown renderer is a dependency and a surface this ticket does not need. Worth its own ticket if the plain view grates.
- **No polling.** The board loads on open; a board that has gone stale says so on the next open rather than streaming.

---

## Appended 2026-10-11 — a path was redacted from the Resolution above

The verification line for `/healthz` carried the machine's real checkout path, pasted from the output. That is operator topology in a **public** repository, which is the one law this project states first — so it is redacted to `<the repo root>`.

**Appended rather than silently edited**, so the change is visible: the record now says a redaction happened instead of pretending the line always read that way. Found while auditing the AI model logic (`docs/2026-10-11-ai-model-audit.md`), and now caught by `bin/guards/no-private-paths.sh` rather than by anyone's memory.
