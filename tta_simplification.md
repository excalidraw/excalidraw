# TTA client⇄server model — simplification analysis

Companion to [tta.md](tta.md). That review catalogued *bugs*; this document asks a
different question: **can the client⇄server contract be reshaped so that whole
classes of those bugs stop being expressible?** The focus is the client-side
lifecycle/state handling, with the server changes needed to enable the
simplification.

Reviewed the same surface: client `packages/excalidraw/TTA/*`
(entry [TTADialog.tsx](packages/excalidraw/TTA/TTADialog.tsx)), app wiring
[excalidraw-app/components/AI.tsx](excalidraw-app/components/AI.tsx), server
`excalidraw-plus/libs/server/tta/src/lib/tta.ts` + routes
`apps/api/src/routes/ai.ts` / `apps/oss-ai-server/src/api/ai.ts`, shared wire
types `libs/global/types/src/lib/tta-types.ts`.

---

## 0. TL;DR — the thesis

The client is complex not because the feature is complex, but because **state is
duplicated across five stores that must be reconciled by hand**, and because
**late-bound server identifiers are used as client/canvas keys while the stream's
terminal state is ambiguous**, so the client spends most of its lifecycle code
*catching up to* the server rather than *driving* it.

Three structural moves remove the bulk of the lifecycle/state code and dissolve
most of the lifecycle bugs in tta.md (C1, C2, C3, S1, and the §4 design notes):

1. **One status state machine per assistant message** (a discriminated union),
   replacing the current bag of ~11 loosely-coupled fields reconciled by hand in
   ≥4 places. *(Principle 2 below.)*
2. **One mandatory terminal frame** (`done | error`), with EOF-without-terminal
   treated as an error that *keeps* partial work. → fixes C2 structurally.
   *(Principle 3.)*
3. **Single-flight reserved before any chat mutation** — in a shared
   `runGeneration` action, not scattered UI flags. → fixes C1 structurally, and
   makes C3 (unhandled retry rejection) a non-issue. *(Principle 4.)*

Three supporting moves shrink the component further: key the canvas by a stable
**local generation id** (not the late-bound server `messageId`) and collapse the
preview refs; store the conversation in a **single representation** (drop the
lossy `messages ⇄ turns` round-trip); and move chat bookkeeping into the history
hook. *(Principles 5–7.)*

**Client-owned identifiers** (client-minted `chatId`/`turnId`/`messageId`; server
upserts instead of 404ing) are a worthwhile *optional* follow-up — they delete
the residual id-reconciliation and add network-retry idempotency — but they are
**not** the load-bearing fix and are required by none of the above. Principle 1
explains why, and gives a `chatId`-only minimal version. It is listed first only
because later principles reference it.

Net: [TTADialog.tsx](packages/excalidraw/TTA/TTADialog.tsx) (1.4k lines) and
[useAIStreamingLifecycle.ts](packages/excalidraw/TTA/useAIStreamingLifecycle.ts)
shrink substantially, and the "forgot to reset field X / forgot to guard Y"
bug class largely disappears.

> **To act, read this TL;DR + §7 (sequencing).** §1 (problem) and §2–6 (the
> principles, protocol, server changes) are rationale/reference; §8 is
> risk-tracking. The actionable plan is the TL;DR and the sequenced steps.

---

## 1. Where the complexity actually lives today

### 1.1 Five sources of truth, reconciled by hand

| Store | Owner | Shape | Persisted |
|---|---|---|---|
| `chatMessages` atom | TTADialog | flat `ChatMessage[]` | no (session) |
| canvas draft | `useAIStreamingCanvasPreview` refs | element ids + center + throttle state | no (the Excalidraw scene) |
| `chatHistory` atom | `useTTAChatHistory` | `ChatConversation[]` (turn-based) | yes (IndexedDB) |
| `activeChatId` / `activeChatUpdatedAt` atoms | `useTTAChatHistory` | scalars | no |
| server DB | `tta.ts` store | `tta_chats / tta_chat_turns / tta_chat_turn_messages` | yes |

