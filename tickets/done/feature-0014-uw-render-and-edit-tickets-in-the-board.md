# feature-0014-uw-render-and-edit-tickets-in-the-board

**Type** feature · **Status** open · **Risk** medium · **Opened** 2026-10-10 · **Owner** @zerwiz

## Problem

**Current:** the board (`feature-0006`) is read-only and shows a ticket body as **pre-formatted text**. Every edit means opening an editor, and a table renders as pipes. **Expected:** the body renders, and the board can move a ticket between columns.

## Impact

**Affected:** the team reading tickets in the tool. Unrendered markdown is the difference between a board people use and a board they open once.

## Architecture intent

The **files stay the source of truth**. A write path is a narrow, guarded one — move a file between status directories — not a document editor.

## Requirements

- The body renders headings, lists, tables, code and links.
- A card can be moved between the four columns; the move is a `git mv` on the server, so history is preserved and the filename's status matches its folder.
- Moving a ticket that fails the naming guard is **refused**, with the guard's own message.
- No free-text editing of a ticket body in v1 — the contract is authored in a file, on purpose.
- Every write is logged (who, what, when) and the log carries no ticket content.

## Non-goals

Not a markdown editor; not drag-and-drop across a network; not issue-tracker features (assignees, priorities, sprints); not a second backlog.

## Test cases

- **Positive:** a table and a code block render; moving a card changes its folder and its filename.
- **Negative:** moving a malformed filename is refused with the guard's message.
- **Negative:** a body edit through the API is refused — there is no such route.
- **Compatibility:** with no board configured, nothing renders and nothing errors.

## Constraints

The board's server stays read-only for content; the only write is a status move. Path traversal stays refused.

## Resolution

_(filled on close)_

---

## Resolution

**Landed** 2026-10-10.

### Rendering — small, and safe by construction

`excalidraw-app/data/ticketMarkdown.ts` — a line-based renderer, no dependency: headings, fenced code, lists, tables, blockquotes, rules, paragraphs, and inline code/bold/italic/links.

**It escapes everything FIRST, then adds its own tags.** That order is the whole security story: a ticket file is _content_, and the board can be served publicly, so a file must never be able to inject markup. Links are http(s) only — anything else keeps its label and loses its href.

### Moving — the folder IS the status

`server/tickets/move.mjs`: `planMove` decides, `applyMove` does. `POST /api/tickets/move` is **the one write the board allows**; content stays authored in a file.

- **`git mv` inside a working tree** (a checkout), so history is preserved — and a plain rename on a deployment, where the ledger is a copy. **The log records which happened**, so nobody has to guess.
- **A malformed filename is refused with the guard's own reason**, not moved while wrong.
- The write log is append-only and records **who, what, when, and by which mechanism — never any ticket content**, the same rule as the room server's log.
- Traversal is refused at both ends by `safeResolve`.

### Verified

- **123 server tests** (up from 113). 10 for the move, including: a git tree records a **rename** (`^R` in `git status`), not a delete and an add; the log carries no content; a bad name leaves the file alone; a same-column move is refused as "already there".
- **14 renderer tests** — a `<script>` payload, an `<img onerror>`, and a `javascript:` link are all rendered inert; headings, code, lists, tables, quotes and rules all render; a real ticket's shape renders without breaking.
- **146 test files / 2514 app tests**; eslint, prettier and typecheck clean.
- **Live over HTTP:** the route moved a ticket in a scratch tree, refused a malformed name with the guard's message, logged the move, and the board kept answering afterwards.

### A real bug this ticket found, and the test that now catches it

The first route implementation read `url.pathname` **before** the `const url` that declares it — a temporal dead zone that **took the whole board down on the first request**, while every module test passed, because a module test never runs the handler. The fix is the declaration order; the guard is a new **HTTP-level test** that starts the real server process, moves a ticket, refuses a bad name, and asserts the board still answers afterwards.

### Not done, deliberately

**No free-text editing of a body.** The contract is authored in a file, on purpose — a write path for content is what would let the board become a second backlog. **No drag-and-drop**: the move control is buttons, which work with a keyboard and need no pointer.
