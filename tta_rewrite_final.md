# TTA client rewrite — final plan

> **2026-07-04** · authored by **fable-5** · client branch `dwelle/tta` (HEAD `3a7c9fbad`), server `excalidraw-plus` branch `dwelle/tta` (last TTA commit `b55f93d5b`, 2026-06-08).

This is the actionable simplification/cleanup/rewrite plan for the TTA client (`packages/excalidraw/TTA/*` + app wiring), **keeping feature parity** with the current implementation. It supersedes [tta_simplification.md](tta_simplification.md); every claim from that doc and from [tta.md](tta.md) that this plan relies on was **re-verified against today's code** (four independent deep-dives: state layer, streaming/canvas layer, wire protocol + server, feature/API inventory). Line refs below are current as of `3a7c9fbad`.

Two framing facts that shape everything:

- **TTA is unreleased.** `master` exports zero TTA symbols; the published `@excalidraw/excalidraw@0.18.0` predates the branch. The only consumer is [excalidraw-app/components/AI.tsx](excalidraw-app/components/AI.tsx). Public API shapes, persisted IndexedDB formats, and canvas `customData` tags may all change freely (wipe dev data; no migration code).
- **This is a staged refactor, not a big-bang rewrite.** Every step in §6 is independently shippable and keeps the suite green (or explicitly rewrites a named test). The server is treated as fixed; the client rewrite works against today's server. Server work is listed separately (§7) and is never a prerequisite.

---

## 1. Verified current state

### 1.1 tta.md findings — all client findings still current