The same logical fact ("this turn produced these elements, server id X,
updated at T") is written into all five and must be kept consistent. That
reconciliation *is* the complexity:

- `applyServerChatId`, `applyActiveChatUpdatedAt`, `updateHistoryChatUpdatedAt`,
  `applyServerChatMetadata`, `getServerChatId`, `touchActiveChatUpdatedAt`, plus
  `chatIdRef` and a hydration effect — all in
  [TTADialog.tsx:178-266](packages/excalidraw/TTA/TTADialog.tsx#L178-L266) —
  exist solely to thread server identity into the local stores.
- The flat `chatMessages` ⇄ turn-based `chatHistory` conversion
  ([chatHelpers.ts:47-124](packages/excalidraw/TTA/chatHelpers.ts#L47-L124))
  is **lossy and asymmetric**: `messagesToTurns` stores *all* assistant messages
  per turn, but `turnsToMessages` reconstructs only the *last*
  ([chatHelpers.ts:98](packages/excalidraw/TTA/chatHelpers.ts#L98)). The
  multi-message-per-turn storage is dead weight — it is never read back.

### 1.2 The assistant message is a "bag of 11 fields"

[`AssistantChatMessage`](packages/excalidraw/TTA/types.ts#L134-L157) carries
`lifecycleStatus`, `statusText`, `progressPhase`, `generationStartedAt`,
`generationElapsedMs`, `skeletons`, `parseError`, `isComplete`, `stopReason`,
`warningType`, `error` — eleven fields whose *valid combinations* are an unwritten
contract. Nothing prevents `isComplete: false` with `error` set, or
`lifecycleStatus: "completed"` with `progressPhase: "generating"`.

The code pays for this by hand-reconciling them in at least four places, each of
which must remember the full field set:

- the retry reset clears/sets **~a dozen fields** at once
  ([TTADialog.tsx:966-1002](packages/excalidraw/TTA/TTADialog.tsx#L966-L1002));
- the stop handler patches 6
  ([TTADialog.tsx:1216-1239](packages/excalidraw/TTA/TTADialog.tsx#L1216-L1239));
- `stopIncompleteAssistantMessages` patches 6 more on chat-switch
  ([chatHelpers.ts:131-153](packages/excalidraw/TTA/chatHelpers.ts#L131-L153));
- `generateResponse` patches the set at four lifecycle points
  ([useAIStreamingLifecycle.ts:198-333](packages/excalidraw/TTA/useAIStreamingLifecycle.ts#L198-L333)).

This is exactly the "Status as a state machine" note in
[tta.md §4.3](tta.md). It is the single biggest readability/robustness win
available on the client.

### 1.3 Dual id-space, because the server owns ids

Every assistant message has **two identities**: a local `id`
(`assistant-${randomId()}`, assigned synchronously so the bubble can render) and
a server `messageId`/`turnId` (assigned by the server, arriving in the `started`
event). The client maps between them constantly:

- canvas elements are tagged with the **server `messageId`**
  (`AI_GENERATED_ELEMENTS_KEY`,
  [insertAISkeletons.ts:161-177](packages/excalidraw/TTA/insertAISkeletons.ts#L161-L177)),
  so the canvas draft cannot be keyed until `started` arrives — hence
  `activeCanvasDraftMessageIdRef` only becomes meaningful mid-stream;
- on retry the local id is **sometimes reused** (error retry) and **sometimes
  regenerated** (regenerate-because-unhappy) — a conditional branch that exists
  only to manage the two id-spaces
  ([TTADialog.tsx:959-1003](packages/excalidraw/TTA/TTADialog.tsx#L959-L1003));
- the client even carries machinery for the `chatId` **changing mid-stream**
  (`started` reports one, `done` could report another) — a re-`onStarted` re-keying
  path ([client.ts:262-277](packages/excalidraw/TTA/client.ts#L262-L277)) plus a
  history-row id swap ([TTADialog.tsx:193-206](packages/excalidraw/TTA/TTADialog.tsx#L193-L206)).
  That path is in fact **unreachable against today's server** (§8) — but the client
  still pays for it in code, which is the point: the contract permits it, so the
  client defends against it.

Root cause confirmed server-side: a client-supplied unknown `chatId` is rejected
with **404** ([tta.ts:1036-1037](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L1036-L1037));
`chatId: null` triggers a server-generated ephemeral id
([tta.ts:1020-1024](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L1020-L1024),
[createEphemeralConversation tta.ts:824-835](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L824-L835))
that is only handed back in `started`. So the client *cannot* know the id up
front today — by design.

### 1.4 The canvas-preview two-ref state machine + generation tags

[useAIStreamingCanvasPreview.ts](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts)
maintains **four refs** (`streamingCanvasPreviewHandleRef`,
`activeCanvasDraftMessageIdRef`, `lastStreamingCanvasPreviewRenderTimeRef`,
`pendingStreamingCanvasPreviewResultRef`) and a hand-rolled throttle with
`flush`/`cancel`. On top of that, TTADialog keeps a **third** generation-tag ref
(`pendingGenerationReplacementTagsRef`) and the trio
`queueGenerationReplacement` / `commitQueuedGenerationReplacements` /
`clearQueuedGenerationReplacements`
([TTADialog.tsx:584-624](packages/excalidraw/TTA/TTADialog.tsx#L584-L624)) to
implement "keep the previous generation visible until the next one renders".

That cross-hook ref choreography exists *because* the canvas key (server
`messageId`) is late-bound (§1.3) and *because* the on-canvas elements are a
sixth implicit store that nothing else mirrors.

### 1.5 The protocol's terminal state is ambiguous

The wire is `started → partial* → done → [DONE]` (or `… → error → [DONE]`),
confirmed live in [tta.md §5](tta.md). But:

- the client's SSE iterator **silently `break`s on `[DONE]`**
  ([sse.ts:145-147](packages/excalidraw/data/sse.ts#L145-L147)), discarding the
  one signal that distinguishes "server ended deliberately" from "socket cut";
- so **EOF-without-`done` is reported as success with empty skeletons**
  ([client.ts:314-324](packages/excalidraw/TTA/client.ts#L314-L324)), which then
  wipes the streamed preview (C2);
- `partial.isComplete` is **hardcoded `false`**
  ([client.ts:256-259](packages/excalidraw/TTA/client.ts#L256-L259)) even though
  the server sends `isComplete: true` on the final partial (type drift,
  [tta.md §3](tta.md));
- `done.lifecycleStatus` is required server-side but optional client-side, and
  `AIChatTruncateResponse.revision` is required client-side but **never sent**
  (M4).

The terminal contract is "infer success from absence of error", which is exactly
backwards for a stream that can be cut at any point.

### 1.6 Single-flight is enforced by scattered UI flags

"Only one generation at a time" is currently the emergent result of: the send
button's `canSend` (includes `!isSending`), the composer's `disabled` check
([TTAComposer.tsx:203-207](packages/excalidraw/TTA/TTAComposer.tsx#L203-L207)),
`sendChatPrompt` having no `isSendingChat` guard
([TTADialog.tsx:730](packages/excalidraw/TTA/TTADialog.tsx#L730)), the new-chat
shortcut guard, and the delete/retry handlers each calling `cancelActiveStream`.
The Enter key bypasses all of it (C1), and `generateResponse` blindly overwrites
`activeStreamAbortControllerRef`
([useAIStreamingLifecycle.ts:191-192](packages/excalidraw/TTA/useAIStreamingLifecycle.ts#L191-L192)),
so the invariant is never actually enforced at the one place that matters.

---

## 2. The simplified model

Seven principles. **Ordering is by dependency, not priority.** The load-bearing
lifecycle fixes are **Principles 2–4** (status union, terminal frame,
single-flight); **5–7** collapse the duplicated stores; **Principle 1**
(client-owned ids) is an *optional* enabler, placed first only because the others
refer back to it.

### Principle 1 — The client owns the identifiers

**Change:** the client generates `chatId`, `turnId`, `messageId` as UUIDs and
sends them on the request. The server *uses* them (upsert the chat if unknown
for this owner; use the supplied turn/message ids instead of the server's
`node:crypto` `randomUUID()`).

```ts
// client, at send time — synchronous, before any await (uuidv4 helper, see note below)
const chatId    = activeChatId || uuidv4();   // stable for the whole chat
const turnId    = uuidv4();                    // NEW prompt only; a retry reuses the turn's existing id
const messageId = uuidv4();                    // one per assistant attempt (a fresh one per retry too)
```

**Server change** — the id *adoption* is localized (a few lines in
`loadGenerationContext` / `streamTta`), but the **race-safety and idempotency**
pieces below are the real cost; don't under-scope this as trivial:
- `loadGenerationContext`: when `chatId` is provided but not found *and the owner
  is authenticated*, return an ephemeral context **seeded with the supplied id**
  instead of throwing 404
  ([tta.ts:1036-1037](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L1036)).
  `saveGenerationAttempt` already inserts-on-not-persisted with `chat.id`
  ([tta.ts:1086-1101](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L1086-L1101)),
  so persistence already supports an externally-chosen id. **Plus vs OSS:** in
  Plus the new chat row is stamped with `workspace_id`/`user_id`, so the upsert is
  owner-scoped; for **OSS**, either accept client-supplied unknown ids
  symmetrically (no worse than the existing IDOR — §8/M13) *or* keep the
  server-owned flow there. Since Principle 1 is optional, OSS can simply stay
  server-owned — the two deployments need not behave identically.
- `streamTta`: replace the id generation at
  [tta.ts:2008-2009](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L2008-L2009)
  with the client-supplied ids — but **retry-aware**. Today it is
  `turnId = targetTurn?.turnId ?? randomUUID()`; it must become
  `turnId = targetTurn?.turnId ?? payload.turnId`, i.e. honor `payload.turnId`
  **only for a new prompt** and keep `targetTurn.turnId` on a retry
  (validate/ignore a conflicting supplied `turnId` so a retry can't *fork* a new
  turn). `messageId` is always a fresh per-attempt row, so
  `messageId = payload.messageId` is safe in all cases **provided the client mints
  a new `messageId` per attempt (retries included)**.
- **Schema/type plumbing:** add `turnId`/`messageId` to
  `AIGenerateRequestPayload`, the shared `TTA.GenerateRequest`, and
  `AISchemas.ttaGenerate`
  ([ai-schemas.ts:42](../excalidraw-plus/libs/global/schemas/src/lib/ai-schemas.ts#L42)),
  validated as UUIDv4 at the zod boundary. If flat history is the source of truth
  (Principle 6), the client must also stamp the same `turnId` onto the **user**
  message so a turn is reconstructable from either role.
- **Concurrency & idempotency (the non-trivial part).** Ownership scoping
  (`workspace_id`/`user_id` + RLS) prevents cross-tenant id collisions, but a
  *client-minted* id is collidable within an owner (double-submit, multi-tab,
  network retry) in a way a server-minted id never was. So: make the chat upsert
  **race-safe** (`ON CONFLICT (id)`) and handle the `(chat_id, turn_order)` /
  `(turn_id, message_order)` unique-index conflicts (server F). A duplicate
  per-attempt `messageId` then needs **state-aware** dedup — replay a *completed*
  attempt's result, reject a *pending* one — `ON CONFLICT` alone is necessary but
  not sufficient (see *Retry & idempotency* at the end of §2).

**What this deletes on the client:**
- `applyServerChatId`, `applyServerChatMetadata`, `getServerChatId`,
  `chatIdRef`, the `started`-sets-ids branch in `generateResponse`
  ([useAIStreamingLifecycle.ts:219-231](packages/excalidraw/TTA/useAIStreamingLifecycle.ts#L219-L231)),
  the "done with changed chatId" re-`onStarted` path
  ([client.ts:262-277](packages/excalidraw/TTA/client.ts#L262-L277)), and the
  history id-swap ([TTADialog.tsx:193-206](packages/excalidraw/TTA/TTADialog.tsx#L193-L206)).
- **`chatId` and `turnId` collapse cleanly** (client mints, server adopts; one
  stable value each, no reconcile). **Message identity does *not* fully collapse**:
  the server models each attempt as its own row, so a turn's stable UI bubble is
  1:many with per-attempt server `messageId`s over its life (see *Retry &
  idempotency* in §2). Under Principle 1 the per-attempt `messageId` becomes
  client-mintable too (doubling as that attempt's idempotency key), but it stays
  distinct from the stable bubble id — unless you deliberately redesign server
  retry to update one row in place.
- The retry **reuse-vs-regenerate** branch (§1.3) becomes purely a *UI* concern
  (does the bubble persist and patch back to `streaming`, or get replaced?),
  decoupled from server message identity — which is always a fresh attempt row.
- `started` becomes a pure *ack* (it can still carry `updatedAt`, but it no
  longer teaches the client its own identity).

**What this does and doesn't fix — to be precise.** Server-owned ids are *not*
intrinsically hard; the optimistic-placeholder pattern (mint temp id → render →
swap for real id on response) is the standard way every "POST that returns an id"
client works. The cost is roughly **(stores keyed by the id) × (awkwardness of
the reconcile timing)**. A normal REST create wins on both axes (one store, swap
at request-completion). TTA loses on both: the id is a foreign key across 3+
stores (§1.1), *and* the real id arrives **mid-stream** in `started`, so the
reconcile is both fanned-out and late-bound.

Principle 1 cuts the *chat/turn* reconcile to **zero** (those ids are real from
t=0), which deletes the §1.3 chat-id reconciliation callbacks inside §1.1 (the
per-attempt message id aside — see above).
It does **not** by itself collapse the store *duplication* — that's Principles
5–6. So this is a cheap **enabler** (plus a free idempotency key), not the
load-bearing lifecycle fix; the headline lifecycle wins are Principles 2–4.

**Recommendation: demote this to an optional follow-up.** Once you key the canvas
by the local id (Principle 5) and **don't persist a chat to history until the
server `chatId` arrives in `started`** (a one-line gate that removes the entire
`applyServerChatId` *history-row id-swap* — that swap exists only because the row
can be created under the empty `activeChatId` before the real one lands), the
remaining reconcile is a single localized "stamp server ids onto the in-memory
chat/message for follow-up + truncate" — no fan-out, no dual-id juggling.

At that point client-minted ids deliver **two distinct, separable benefits — keyed
to two different ids, don't conflate them:**

- **client-minted `chatId`** removes the brand-new-chat keying window (no
  buffer-until-`started`, no `applyServerChatId` history-row id-swap). This is a
  small *lifecycle/persistence* cleanup; server change is a **race-safe** upsert
  (`ON CONFLICT (id)` + first-turn-order conflict handling) — a client `chatId` is
  collidable across tabs/network-retries in a way a server-minted one never was.
- **client-minted per-attempt `messageId` (+ retry-aware `turnId`)** adds
  **network-retry idempotency** — but `messageId` alone doesn't: it needs
  **state-aware** server dedup (replay a *completed* attempt's stored result as a
  `done` frame, reject a *pending* one — see §2), not just `ON CONFLICT`, plus
  server F. Strictly more than the `chatId` slice, and it buys nothing for
  lifecycle simplification.

So a `chatId`-only rollout is worthwhile on its own merits and does **not** give
idempotency; idempotency is a separate, larger step.

Practical note if minted client-side: it must be a **real UUID** (the
`tta_chats.id` / `turn_id` / `message_id` columns are Postgres `uuid`), so the
existing `randomId()`/`nanoid` helper won't fit. No 3P library is needed —
`crypto.getRandomValues` (~98% support, works in insecure contexts) backs a
~10-line `uuidv4`, with `crypto.randomUUID` (93.85%, secure-context-only) as a
fast path — strictly better coverage than relying on `crypto.randomUUID` alone.

### Principle 2 — One status state machine per assistant message

Replace the 11 loose fields with a single discriminated union, and — crucially —
**split system/warning bubbles out of the assistant type**. Rate-limit warnings
are not generation turns (today they masquerade as assistant messages with a
`warningType` and no `turnId` —
[useAIStreamingLifecycle.ts:117-133](packages/excalidraw/TTA/useAIStreamingLifecycle.ts#L117-L133)),
so giving them their own kind keeps assistant `status` generation-only and lets
every assistant message legitimately require a `turnId`. `skeletons` stays
orthogonal (it's the payload, valid in several states):

```ts
type ChatMessage =
  | UserMessage
  | AssistantGenerationMessage
  | SystemWarningMessage;          // rate-limit / system bubbles — NOT a generation

type AssistantStatus =
  | { kind: "streaming"; phase: ProgressPhase; startedAt: number; statusText?: string }
  | { kind: "done";      finishReason: FinishReason; elapsedMs: number }
  | { kind: "stopped";   elapsedMs: number }            // user Stop / preserved partials
  | { kind: "error";     error: AIError; elapsedMs: number; retryable: boolean };

type AssistantGenerationMessage = {
  role: "assistant";
  id: string;               // stable local generation id + canvas key, minted at send (REQUIRED)
  serverMessageId?: string; // server attempt id for retry, reconciled from `started`
  localTurnId: string;      // groups user+assistant, minted at send (REQUIRED)
  serverTurnId?: string;    // server turn id for truncate/follow-up, reconciled from `started`
  createdAt: number;
  skeletons?: readonly ExcalidrawElementSkeleton[];  // orthogonal payload
  status: AssistantStatus;
};

type SystemWarningMessage = {
  role: "system";
  id: string;
  createdAt: number;
  variant: RateLimitWarningVariant;
};
```

The turn id mirrors the message id. Under **server-owned ids (the default)** these
are two distinct fields: `localTurnId` is a synchronous placeholder for grouping
the user message with its assistant generation(s) (the user message carries the
same `localTurnId`), and `serverTurnId` is the canonical server identity,
reconciled once `started` arrives and used for truncate/follow-up. Under
**Principle 1** both collapse into a **single client-minted `turnId`** — the
client mints it and the server adopts it verbatim, so there is no local/server
distinction and `turnId` is unambiguously canonical. ("local" throughout means
*known synchronously, client-side* — a placeholder in the default model — not
*client-owned*.) The message level is similar but does **not** fully collapse:
the synchronous local `id` (canvas key + stable bubble identity, lives across
error-retries) vs the per-attempt `serverMessageId` (reconciled from `started`, a
fresh server row per attempt). Even under Principle 1 these stay distinct — the
client just mints the per-attempt `messageId` itself (its idempotency key) —
unless server retry is redesigned to update one row in place. Only `chatId` /
`turnId` collapse to a single value.

Render-only fields become **derived** where they can: `isComplete` ≡
`status.kind !== "streaming"`, the spinner from `status.kind === "streaming"`,
retry-eligibility from `status.kind === "error" || status.kind === "done"`, and
the terminal label ("generated"/"empty") from `finishReason`. **One thing is
*carried*, not derived:** the free server status text from the `message` SSE event
("thinking…", "applying fix…") rides on the streaming variant as `statusText?` —
arbitrary server text can't be reconstructed from the `phase` enum. The four
hand-reconciliation sites (§1.2) collapse to single assignments:

- retry → `status = { kind: "streaming", phase: "starting", startedAt }`
  (one line, not nine);
- stop → `status = { kind: "stopped", elapsedMs }`;
- chat-switch sweep → "any `streaming` becomes `stopped`" (one map);
- `generateResponse` transitions → a tiny reducer
  `streaming → (done | error | stopped)`.

Illegal combinations stop being representable. This directly implements
[tta.md §4.3](tta.md).

### Principle 3 — One mandatory terminal frame

Make the stream **self-terminating and unambiguous**:

- Client rule: a stream is **successful only if a `done` frame arrived** (and
  only then if its `finishReason` is clean — see the last bullet). Anything else —
  `error` frame, `[DONE]`/EOF without `done`, socket cut — is an **error that
  preserves accumulated `skeletons`** and offers Retry.
- Surface `[DONE]` from the SSE layer instead of silently breaking
  ([sse.ts:145-147](packages/excalidraw/data/sse.ts#L145-L147)) so the client can
  *best-effort* distinguish "server closed cleanly but gave no result" (saw
  `[DONE]`, no `done` → likely generation error) from "connection cut mid-stream"
  (EOF without `[DONE]` → transport error). **Make this additive:**
  `iterateSSEJSONChunks` is shared with TTD
  ([TTDStreamFetch.ts:125](packages/excalidraw/components/TTDDialog/utils/TTDStreamFetch.ts#L125)),
  so add an opt-in (e.g. an `onDoneSentinel` callback / flag) rather than changing
  the default break behaviour, and audit/test the TTD path so a sentinel-yield
  doesn't leak into it. This is heuristic — a proxy/lambda
  timeout can still surface as a plain EOF — so **both paths preserve partials and
  offer Retry** regardless; the classification only refines the message shown.
- Stop hardcoding `partial.isComplete = false`
  ([client.ts:256-259](packages/excalidraw/TTA/client.ts#L256-L259)); forward the
  server's value.
- Fix the two type-drift defects while here: drop the phantom
  `AIChatTruncateResponse.revision` (M4), make `done.lifecycleStatus` consistently
  optional, and **generate the wire types from one source** (shared package or
  codegen) so client/server can't drift again
  ([tta.md §3 last bullet](tta.md)).
- **`done` is not unconditionally success.** A `done` carrying
  `finishReason: "length"` or `"content_filter"` is a truncated/blocked
  generation — map it to an `error`/`warning` status (keeping the partials) rather
  than a clean result, consistent with **M10**. Only `finishReason` of `"stop"`
  (or `null`) is a clean success. Ideally the *server* decides this and emits
  `error` for `length`/`content_filter` (see server change C) so the client has a
  single rule.

**On-error canvas policy (specify it).** "Keeps partial work" must say *where*.
Recommended rule: treat any non-success termination exactly like user **Stop** —
commit the last rendered draft to the canvas via the NEVER→IMMEDIATELY dance
(Principle 5) and keep the skeletons on the message, so Retry can replace it. This
**replaces** today's error path, which applies an empty complete result and
*wipes* the preview
([useAIStreamingLifecycle.ts:273-298](packages/excalidraw/TTA/useAIStreamingLifecycle.ts#L273-L298)).
The chat thumbnail and the canvas draft must agree (no empty-canvas-but-skeletons-in-chat
divergence — cf. M8). A transport cut and an explicit `error` frame share the same
canvas behaviour; they differ only in the message shown.

For a **retry/follow-up** there are two sub-cases (this is where M8 bites today):
if it fails **before** the first renderable partial, keep the *previous*
generation visible and clear the pending replacement (don't remove what's on
canvas for a generation that never rendered); if it fails **after** rendering a
new draft, commit that last draft as above. The single draft-owner from
Principle 5 makes both cases one branch instead of scattered ref juggling.

This is C2 + [tta.md §4.2](tta.md), reframed as a contract rather than a patch.
Optional server hardening: a periodic SSE heartbeat comment for proxy-timeout
immunity (see [tta_c2.md](tta_c2.md)).

### Principle 4 — Single-flight reserved before any chat mutation

A guard *inside* `generateResponse` is **too late** for a no-op policy:
`sendChatPrompt` appends the user message before it ever reaches the stream path
([TTADialog.tsx:730-765](packages/excalidraw/TTA/TTADialog.tsx#L730-L765)), so a
double-send has already mutated the conversation. The fix is a shared
`runGeneration` **action** — the single entry point for both send and retry — that
reserves the in-flight slot *synchronously, first*, then mutates state, then
streams:

```ts
const inFlightRef = useRef<AbortController | null>(null);

function runGeneration(input): void {
  if (inFlightRef.current) return;          // no-op: one generation at a time
  const ac = new AbortController();
  inFlightRef.current = ac;                 // reserved BEFORE any chat mutation

  appendUserAndAssistantMessages(input);    // safe: the slot is already taken
  stream(ac).finally(() => {
    if (inFlightRef.current === ac) inFlightRef.current = null;
  });
}
```

**Invariant (forced) vs policy (chosen).** The *correctness* invariant is
reserve-the-slot-**before**-mutating — that alone makes a stray user message or two
concurrent streams impossible (the Enter bypass (C1), the missing `sendChatPrompt`
guard, and the controller-overwrite bug all become unreachable). What happens to
the *second* send on top of that is a separate **product** choice, **not** forced
by the refactor: **no-op** (ignore until the current finishes) vs
**cancel-and-replace** (what today's retry/delete do via `cancelActiveStream`).
We pick **no-op** (David's call): disable the initiating affordances, with Stop as
the escape hatch.

Surface the same invariant in the **UI** rather than silently canceling: while a
generation is in flight, disable the generation-initiating / conversation-mutating
affordances — send, **new chat** (button *and* the Cmd/Ctrl+Shift+O shortcut),
history chat-switch, and retry — leaving **Stop** as the single escape hatch.
Today retry/delete each call `cancelActiveStream` to make room
([TTADialog.tsx](packages/excalidraw/TTA/TTADialog.tsx)); gating them on the
in-flight flag instead makes "one generation at a time" visible and consistent and
deletes those scattered cancels. `isSendingChat` becomes a pure derived flag
(`Boolean(inFlightRef.current)`) driving both the data-layer guard and every
disabled state, so the scattered correctness-critical guards of §1.6 disappear.
This is [tta.md §4.1](tta.md).

This also neutralizes **C3**: with one `runGeneration` used by both send and retry
there is a single `catch`, and a failure simply transitions the existing bubble to
`status.error` (Principle 2) — no second floating promise to reject unhandled.

### Principle 5 — Canvas keyed by a stable local generation id; collapse the preview refs

Key the canvas draft by a **stable local generation id minted at send time** —
known synchronously, before any network round-trip — so the late-binding of §1.4
disappears **with or without Principle 1**. Keying canvas elements by the
*server* `messageId` (late-bound, arrives in `started`) is the self-inflicted
half of §1.4; the server `messageId` should be **metadata** carried on the message
for retry/truncate, not the canvas tag. `generationId` passed to
`insertAISkeletons` is just the `customData` tag
([insertAISkeletons.ts:161-177](packages/excalidraw/TTA/insertAISkeletons.ts#L161-L177))
— it works with any stable string, so the local id is a drop-in. (The canvas key
is a *local* generation id regardless of Principle 1 — it is **not** the
per-attempt server `messageId`; see the message-identity note in Principle 1 / §2.)

Concretely:
- `activeCanvasDraftMessageIdRef` is known up front → fold the
  `queueGenerationReplacement` / `commit…` / `clear…` trio
  ([TTADialog.tsx:584-624](packages/excalidraw/TTA/TTADialog.tsx#L584-L624)) into
  the preview hook as "replace draft `prevId` with `nextId`", a single owner of
  the canvas-draft lifecycle.
- The hand-rolled throttle can be the existing `throttle` util with a trailing
  flush (fixes **M1**, the missing trailing render) instead of a bespoke
  `flush`/`cancel`/pending-ref triad
  ([useAIStreamingCanvasPreview.ts:278-313](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L278-L313)).
- **Keep** the NEVER→IMMEDIATELY tombstone commit dance
  ([useAIStreamingCanvasPreview.ts:108-173](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L108-L173))
  — it's correct and well-reasoned ([tta.md §6](tta.md)); only its *bookkeeping*
  shrinks, not its core trick.

Net: roughly four refs + a cross-hook trio reduce to one draft record
`{ generationId, elementIds, targetCenter }` owned in one hook.

### Principle 6 — One conversation representation

Drop the `messages ⇄ turns` round-trip (§1.1). Persist the flat `ChatMessage[]`
directly (each message carries its `localTurnId` for grouping plus the reconciled
`serverTurnId`/`serverMessageId` once known — which is all `delete`/`truncate`
need). This removes `messagesToTurns`, `turnsToMessages`, `toAssistantTurnMessage`,
and the asymmetric "store all, read last" bug
([chatHelpers.ts:30-124](packages/excalidraw/TTA/chatHelpers.ts#L30-L124)) — ~120
lines and a representational mismatch gone. The title derives from the first user
message ([chatHelpers.ts:243-258](packages/excalidraw/TTA/chatHelpers.ts#L243-L258);
collapse the two `getConversationTitle` variants while here).

Pair with the persistence fixes from tta.md (per-chat keys instead of one `"all"`
blob, save only the active chat, merge-on-hydrate) — **M2/M3** — so streaming
doesn't rewrite the entire history on every skeleton patch and two tabs don't
clobber each other.

**Persist less while streaming.** Per-chat keys alone don't stop the auto-save
effect from writing large *partial* skeleton payloads on every patch. The policy:

- **On send:** persist the user message immediately (no *streamed* skeletons —
  though an **image** prompt is a multi-MB data-URL write, so this is a *one-time*
  cost, not "free"; it's still vastly cheaper than the per-`partial` skeleton storm
  this policy targets) — for an **existing** chat, whose `chatId` is known. For a **brand-new** chat under
  server-owned ids the `chatId` only arrives in `started`, so history can't be
  keyed yet: buffer the user message in memory and write it on `started` (a
  sub-second window; its only exposure is a reload inside it). This is the same
  "don't persist a new chat until `started`" gate from Principle 1 that avoids the
  history-row id-swap. Client-minted `chatId` (Principle 1) removes the window
  entirely — the chat is keyed from t=0.
- **Assistant:** persist only at a *terminal* state (`done`/`stopped`/`error`),
  never per `partial`.

So large skeleton payloads are written exactly once, at the end. The consequence
is explicit (and is the resolution of the otherwise-tempting contradiction): a
reload **mid-generation** leaves a **user-prompt-only orphan turn** — the prompt
survives, but *no assistant bubble was persisted* — so render it with a re-run
affordance. There is nothing half-streamed to resurrect, precisely because
partials are never persisted. This is a deliberate **tradeoff**, not a free win:
today's whole-array auto-save accidentally *can* restore a partial draft across a
reload; the new policy gives that up — acceptable, since a resurrected
half-streamed draft is a stuck-spinner state `stopIncompleteAssistantMessages` has
to clean up anyway.

**What "re-run" means against today's server (important — don't assume resume).**
The current server *cannot* retry that orphaned turn: generation context only
loads turns with a non-null `current_message_id`
([tta.ts:884](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L884)), retry
lookup joins on `current_message_id`
([tta.ts:897](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L897)), and an
aborted/failed attempt never promotes itself to `current_message_id`
([markGenerationAttemptStatus tta.ts:1347-1359](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L1347-L1359))
— so the orphan is invisible to both. Therefore define re-run as **a brand-new
turn with the same prompt text**, abandoning the orphaned attempt. That works on
today's server unchanged; the dangling server turn (current_message_id null) is
invisible to context and harmless, and should be **deferred to M14
retention/cleanup** (a *proposed* track — these orphan rows are **not** cleaned up
today, so they accumulate until M14 lands). The
client-side orphan turn is likewise replaced by the new one. *True resume* of the
same turn would be a **server contract change** (load turns with null
`current_message_id` for the owner; allow retry-by-`turnId`) and is out of scope
here — flag it rather than silently assuming it.

The in-memory `stopIncompleteAssistantMessages` sweep
([chatHelpers.ts:131-153](packages/excalidraw/TTA/chatHelpers.ts#L131-L153)) is a
**separate** concern: it normalizes a *live* streaming bubble to `stopped` when the
user switches chats **within a session** (there the bubble exists in memory). Keep
it as a defensive pass on hydrate too, but under this persistence policy hydrate
normally has nothing non-terminal to fix.

### Principle 7 — Move chat bookkeeping into the history hook

After local generation keys (Principle 5) and the single representation
(Principle 6) there's far less of it, but what remains (`activeChatId`,
`updatedAt` touch, history upsert, and — under server-owned ids — the one-shot
`serverTurnId`/`chatId` reconcile) belongs in `useTTAChatHistory`, not strewn
through TTADialog. Optionally extract delete/retry orchestration into
`useTTAChatActions`. This is the mechanical [tta.md §4.4](tta.md) split; it's much
cheaper *after* (1)–(6) have removed the reconciliation those callbacks did.

### Cross-cutting — define retry & idempotency semantics first

The single most important thing to pin down before any id change: **what is a
`messageId`?** Three incompatible readings are currently conflated:

- *attempt id* — a new row per generation attempt (what the server does today:
  `saveGenerationAttempt` always inserts —
  [tta.ts:1104-1125](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L1104-L1125));
- *UI message id* — the stable identity of the assistant bubble across retries;
- *idempotency key* — a token the server dedupes on.

These pull in different directions, and today's retry model is not clean: retry
lookup targets only `current_message_id`
([tta.ts:~897](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L897)), and a
*failed* attempt is marked `failed` but never promoted to `current_message_id`
([tta.ts:~1343](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L1343)) — so
**failed-generation retry isn't cleanly modeled server-side**. Recommended split:

- the **assistant bubble** keeps one stable local id for its whole life, reused
  across retries — the *UI message id* (and the canvas key, Principle 5);
- each **attempt** gets its own server row — the *attempt id*, as today;
- *only if* client-owned ids land (Principle 1): the client sends a per-attempt
  `messageId` that doubles as the **idempotency key**. But `messageId` alone does
  **not** buy idempotency — `ON CONFLICT (message_id)` is necessary, not
  sufficient. For an SSE generation the dedup must be **state-aware** about the
  existing row:
  - **completed** duplicate → *replay* the stored result as a `done` frame (read
    `response`, re-parse/emit), no regeneration — this is the actual idempotency
    win;
  - **pending** (in-flight) duplicate → you can't join a live SSE stream, so
    reject (e.g. 409) rather than starting a second generation (client
    single-flight should make this rare, but a network retry can still hit it);
  - **failed/aborted** duplicate → define it: typically allow a fresh attempt
    (which, per the per-attempt model, is a *new* `messageId` anyway — so a
    same-`messageId` retry of a failed attempt is itself a defined no-op/replay).

Getting this contract explicit is what prevents the refactor from re-introducing a
smaller version of the same id-reconciliation problem.

---

## 3. The resulting wire protocol

```
POST /v1/ai/tta/generate/stream
{ chatId?, turnId?, messageId?, prompt, images?, retry? }
  // ids server-owned by default; optionally client-minted UUIDs (Principle 1)

  event: started   { chatId, turnId, messageId, updatedAt } // ids (if server-owned) + ack
  event: message   { message }                              // status text (thinking/fix)
  event: partial   { skeletons, isComplete }                // throttled; isComplete forwarded
  event: done      { finishReason, skeletons, updatedAt }   // success only if finishReason ∈ {stop,null}
  event: error     { code, message }                        // terminal failure
  data: [DONE]                                              // surfaced, not swallowed
```

Client success criterion: **a `done` arrived with `finishReason` of `stop`/`null`.**
A `done` with `length`/`content_filter` (ideally re-mapped to `error` server-side,
change C), an `error` frame, `[DONE]`/EOF without `done`, or a socket cut → all
**preserve partials and offer Retry** (see the on-error canvas policy in
Principle 3). Under server-owned ids `started` still carries them (and the client
reconciles once); under Principle 1 they're already known and `started` is a pure
ack.

Request/response symmetry to fix in passing: `truncate` returns
`{ ok, chatId, updatedAt }` — make the client type match (M4).

---

## 4. Server changes required (summary)

The client simplification needs only modest, well-contained server work — **except
the optional change A** (client-owned ids), which is the heavier piece (race-safe
upsert, state-aware dedup, order-conflict handling — see Principle 1; don't read
the "modest" framing as covering A). The rest (B–G) mostly overlaps with tta.md's
existing server findings:

| # | Change | Enables | tta.md ref |
|---|---|---|---|
| A *(optional)* | Accept client-supplied `chatId` (**race-safe** upsert, `ON CONFLICT (id)`, no 404) and retry-aware `turnId`/`messageId` (use instead of the server's `node:crypto` `randomUUID`); add them to `AISchemas.ttaGenerate` + `TTA.GenerateRequest` validated as UUIDv4; **state-aware** per-`messageId` dedup (replay completed / reject pending) + order-conflict handling (needs F) | Principle 1 (only if adopted) | new |
| B | `try/finally` in `streamTta` writing a terminal status (`aborted`/`failed`) so no row stays `pending` | robustness; complements client terminal contract | **S1** ([tta_s1.md](tta_s1.md)) |
| C | Keep emitting a real terminal frame and let `[DONE]` mean "clean close"; **map `finishReason` `length`/`content_filter` → `error`/`warning`** (don't emit them as a success `done`); add heartbeat (optional) | Principle 3 / C2 / M10 | **C2** ([tta_c2.md](tta_c2.md)) |
| D | Single source of truth for wire types (shared pkg/codegen); drop drift (`revision`, `isComplete`, `lifecycleStatus` optionality) | Principle 3 | §3, M4 |
| E | Refund rate limit on abort **only if nothing meaningful streamed**; make rollback idempotent | closes cost loophole | **S2** ([tta_s2.md](tta_s2.md)) |
| F | Explicit per-chat serialization (`pg_advisory_xact_lock`) + conflict retry for order assignment | makes client-supplied ids safe under concurrency | **S4** ([tta_s4.md](tta_s4.md)) |
| G | Throttle partial emission on all paths / emit deltas | bandwidth; orthogonal but cheap alongside | **S3** ([tta_s3.md](tta_s3.md)) |

The wire terminal contract is **client Principle 3 + server C**; ship **server B**
(DB attempt finalization, = S1 — *not* part of the wire contract itself) in the
same release to close the stuck-`pending` gap. **A** is the **only net-new server
change** here, needed solely if client-owned ids (Principle 1) are adopted —
**B–G all already exist as tta.md recommendations** and simply become more
valuable once the client treats the protocol as authoritative.

---

## 5. How this maps onto the tta.md findings

| Finding | Status under the simplified model |
|---|---|
| **C1** Enter bypasses `isSending` → concurrent gens | **Structurally impossible** (Principle 4) |
| **C2** EOF-as-success wipes preview | **Structurally fixed** (Principle 3) |
| **C3** Failed retry unhandled rejection | **Dissolved** (shared single-flight `runGeneration`, Principle 2+4) |
| **S1** Stuck `pending` rows | Fixed by server change B (still needed) |
| **§4.1** Single-flight at hook level | = Principle 4 |
| **§4.2** Self-terminating protocol | = Principle 3 |
| **§4.3** Status as a state machine | = Principle 2 |
| **§4.4** Split the 1.4k-line component | = Principle 7 (cheaper after 1–6) |
| **M1** Throttle has no trailing flush | Fixed incidentally (Principle 5) |
| **M2/M3** History clobber / hydration race | Addressed alongside Principle 6 |
| **M4** Phantom `revision` field | Fixed (Principle 3 / §3) |
| **M8** Failed follow-up leaves canvas empty | Addressed: on-error canvas policy keeps the draft (Principle 3) + draft replacement has one owner (Principle 5) |
| **C4** (viewport offset), **S2/S3/S4/S5**, M9–M14 | Independent of this refactor; fix per their own proposals |

Note **C4** and the **S5** migration-journal orphan are *not* addressed here —
they're orthogonal correctness/deploy bugs and should land on their own tracks
([tta_c4.md](tta_c4.md), [tta_s4.md](tta_s4.md)).

---

## 6. What to keep (explicitly do not touch)

From [tta.md §6](tta.md), all still correct under the new model:
- `createEagerAsyncIterable` overlap
  ([tta.ts:499-569](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L499-L569));
- the preview commit dance's *core* NEVER→IMMEDIATELY trick (only its
  bookkeeping shrinks);
- deterministic chat-scoped id remapping (`elementIdRemap` / `stableId`) — this is
  about *element* ids inside a generation and is **independent of** the
  *message/chat* id ownership change in Principle 1;
- the heuristic→LLM repair ladder, careful SSE parsing, zod route validation,
  parser input hardening.

---

## 7. Suggested sequencing

Each step is independently shippable and testable:

1. **Client Principle 3** (the wire terminal contract — `[DONE]`/`done` required,
   `finishReason` mapping, on-error canvas policy via the *existing*
   `commitStreamingCanvasPreview` dance). **Self-sufficient against today's
   server** — it already sends `done`, `[DONE]`, `finishReason`, and
   `partial.isComplete`; the client just ignores them — so this needs **no**
   server change to function and shouldn't be gated on a lockstep deploy. Land
   **server B** (close S1) and **server C** (server-side `finishReason`→error
   mapping + heartbeat hardening) **in parallel**, not as a prerequisite. Smallest,
   highest safety payoff; fixes C2/S1; no data-model change.
2. **Client Principle 4** (single-flight via a shared `runGeneration` that
   reserves before mutating) + C3 fix. Pure client; fixes C1/C3.
3. **Client Principle 2** (status union + warning/generation split). Mechanical
   but broad; do behind the existing tests (`useAIStreamingLifecycle.test.tsx`,
   `useAIStreamingCanvasPreview.test.tsx`).
4. **Client Principles 5–7** (canvas keyed by local generation id, single
   conversation rep + persist terminal snapshots, hook split). Readability
   cleanup; no contract change.
5. **(Optional) `chatId`-only client-minted id.** Removes the brand-new-chat
   keying window (no buffer-until-`started`, no history-row id-swap). Server change:
   **race-safe** upsert — `INSERT … ON CONFLICT (id)` on the chat *plus*
   first-turn-order conflict handling (a slice of server F), because a client
   `chatId` is now **collidable**: a double-submit, multi-tab send, or network-level
   retry can carry the *same* new `chatId` into two concurrent first-turn inserts
   (today impossible — the server mints a unique id per request). Client
   single-flight (Principle 4) covers the same-tab case but not cross-tab/network
   retries. A self-contained persistence cleanup — **does not** provide idempotency.
6. **(Optional) per-attempt `turnId`/`messageId` + idempotency.** Client mints a
   fresh `messageId` per attempt (retry-aware `turnId` per Principle 1); server does
   **state-aware** dedup (replay completed / reject pending — §2), not just
   `ON CONFLICT (message_id)`. Needs server F (advisory lock) and the §2
   retry/idempotency design. The larger, contract-touching step — only if
   network-retry idempotency is actually wanted.

Steps 1–2 alone clear the three 🔴 client lifecycle bugs without any data-model
risk; steps 3–4 are the structural simplification; steps 5–6 are independent
optional add-ons (5 is small; 6 is the bigger idempotency commitment).

**Two sequencing caveats** (verified against the dependency graph):
- Steps 1–2 are **independent of each other** (terminal-vs-single-flight) — order
  between them doesn't matter. Both deliberately write their error/single-flight
  logic against the *current* field model; step 3 (the status union) then
  re-expresses those field-writes in the union. That mechanical rework is the
  accepted price of landing the 🔴 fixes first with a small blast radius — the
  transport-layer parts of step 1 (`client.ts`/`sse.ts`) and the single-flight
  reservation of step 2 carry over unchanged.
- Step 1 reuses the **existing** commit dance for its on-error canvas policy; it
  does **not** depend on Principle 5. Principle 5 only later simplifies the
  bookkeeping and fully cleans the retry sub-cases.
- **Principle 2 (step 3) and Principle 6 (step 4) both rewrite the *persisted*
  conversation shape** — land them back-to-back (don't ship a persisted format
  between them) so the IndexedDB format migrates once. Free here regardless since
  TTA is unreleased and dev data is truncated (§8), but it matters if this ever
  ships incrementally to a released product.

---

## 8. Risks & open questions

- **`chatId` change at `done` — confirmed dead, safe to delete.**
  ([client.ts:262-277](packages/excalidraw/TTA/client.ts#L262-L277)) Verified
  server-side: `streamTta` resolves one `chat` object at the top
  ([tta.ts:2003](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L2003)) and
  emits the same `chat.id` in both `started`
  ([tta.ts:2090](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L2090)) and
  `done` ([tta.ts:2295](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L2295)),
  never reassigning it; `done` is the only site that yields that chunk type. The
  client branch is therefore unreachable against this server — legacy. It goes
  away with Principle 1 at no risk.
- **Client-supplied ids + abuse — bounded by the existing rate limit.** The DB
  write (`saveGenerationAttempt`, the only thing that persists a chat) lives
  inside `streamTta` ([ai.ts:543](../excalidraw-plus/apps/api/src/routes/ai.ts#L543)),
  which runs *after* `rateLimiting.check()`
  ([ai.ts:511](../excalidraw-plus/apps/api/src/routes/ai.ts#L511)). So a client can
  mint at most as many chats as the rate limit allows — no new abuse surface.
  (Workspace-key users skip the limiter —
  [ai.ts:509](../excalidraw-plus/apps/api/src/routes/ai.ts#L509) — but only fill
  their own workspace.) Still **validate the supplied ids are well-formed UUIDv4
  at the zod boundary** (server change A) — both to reject malformed ids and to
  keep the id space uniform.
- **OSS unscoped chats (M13) — pre-existing, *not* worsened by client-owned ids.**
  UUIDv4 entropy is identical whether the server or the client mints it
  (UUIDv4, 122 bits), so guessing is no easier. The IDOR already
  exists today: `ossStoreAdapter.loadChatFilters` is `eq(id, chatId)` with no
  owner ([tta.ts:819-822](../excalidraw-plus/libs/server/tta/src/lib/tta.ts#L819-L822))
  and `chatId` already flows in the request body, so anyone holding a victim's
  UUID can already read/extend/truncate that chat. Principle 1 only changes
  unknown-id behaviour from 404 → create-empty (harmless). A per-chat secret adds
  little when it lives in the same browser storage as the UUID (exfiltrate one,
  exfiltrate both); the correct fix — *if the OSS deployment is multi-tenant* — is
  real owner scoping, and it's independent of this refactor. Net: M13 is **not**
  a prerequisite for Principle 1.
- **Migration — not needed.** TTA is unreleased; local dev data can simply be
  truncated, so Principle 6 needs no read-side legacy adapter. Delete
  `turnsToMessages`/`messagesToTurns` outright with the change.