Commit `3a7c9fbad` ("do not regenerate ids", 2026-06-15) changed exactly one line of product code — `regenerateIds: false` on the streaming/final preview insert ([useAIStreamingCanvasPreview.ts:229-232](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L229-L232)) — plus a test pinning same-id final-over-tombstone replacement. Everything else is as reviewed: **C1** (Enter bypass, [TTAComposer.tsx:203-204](packages/excalidraw/TTA/TTAComposer.tsx#L203-L204)), **C2** (EOF-as-success, [client.ts:314-324](packages/excalidraw/TTA/client.ts#L314-L324)), **C3** (retry has no catch, [TTADialog.tsx:1016-1036](packages/excalidraw/TTA/TTADialog.tsx#L1016-L1036)), **C4** (viewport offset, [insertAISkeletons.ts:24-45](packages/excalidraw/TTA/insertAISkeletons.ts#L24-L45)), **M1-M8** — all confirmed unfixed. One correction: the retry reset now writes **12** fields, not 9 ([TTADialog.tsx:966-987](packages/excalidraw/TTA/TTADialog.tsx#L966-L987)).

### 1.2 New findings (not in tta.md)

- **N1 🔴 Error-retry is broken against the current server whenever `started` arrived before the failure.** The server's retry lookup inner-joins `target_turn.current_message_id = retryAssistantMessageId` ([tta.ts:893-899](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L893-L899)), and `current_message_id` is promoted **only on successful** `saveGeneration` — a failed attempt never sets it. The client sends the _failed attempt's_ `messageId` ([TTADialog.tsx:1026](packages/excalidraw/TTA/TTADialog.tsx#L1026)), which by construction is never any turn's current message → `400 "Unknown assistant message for retry."` ([tta.ts:1048](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L1048)). Only error-retries where the failure preceded `started` (no `messageId` → field omitted → server starts a fresh turn) work today. Fix in §2.3; server-side modeling fix flagged in §7.
- **N2 🔴 Chat switch / chat delete mid-stream are unguarded** ([TTADialog.tsx:885-908](packages/excalidraw/TTA/TTADialog.tsx#L885-L908), [875-883](packages/excalidraw/TTA/TTADialog.tsx#L875-L883)): neither cancels the stream nor sets stop-requested (the history toggle is not disabled while sending). The orphaned stream keeps painting the old generation onto the canvas; on `done` it commits with `IMMEDIATELY` + selection, and `applyServerChatMetadata` → `applyServerChatId` flips the active chat back to the old id — the history-row id-swap ([TTADialog.tsx:193-206](packages/excalidraw/TTA/TTADialog.tsx#L193-L206)) can then **delete the newly selected chat's history row** while the auto-save writes the wrong messages under it. Fixed structurally by single-flight (§2.3).
- **N3 🟡 Intermediate preview elements leak into local persistence.** They're real scene elements inserted with `NEVER`; excalidraw-app's local save is unfiltered ([excalidraw-app/data/LocalData.ts:92](excalidraw-app/data/LocalData.ts#L92)) — only the Firebase/collab path filters via `isIntermediatePreviewElement` ([excalidraw-app/data/index.ts:46-57](excalidraw-app/data/index.ts#L46-L57)). A reload mid-stream resurrects orphaned, TTA-invisible preview elements with no cleanup anywhere. Fix in §2.4.
- **N4 Two message fields are dead:** `lifecycleStatus` is written at ~15 sites and **read by nothing**; `parseError` is **never set** anywhere (only cleared/copied). The status-union redesign is partly a deletion, not a migration.
- **N5 A `done` frame with no ids ever seen silently returns** ([useAIStreamingLifecycle.ts:308-310](packages/excalidraw/TTA/useAIStreamingLifecycle.ts#L308-L310)), leaving the bubble on `isComplete: false` forever. Unreachable against today's server (it always emits `started` first) but the rewrite's terminal contract removes the hole anyway.
- **N6 Dead code inventory** — see Appendix A. Highlights: `TTA_*_PATH` constants, the `[ai-server]` payload filter (nothing emits that prefix on the wire), the `done`-with-changed-chatId re-`onStarted` branch ([client.ts:262-277](packages/excalidraw/TTA/client.ts#L262-L277) — verified unreachable: the server resolves `chat` once and never reassigns), `getLatestAssistantTurnId(BeforeIndex)`, `getConversationTitle`, TTAComposer's entire uncontrolled mode + `rightActions`, `applyServerChatMetadata`'s ignored `turnId`/`messageId` params, ~14 dead i18n keys.
- **N7 `statusText` has two meanings** — live progress text while streaming, terminal summary label ("generated"/"empty") when done — reconciled by render-time branching in [TTAChatMessage.tsx:237-245](packages/excalidraw/TTA/TTAChatMessage.tsx#L237-L245).
- **N8 A test pins the C2 bug in:** `client.test.ts:230` ("…synthesizes a final payload when needed") asserts EOF-without-`done` returns a successful empty payload. It must be inverted, not preserved.
- **N9 Wire edge cases** the new client must handle: an `error` frame can be the _first and only_ frame (unknown-chatId 404 is thrown outside the generator's try and arrives as an in-stream error with **no `[DONE]`** — [tta.ts:2003](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L2003) vs try at :2032); `"aborted"` never appears on the wire (client-side fiction); the server emits `isComplete: true` on the final partial and `finishReason` on `done` — both currently discarded client-side.
- **N10 Server context window is the last 2 completed turns** (`MAX_CONVERSATION_TURNS`, [tta.ts:210-213](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L210-L213)). No client action; documents that local history depth has no server meaning.

---

## 2. Target design

Six moves. Each dissolves a bug class rather than patching instances; §5 lists the resulting (deliberate) behavior changes.

### 2.1 Message model: discriminated status union, three message kinds

Replace the 14-optional-field `AssistantChatMessage` bag and the fake-assistant warning bubbles with:

```ts
type ChatMessage = UserMessage | AssistantMessage | SystemWarningMessage;

type UserMessage = {
  role: "user";
  id: string; // stable, persisted (no re-minting on hydrate)
  content: string;
  images?: string[];
  createdAt: number;
};

type AssistantMessage = {
  role: "assistant";
  id: string; // local generation id: canvas tag + thumbnail key;
  // stable across error-retries, persisted
  createdAt: number;
  // reconciled once from `started`; metadata only (retry/truncate correlation)
  server?: { turnId: string; messageId: string };
  // id of the last *successful* attempt for this logical turn (see §2.3 / N1)
  lastCompletedMessageId?: string;
  skeletons?: readonly ExcalidrawElementSkeleton[]; // orthogonal payload
  status: AssistantStatus;
};

type AssistantStatus =
  | {
      kind: "streaming";
      phase: AIStreamProgressPhase;
      startedAt: number;
      statusText?: string;
    } // carried: free server text
  | {
      kind: "done";
      elapsedMs: number;
      outcome: "generated" | "empty";
      warning?: "length" | "content_filter";
    } // finishReason surfaced (§2.2)
  | { kind: "stopped"; elapsedMs: number; reason: "user" | "interrupted" }
  | {
      kind: "error";
      elapsedMs?: number;
      error: { code?: number; message: string };
    };

type SystemWarningMessage = {
  role: "system";
  id: string;
  createdAt: number;
  variant: AIRateLimitWarningDescriptor["variant"];
};
```

- **Deleted outright:** `lifecycleStatus` (write-only, N4), `parseError` (never set, N4), `isComplete` (≡ `status.kind !== "streaming"`), `stopReason`/`warningType`/`progressPhase`/`statusText`/`error` as independent fields, the commented-out `content` field, and the duplicated rate-limit numbers inside `error` (they live only in `ttaRateLimitsAtom`).
- **Derived at render:** spinner (`kind === "streaming"`), retry-eligibility (`kind === "error" | "done" | "stopped"` on the latest generation), terminal label (`outcome`), elapsed display. **Carried, not derived:** streaming `statusText` (arbitrary server text), `elapsedMs` (survives `startedAt` reset on retry).
- The 17 patch sites enumerated in the state-layer audit collapse to single `status =` assignments; `stopIncompleteAssistantMessages` becomes a one-line map (`streaming → stopped/interrupted`); the 12-field retry reset becomes `status = { kind: "streaming", phase: "starting", startedAt }`.
- Rate-limit warnings stop masquerading as assistant messages, so every `AssistantMessage` render/persist path can assume it's a generation (removes the `warningType` special cases in TTAChatMessage, `messagesToTurns`, retry-eligibility).
- Local ids become **stable across persistence** (today `turnsToMessages` re-mints them on hydrate, [chatHelpers.ts:92,103](packages/excalidraw/TTA/chatHelpers.ts#L92)); this is what lets the canvas tag and thumbnail cache key off `message.id` (§2.4, §2.6).

### 2.2 Terminal wire contract (client-only; works against today's server)

Rewrite `client.ts` (~356 → ~180 LOC) around one rule: **a stream succeeded iff a `done` frame arrived.**

- `iterateSSEJSONChunks` gets an **opt-in** `onDoneSentinel` callback (default behavior unchanged — TTD untouched; the parser already tolerates comment lines, so future server heartbeats need no client change). `TTAStreamFetch` then classifies fall-through: `done` seen → success; `[DONE]` seen but no `done` → "server closed without a result" (generation-error copy); bare EOF → transport-error copy ("connection lost"). **Both** failure classes preserve accumulated skeletons and offer Retry — this is the C2 fix; classification only refines the message, since a proxy timeout can still look like a clean EOF (and N9's no-`[DONE]` route-catch path means sentinel absence isn't proof of a cut).
- Forward the server's `partial.isComplete` instead of hardcoding `false`; carry `done.finishReason` on the final payload and map `length`/`content_filter` to `status.warning` (rendered as a warning line; partials kept). Only `stop`/`null` is a clean `outcome`.
- Fix `AIChatTruncateResponse` to the real shape `{ ok, chatId, updatedAt? }` (drop phantom `revision` — M4; nothing reads it, verified) and validate instead of `as`-casting.
- Delete: the changed-chatId re-`onStarted` branch (dead, N6), the `[ai-server]` filter (dead), `TTA_*_PATH` constants (dead).
- **On-error canvas policy** (specified once, applied to error frames, EOF, and thrown insert failures alike): treat non-success termination like user **Stop** — commit the last rendered draft via the existing NEVER→IMMEDIATELY dance and keep skeletons on the message, so chat bubble, thumbnail, and canvas agree. Sub-cases for retry/follow-up (this is the M8 fix): failure **before** the new generation rendered anything → previous generation stays on canvas with its replacement tag **left queued** (so the next successful generation still replaces it — clearing the queue here would strand two generations on canvas); failure **after** rendering → commit the new draft as-is. Today's behavior (wipe the draft, [useAIStreamingLifecycle.ts:288-296](packages/excalidraw/TTA/useAIStreamingLifecycle.ts#L288-L296)) is replaced.
- Keep: fetch injection, rate-limit header extraction, `!ok` body parsing, abort→499 mapping, the `TTATransportAdapter` surface (`{ stream, truncate }` — [client.ts:157-162](packages/excalidraw/TTA/client.ts#L157-L162)) so [excalidraw-app/components/AI.tsx:81-86](excalidraw-app/components/AI.tsx#L81-L86) needs no changes. Keep relying on `started` arriving only after the attempt row is durable (it's the truncate/retry correlation anchor).
- Test impact: invert `client.test.ts:230` (N8); the other six cases describe behavior to preserve.

### 2.3 Single-flight generation owner

One `runGeneration` action — the sole entry point for send **and** retry — that reserves the in-flight slot synchronously **before any chat mutation**, then mutates, then streams, with one `catch`:

```ts
const inFlightRef = useRef<AbortController | null>(null); // authority
const [isSending, setIsSending] = useState(false); // render mirror, set only here

function runGeneration(input): void {
  if (inFlightRef.current) return; // send while streaming = no-op
  const ac = new AbortController();
  inFlightRef.current = ac;
  setIsSending(true);
  mutateChatState(input); // safe: slot already reserved
  stream(ac)
    .catch(handleGenerationFailure) // single catch — C3 gone
    .finally(() => {
      if (inFlightRef.current === ac) {
        inFlightRef.current = null;
        setIsSending(false);
      }
    });
}
```

Policy table (parity-preserving where behavior was defined; defining it where it wasn't):

| Affordance while streaming | Today | Target |
| --- | --- | --- |
| Enter / send button | Enter bypasses (C1) | **no-op** (guard in `runGeneration`, not the keyboard handler) |
| Stop | works | unchanged — the single escape hatch |
| Retry/regenerate (older message) | cancels active stream first | unchanged (cancel-and-replace via the owner) |
| New-chat button + Cmd/Ctrl+Shift+O | disabled | unchanged |
| History chat-switch / delete chat | **unguarded (N2)** | auto-stop first (identical to pressing Stop: commit draft, mark bubble `stopped/interrupted`), then proceed |

- `isSendingChat` state, `stopRequestedRef`, and the scattered `cancelActiveStream`/`setStopRequested` call sites (5 today) collapse into the owner. The `generateResponse` controller-overwrite and finally-clobber races become unreachable.
- **Retry payload fix (N1):** send `retry.retryAssistantMessageId` = the turn's **last successful** attempt id (`lastCompletedMessageId`, recorded from each `done` frame) — that is what the server's lookup actually keys on. When the turn never succeeded, omit the field: the server then starts a fresh turn with the explicitly-sent prompt (works today; the dangling failed turn is invisible to context and falls under the M14 retention track). Regenerate keeps its current semantics (id of the successful attempt = same value). Keep the retry-context image export and `avoidSimilarity` behavior byte-for-byte.
- Keep: `MIN_RETRYING_VISIBLE_MS`, error-retry reusing the bubble id vs regenerate replacing it (pure UI semantics now), the retry-eligibility rule (latest retryable generation only).

### 2.4 Canvas draft: one owner, one key

Merge `useAIStreamingCanvasPreview` + the TTADialog generation-tag trio (`queueGenerationReplacement`/`commit…`/`clear…` + `pendingGenerationReplacementTagsRef`, [TTADialog.tsx:584-624](packages/excalidraw/TTA/TTADialog.tsx#L584-L624)) into a single `useCanvasDraft` hook owning one record:

```ts
{ generationId: string; elementIds: string[]; targetCenter: Point | null;
  queuedReplacementTags: string[] }
```

- **Key by the local generation id** (`message.id`), stamped into `customData[AI_GENERATED_ELEMENTS_KEY]` and persisted with the message — known synchronously at send time, stable across reload (§2.1), so the late-bound-`messageId` choreography (`activeCanvasDraftMessageIdRef` becoming meaningful mid-stream, the `chunks-before-started` guard, the `ai-delete-${id}` fallback tags in [chatHelpers.ts:219-221](packages/excalidraw/TTA/chatHelpers.ts#L219-L221)) all disappear. Server `messageId` remains message metadata only.
- Replace both hand-rolled throttles with **one shared throttle helper** (leading + trailing edge, `flush()`/`cancel()`): the canvas draft gets the missing trailing flush (M1 — no more frozen canvas on provider stalls), and the thumbnail hook sheds its 7-ref scheduler (§2.6).
- Public API of the hook (the five near-synonym cleanup verbs collapse): `applyChunk(result)`, `applyFinal(result)`, `commitDraft()` (Stop + on-error policy §2.2), `replacePrevious(prevGenerationId)` (queue semantics absorbed), `clearDraft()`, `reset()`.
- **Keep verbatim** (pinned by tests): the NEVER-tombstone → IMMEDIATELY-commit dance ([useAIStreamingCanvasPreview.ts:108-173](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L108-L173)), same-id version-bump replacement ([insertAISkeletons.ts:223-233](packages/excalidraw/TTA/insertAISkeletons.ts#L223-L233)), `regenerateIds: false` for streaming/final, `targetCenter` anchoring to the first chunk's bounds, "previous generation stays visible until the new one has drawable content", queue surviving stop/error-without-render.
- **N3 fix** (excalidraw-app + package): export `isIntermediatePreviewElement`/the customData keys from the package (dedupe the string copy in [excalidraw-app/data/index.ts:46](excalidraw-app/data/index.ts#L46)); filter intermediate-preview elements in `LocalData` save like the Firebase path already does; add a cheap mount-time sweep in the dialog that tombstones orphaned flagged elements (defense against scenes saved by older builds).
- `insertAISkeletons` itself: fix **C4** by computing the viewport center via `viewportCoordsToSceneCoords` (drop the wrong `- offsetLeft` and the type cast); unify on `syncActionResult` vs `updateScene` per the rule "element-only mutations → `updateScene`; anything captured/selected → `syncActionResult`" and write that rule down where the split lives today ([TTADialog.tsx:512-523](packages/excalidraw/TTA/TTADialog.tsx#L512-L523)). Everything else (deleteGenerationTags, fixBoundTextElements/tempScene, selection excluding bound texts) stays.

### 2.5 One conversation representation + persistence policy

- **Persist the flat `ChatMessage[]` per chat.** Delete `messagesToTurns`, `turnsToMessages`, `toAssistantTurnMessage`, `AssistantChatTurnMessage`, `ChatTurn`, and merge the title helpers (the round-trip is verified lossy: stores all assistant messages per turn, reads back only the last; drops anything without a `turnId`). `ChatConversation` becomes `{ id, title, updatedAt, messages: ChatMessage[] }`. History search moves from `turn.prompt` to user-message content — same results.
- **Per-chat IndexedDB keys** replace the single `"all"` blob (M2): `TTAPersistenceAdapter` becomes `{ loadChats(): Promise<ChatConversation[]>; saveChat(chat): Promise<void>; deleteChat(id): Promise<void> }` (public type change — fine, unreleased). Only the **active** chat is ever written.
- **Write policy:** persist the user message at send time for an existing chat; for a brand-new chat, buffer until `started` delivers the `chatId` (sub-second window; this same gate deletes the history-row id-swap and its N2 corruption path). Persist assistant messages **only at a terminal status** — never per-partial — so streaming stops re-serializing the whole history with skeleton payloads on the main thread. Consequence (accepted trade-off, same as the old plan): a reload mid-generation yields a prompt-only turn with a re-run affordance (re-run = fresh turn, same prompt — true resume is server work, out of scope); today's accidental partial-draft resurrection (which hydrates as a stuck bubble needing the interrupted-sweep anyway) goes away.
- **Hydration merges by id + `updatedAt`** instead of replacing (M3). Cross-tab: per-chat keys reduce clobbering to same-chat conflicts; a `BroadcastChannel` refresh is a cheap optional follow-up, not part of this plan.
- **Persist terminal error bubbles** (small deliberate change — today they're dropped by the `turnId` filter, arguably by accident); keep **dropping** rate-limit warning bubbles (session-scoped).
- Chat-id/updatedAt bookkeeping (`applyServerChatId`, `applyServerChatMetadata`, `getServerChatId`, `updateHistoryChatUpdatedAt`, `applyActiveChatUpdatedAt`, `touchActiveChatUpdatedAt`, `chatIdRef` + sync effect — ~90 lines of [TTADialog.tsx:116-266](packages/excalidraw/TTA/TTADialog.tsx#L116-L266)) moves into `useTTAChatHistory` and shrinks to: one "adopt server chatId on `started`" handler + one `touch(updatedAt)`.

### 2.6 Thumbnails (`useAIAssistantPreview`)

Rewrite ~378 → ~160 LOC: one `useEffect` + epoch token + the shared throttle (trailing flush already exists here; behavior unchanged), **LRU-capped cache (~32 entries)** cleared on chat delete (M7). Keep: render-key semantics (id + theme + streaming/complete + skeletons reference equality), `enabled: false` idle path for offscreen history rows (IntersectionObserver lazy rendering), theme-aware SVG export, cache hits for completed messages. Keying by the now-stable local id also stops cache misses after reload.

### 2.7 Target file map

| File | Now | Target | Change |
| --- | --- | --- | --- |
| TTADialog.tsx | 1371 | ~600 | sheds id bookkeeping (§2.5), tag trio (§2.4), stop/retry field-bag patches (§2.1), one merged scroll effect; keeps composition, modal, focus/keyboard, delete orchestration, support banner |
| useAIStreamingLifecycle.ts | 431 | `useGeneration.ts` ~260 | absorbs single-flight owner (§2.3); sheds 5 preview pass-throughs, idle-timer field juggling |
| useAIStreamingCanvasPreview.ts | 342 | `useCanvasDraft.ts` ~240 | absorbs tag queue; sheds throttle boilerplate |
| useAIAssistantPreview.ts | 378 | ~160 | §2.6 |
| client.ts | 356 | ~180 | §2.2 |
| chatHelpers.ts | 291 | ~90 | round-trip + dead helpers gone |
| types.ts | 223 | ~190 | union model |
| useTTAChatHistory.ts | 164 | ~220 | absorbs bookkeeping |
| history.ts | 35 | ~70 | per-chat keys |
| _(new)_ shared throttle | — | ~40 |  |
| **State/lifecycle/protocol core** | **~3,590** | **~2,050 (−43%)** |  |

UI components (Composer 441, Panel 359, ChatMessage 467, History 371, EmptyState 101, Warning 15 ≈ 1,750 LOC) are mostly untouched apart from: Composer loses its uncontrolled mode/`rightActions` (~−60), ChatMessage's render branches re-key onto `status.kind` (mechanical), and small §5 items.

---

## 3. Do not touch (verified solid; several pinned by tests)

- The NEVER→IMMEDIATELY commit dance and its rationale comment; same-id version-bump replacement; `deleteGenerationTags` swap semantics; `fixBoundTextElements` + throwaway-`Scene` trick; `targetCenter` first-chunk anchoring; `regenerateIds: false` for streaming (all pinned by `useAIStreamingCanvasPreview.test.tsx` / `insertAISkeletons.test.ts`).
- `insertAISkeletons` conversion pipeline (`convertToExcalidrawElements` → `restoreElements(repairBindings)` → `normalizeElbowArrows`), frame/binding handling, selection excluding bound texts.
- `sse.ts` parser core (CRLF, multi-line data, comments, abort handling) — only the additive `onDoneSentinel` option is added.
- Delete flow's re-insert of the latest remaining result with `regenerateIds: true` + `deleteGenerationTags` (single captured update).
- Retry-context image export (`exportImageFromMessageSkeletons`) and `avoidSimilarity` semantics.
- Server-side: element-id remap (`elementIdRemap`/`stableId`), eager iterable, repair ladder — out of scope entirely.

---

## 4. Feature-parity checklist

The rewrite is done only when every box below still holds (source: exhaustive component inventory, 2026-07-04). Items marked ⚠ are places where a naïve rewrite historically loses behavior.

**Trigger & panel** — floating "Generate" pill in footer-right tunnel, gated `aiEnabled !== false` (both gates: Footer + dialog); toggles floating panel (fixed bottom-right, 400×720 max); **hidden ≤768px**; pin toggle (default **pinned**), unpinned closes on canvas `pointerdown` and on sidebar open; ⚠ pinned panel shifts left of an open sidebar by measured width (ResizeObserver), trigger shifts when sidebar undocked; header: New Chat (only with conversation; disabled while sending), history toggle, pin, close — all tooltipped; `role="dialog"`, `aria-modal="false"`, `aria-expanded`/`aria-controls` on trigger.

**Composer** — auto-grow textarea (240px cap); placeholder variants: default / refine (conversation exists) / rate-limited (+ whole composer disabled at quota 0); Enter sends, Shift+Enter newline, ⚠ IME `isComposing` guard; ⚠ wheel events don't zoom canvas; image attach via picker (multi, `IMAGE_MIME_TYPES`) **and paste** (no drag&drop today — don't add); resize→JPEG 1024px, dedupe by content hash; max-images warning (host `onMaxImages` node or i18n, `role="alert"`); thumbnail row with preview-modal open (click/Enter/Space) and per-image remove; send button ⇄ Stop button swap while sending.

**Streaming UX** — phases starting→waiting→generating→(thinking|finalizing via ⚠ 5s idle timer); server `message` text overrides phase label; spinner + live elapsed ticker (m:ss / h:mm:ss); terminal lines "completed in / failed after / stopped after {time}" + stop reason (user/interrupted); "generated/empty response" label when complete without preview.

**Canvas** — 300ms-throttled skeleton inserts centered on viewport (⚠ subsequent chunks anchored to first chunk's center); elements tagged with generation id; previous generation removed only when the next one first renders; final insert = one undo step + select; Stop commits the current draft as real undoable elements; per-generation replace on retry/regenerate.

**Messages** — user bubble: role label, timestamp, content, image thumbs (modal), copy-with-checkmark; assistant bubble: theme-aware SVG thumbnail (streaming-live ≤300ms cadence, cached when done), click inserts to canvas, ⚠ scroll keeps message top visible during streaming growth; actions when terminal: To canvas (regenerates ids + selects), Retry/Regenerate (latest generation only; disabled at quota 0), Delete (ConfirmDialog; first-turn variant wipes chat; server truncate + canvas rebuild of latest remaining result; ⚠ local truncate proceeds on server failure — M5 unresolved, keep or fix per §8); rate-limit system bubble (host `renderWarning` override replaces the whole row) + dedupe/merge on repeat; error bubbles with offline/connection sniffing; dismissible support banner (GitHub/Discord) after latest error.

**Empty state & history** — "continue where you left off" card (thumbnail, title, relative time); host `renderWelcomeScreen({rateLimits})` fallback to built-in guidance; history overlay: auto-focused substring search over titles+prompts, `updatedAt` desc, lazy thumbnails (IntersectionObserver, ⚠ no-IO fallback renders all), inline rename (Enter/Escape + buttons), delete (instant today — see §8), select → mark in-flight as interrupted → scroll bottom → focus composer.

**Keyboard** — Enter/Shift+Enter (composer); Escape closes preview modal (capture, swallowed); ⚠ Tab anywhere while open steals focus to composer; Cmd/Ctrl+Shift+O new chat (open + conversation + not sending + no modal); history Escape cascade (rename → search → close); Enter/Space activate image thumbs.

**Host API (may reshape, must re-expose equivalents)** — `TTADialogProps { transportAdapter (required), maxImages, onMaxImages, renderWelcomeScreen, renderWarning, persistenceAdapter }`; exports `TTADialog`, `TTAIndexedDBAdapter`, `TTADefaultTransportAdapter`, `TTAStreamFetch` + types; rate limits from `X-Ratelimit-*` headers; ⚠ `/tta-chat-empty.svg` is a root-absolute URL — import it instead (M6).

**Non-features to not accidentally add:** no mobile UI, no command-palette entry, no editor shortcut to open, no zoom-to-fit on insert, no appState persistence of open/pinned.

---

## 5. Deliberate behavior changes (bug fixes, not parity breaks)

1. C2: disconnect/EOF → error with partials kept + Retry (was: success "empty response" + canvas wipe).
2. C1/N2: send is a no-op while streaming; chat switch/delete auto-stop first (was: concurrent streams / orphaned stream corruption).
3. C3/N1: retry failures surface in the bubble; error-retry targets the last _successful_ attempt or starts a fresh turn (was: unhandled rejection; server 400 on most error-retries).
4. C4: inserts centered correctly in offset-embedded hosts.
5. M1: canvas keeps rendering through provider stalls (trailing flush).
6. M8/§2.2: failed follow-up no longer strands an empty canvas.
7. M4/M6/M7, N3: truncate type honesty; bundled empty-state asset; bounded thumbnail cache; preview elements filtered from local persistence.
8. Reload mid-generation: prompt-only turn + re-run affordance (was: resurrected half-draft normalized to "interrupted").
9. `finishReason: length`/`content_filter` render a truncation warning (was: indistinguishable from success).
10. Terminal error bubbles survive reload (was: silently dropped).

---

## 6. Sequencing

Each step ships independently; run `yarn test:typecheck` + `yarn test:update` per step. **Before starting: run the TTA suites once to baseline** — tta.md/tta_c4.md report 2 pre-existing `insertAISkeletons.test.ts` failures on this branch.

| # | Step | Fixes | Test impact |
| --- | --- | --- | --- |
| 0 ✅ | **Dead-code sweep + micro-fixes**: Appendix A deletions; C4 via `viewportCoordsToSceneCoords`; M6 asset import; dedupe `DEFAULT_MAX_IMAGES` + preview-key constants; merge scroll effects | C4, M6, N6 | `insertAISkeletons.test.ts` center expectations |
| 1 ✅ | **Terminal contract** (§2.2): `client.ts` rewrite, `sse.ts` `onDoneSentinel`, on-error canvas policy via existing commit dance | C2, M4, N5, N8, N9 | invert `client.test.ts:230`; keep other 6 green; audit TTD untouched |
| 2 ✅ | **Single-flight owner** (§2.3): `runGeneration`, retry-target fix, gate switch/delete | C1, C3, N1, N2 | new tests: double-send no-op, switch-mid-stream stops, retry-after-fail payload |
| 3 | **Status union + message split** (§2.1) — mechanical, broad | N4, N7 | port `useAIStreamingLifecycle.test.tsx`; TTAChatMessage render keys |
| 4 | **Flat conversation + persistence policy** (§2.5) — land back-to-back with 3 (both change the persisted shape; wipe dev IndexedDB once) | M2, M3, M5 hygiene | rewrite chatHelpers tests; new hydrate-merge test |
| 5 | **Canvas draft owner** (§2.4): merge hooks, local-id tag, shared throttle; N3 LocalData filter + sweep | M1, M8, N3 | rewrite `useAIStreamingCanvasPreview.test.tsx` keeping the pinned invariants (tombstone→IMMEDIATELY order, single-instance-per-id, version monotonicity, flag stripping) |
| 6 | **Thumbnail hook rewrite + LRU** (§2.6) | M7 | new cache-bound test |
| 7 | **TTADialog decomposition**: extract `useTTAChatActions` (send/retry/delete/stop orchestration), fold remaining bookkeeping per §2.5; final polish (§8 leftovers) | §4.4 of tta.md | none beyond green suite |

Steps 1–2 clear every 🔴 client bug with no data-model change. Steps 3–5 are the structural shrink. After step 7, verify the §4 checklist end-to-end against the running app (chrome-devtools MCP) including: stop mid-stream, retry-after-parse-error (N1!), chat switch mid-stream, reload mid-stream, offset-embedded host insert, two-tab history.

**Progress log**

- ✅ **Live QA of steps 0–2 (2026-07-18, localhost:3005 + dev oss-ai-server)**: basic generation + follow-up replacement ✓; C1 Enter-while-streaming is a no-op keeping composer text ✓; Stop mid-stream commits the partial (flag stripped, "Stopped after", To canvas/Retry) ✓; C2 via spliced stream (clean EOF, no `done`) → "Connection to the AI service was interrupted" + Retry, previous generation preserved (failed gen never rendered → M8 sub-case), replacement queue survived the failure and the retry's success replaced correctly ✓; N1 retry payload verified on the wire: `retry.reason: "generation_error"` with **no** `retryAssistantMessageId` for a never-succeeded turn, retry completed (no 400) ✓; N2 chat switch mid-stream auto-stops ("Generation interrupted", partial committed) ✓. Note: successful SSE requests show cosmetic `net::ERR_ABORTED` in DevTools. **Correction after follow-up investigation (2026-07-18):** this is a Chromium/CDP reporting quirk for cross-origin SSE fetches, _not_ caused by abandoning the body — verified by A/B comparison (a fully-drained-to-EOF stream logs the same annotation). Unfixable client-side; a bounded detached post-terminal drain was kept anyway (honest win: the keep-alive connection can be reused instead of torn down) with a regression test pinning full consumption.

- ✅ **Step 2 landed 2026-07-05**: new `useGenerationSlot` hook (ownership-checked single-flight slot) + a `runGeneration` owner in TTADialog — the sole entry point for send and retry — that reserves the slot synchronously before any chat mutation (C1: a send while streaming is a no-op that keeps the composer draft), with one shared catch that patches the generation's own bubble or appends an error bubble (C3). Retry goes through the owner with `replaceActive` (cancel-and-replace, preserved semantics incl. `MIN_RETRYING_VISIBLE_MS` and reuse-vs-replace bubbles). **N1 fix**: new persisted `lastCompletedMessageId` field (stamped from every `done`, surviving failed retries, seeded onto regenerate's replacement bubble, carried through the turns round-trip) is now the retry target — with a legacy-data fallback to `messageId` for cleanly-completed bubbles — and is omitted when the turn never succeeded (server starts a fresh turn). **N2 fix**: chat switch and active-chat delete now run `stopActiveGeneration("interrupted")` (extracted full-Stop semantics: abort + commit draft + free slot + mark bubble) before proceeding; message-delete keeps its no-commit teardown but now cancels pending renders and frees the slot. Lifecycle: `generateResponse`'s `finally` is ownership-checked (a canceled predecessor can no longer clobber the successor's controller/throttle/stop state — a live race today) and each stream starts from a reset throttle state. `isSendingChat` state + all 8 scattered `setIsSendingChat`/`setStopRequested` call sites collapsed into the owner. Tests: 3 `useGenerationSlot` unit tests (double-acquire no-op, release, stale-release ignored); dialog-level interaction tests (switch-mid-stream, retry payload) deferred to the step-7 `useTTAChatActions` extraction where the actions become testable without mounting the full dialog — cover via live QA meanwhile. 39 passing, typecheck clean.
- ✅ **Step 1 landed 2026-07-05** (commit follows step 0's): success now requires a `done` frame — EOF/`[DONE]`-without-`done` returns `STREAM_INTERRUPTED` (1002, two log-level message flavors, user copy = existing connection/offline keys); on-error canvas policy switched from wipe to commit-like-Stop (both the transport-error branch and the thrown-`INVALID_RESULT` catch), with error-retry now queueing the failed generation's tag for replacement; salvage UI included (errored bubbles with partial skeletons render their thumbnail + "To canvas" — formerly tta_c2.md Phase 2, made mandatory by the commit policy so bubble/canvas agree); `partial.isComplete` forwarded (the lifecycle explicitly renders partials as non-final to avoid double-committing on the server's final partial); `done.finishReason` carried and `length`/`content_filter` surface as a `truncatedResponse` status line (full warning treatment arrives with the step-3 union); truncate response validated with the real `{ ok, chatId, updatedAt? }` shape (M4); deleted the dead `[ai-server]` filter and changed-chatId re-`onStarted` branch; N5 spinner-forever hole closed. Deliberate deviation from Appendix A: `lifecycleStatus` optionality on client chunk types stays defensive until the shared-types work (§7.5). Tests: `client.test.ts` EOF-as-success case inverted + 2 new interrupt cases + isComplete-forwarding case, 2 new `sse.test.ts` sentinel cases, 1 new lifecycle interrupted-stream case — 36 passing, typecheck clean, TTD untouched.
- ✅ **Step 0 landed 2026-07-05** (net −71 lines): C4 fixed + 3 new centering tests; all step-0 Appendix A deletions done (12 dead i18n keys removed after cross-repo grep; `allowImageUpload` prop dropped too — equally dead); M6 fixed by inlining the SVG as a data URI in new [assets.ts](packages/excalidraw/TTA/assets.ts) (`public/tta-chat-empty.svg` deleted). Bonus: fixed a pre-existing `yarn test:typecheck` break from `3a7c9fbad` (the `syncActionResult` mock in `useAIStreamingCanvasPreview.test.tsx` lacked `captureUpdate`). Baseline confirmed: the 2 known `insertAISkeletons.test.ts` failures pre-date the rewrite; gate after step 0 = typecheck clean, 24 TTA tests passing + those 2.

---

## 7. Server companion work (flagged, not prerequisites)

All independently shippable; the client plan above assumes none of them.

1. **N1 proper fix**: allow retry lookup by `turn_id` of any known attempt (or fall back to the turn when `current_message_id` is null) — makes failed-turn retry a real attempt-on-same-turn instead of the client's fresh-turn workaround.
2. **S1** (`try/finally` terminal status in `streamTta`) and **S5** (journal-orphaned Plus migration — release blocker) per [tta_s1.md](tta_s1.md)/[tta_s4.md](tta_s4.md).
3. **Terminal-frame hardening** (complements §2.2): emit error frames through `StreamingResponse.end()` so `[DONE]` always follows (route-catch path omits it today); move `loadGenerationContext` inside `streamTta`'s try; map `finishReason length/content_filter` → error/warning before `done`; add a comment-line heartbeat to `StreamingResponse` (client parser already tolerates it).
4. **S2** abort-refund loophole, **S3** non-additive partial throttling, **S4** advisory-lock order assignment — per their proposals.
5. **Shared wire types** (single source for `tta-types.ts` ⇄ client `types.ts`) once the client shape settles (step 3).
6. **TODO — `net::ERR_ABORTED` on successful SSE fetches**: Chromium tags every cross-origin TTA stream request with `net::ERR_ABORTED` even when the body is fully drained to EOF (verified 2026-07-18 by A/B: abandoned-after-`done` vs read-to-EOF both log it; client-side fixes are exhausted — the bounded drain in `client.ts` stays for keep-alive reuse only). If this ever pollutes prod error tracking/monitoring, investigate server-side: how `StreamingResponse` closes the socket after `end()` (connection-close vs keep-alive semantics, missing `Content-Length`, chunked-terminator handling) in `libs/server/fastifyutils/src/lib/streaming.ts`.

Client-minted ids (old plan's Principle 1) are **dropped from scope entirely**: verified to require race-safe upserts + state-aware idempotency dedup server-side, while the client-side wins it promised are achieved by §2.4 (local canvas key) and §2.5 (buffer-until-`started`) without any server change.

---

## 8. Open decisions (recommendations inline)

1. **M5** — delete currently truncates locally even when server truncate fails. Recommend: keep optimistic local truncate but surface a retryable toast (cheap once `useTTAChatActions` exists). Parity option: keep silent.
2. **History chat delete has no confirm** while message delete does. Recommend: add the same ConfirmDialog (tta.md low item). Parity option: keep instant.
3. **Persisting error bubbles** (§2.5) — recommend yes; revert to dropping if it reads noisy.
4. **Rename input maxLength** (titles derive at 80 chars) — recommend `maxLength={80}` while in TTAHistory anyway.
5. OSS-side M13 (unscoped chats) and the 100/day `FIXME` limiter — server/product calls before release, unaffected by this plan.

---

## 9. Relationship to tta_simplification.md

**Kept (verified sound):** the status-union, terminal-frame, single-flight, local-canvas-key, flat-representation, and hook-consolidation moves (its Principles 2–7); the persist-terminal-only policy incl. the orphan-turn/re-run analysis; the §8 dead-path and OSS-IDOR verifications (re-confirmed independently, refs accurate).

**Corrected:** Principle 1 (client-minted ids) is dropped, not merely demoted — its two real benefits are obtained client-side (§2.4/§2.5) and its server cost was under-motivated. Its Principle 5 needed the reload-derivability qualifier: the canvas tag must be persisted with the message (solved by stable local ids + flat persistence), which that doc's local-key sketch glossed over. Its "four refs + a cross-hook trio" accounting was slightly off (five refs, one component up). Chunks-before-`started` is unreachable against this server, so late-binding was a choreography cost, not a correctness one.

**Missed by it (new here):** N1 (error-retry 400s — its own cross-cutting section hinted at the modeling gap but not the live client bug), N2 (chat-switch corruption), N3 (preview-element persistence leak), N4 (two fields already dead — the union is partly deletion), N7, N8 (a test pins C2), N9 (no-`[DONE]` error path), the §4 parity checklist, and the dead-code inventory.

---

## Appendix A — deletion list (step 0 unless noted)

- ✅ [chatHelpers.ts](packages/excalidraw/TTA/chatHelpers.ts): `getLatestAssistantTurnId`, `getLatestAssistantTurnIdBeforeIndex`, `getConversationTitle` (keep `FromTurns` variant until step 4 merges them); ⏳ round-trip trio + `AssistantChatTurnMessage`/`ChatTurn` (step 4).
- ✅ [client.ts](packages/excalidraw/TTA/client.ts): `TTA_BASE_PATH`/`TTA_GENERATE_STREAM_PATH`/`TTA_TRUNCATE_PATH`; `[ai-server]` `ignorePayload` filter; changed-chatId re-`onStarted` branch; `AIChatTruncateResponse.revision` (all done — steps 0+1).
- ✅ [types.ts](packages/excalidraw/TTA/types.ts): commented-out `content`; ⏳ `parseError`, `lifecycleStatus` on client messages (step 3); `AIStreamFinalPayload.lifecycleStatus` optionality drift (step 1).
- ✅ [TTAComposer.tsx](packages/excalidraw/TTA/TTAComposer.tsx): uncontrolled value/images mode + `rightActions` + `allowImageUpload` props; local `DEFAULT_MAX_IMAGES` (`value`/`images`/`maxImages` now required — TTADialog always passed them). Kept `selectedImagesRef`: it guards async staleness in `appendImageFiles`, not the uncontrolled mode.
- ✅ [TTADialog.tsx](packages/excalidraw/TTA/TTADialog.tsx): `applyServerChatMetadata`'s unused `turnId`/`messageId` params; unexport `ttaChatMessagesAtom`/`ttaRateLimitsAtom` (no consumers); merged the two scroll effects; ⏳ `chatIdRef` (step 4).
- ✅ i18n `en.json`: `ai.chat.newChat`, `ai.chat.viewGeneratedResult`, `ai.chat.prompts.*`, `ai.chat.status.{syntaxErrorFixing,errorFixing}`, `ai.chat.errors.{title,serverError,generationError,requestError,tryAgain,configuration,technicalDetails}` (all 12 confirmed unused in both repos before removal).
- ⏳ excalidraw-app: duplicated `INTERMEDIATE_PREVIEW_ELEMENT_KEY` string in [data/index.ts:46](excalidraw-app/data/index.ts#L46) (import from package, step 5).
