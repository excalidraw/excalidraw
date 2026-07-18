# C2 implementation proposal — stream disconnects must not masquerade as success

Fixes finding **C2** from [tta.md](tta.md): *mid-stream disconnect is reported as a successful "empty response" and wipes the streamed preview*.

Companion to [tta_c1.md](tta_c1.md) (same conventions: match code anchors by snippet, not line number; implementable without re-deriving the analysis). Phase 1 is client-only inside `packages/excalidraw/` — **no i18n, type, or server changes required**. Phase 2 (optional salvage UI) and the server heartbeat (separate repo) are clearly fenced.

---

## 1. The bug

The wire protocol, as actually implemented today (verified in `excalidraw-plus/libs/server/fastifyutils/src/lib/streaming.ts` — `StreamingResponse`):

```
success:  data:{started} → data:{partial}* → data:{message}* → data:{done} → data:[DONE] → EOF
error:    … → data:{error}            (written as a chunk, or as the `end(error)` frame) → EOF
```

So every *deliberately* ended stream terminates with a `done`/`error` chunk, and the success path additionally appends a `data: [DONE]` sentinel. (Live-verified 2026-06-12 against the dev oss-ai-server on `dwelle/tta`: raw captures show `…<partial frames>… → data:{done} → data:[DONE]`, and no heartbeat frames — see tta.md §5.) A stream that reaches EOF **without** any of those was cut mid-flight: proxy idle timeout (ALB defaults to 60 s, Cloudflare 100 s — and TTA has long silent phases: Gemini "thinking" chunks and the LLM-fix round are not forwarded), server restart, HTTP/2 GOAWAY, or a clean FIN from a dying pod.

What the client does with that today ([client.ts:307-324](packages/excalidraw/TTA/client.ts#L307-L324)):

```ts
    if (signal?.aborted) {
      return {
        ...rateLimitInfo,
        error: toStreamError("Request aborted", 499, "aborted"),
      };
    }

    return {
      ...rateLimitInfo,
      finalPayload: {
        skeletons: [],
        isComplete: true,
        chatId: startedPayload?.chatId,
        turnId: startedPayload?.turnId,
        messageId: startedPayload?.messageId,
      },
      error: null,
    };
```

A fabricated success. Downstream ([useAIStreamingLifecycle.ts:300-334](packages/excalidraw/TTA/useAIStreamingLifecycle.ts#L300-L334)) this:
- patches the assistant message with `skeletons: []` — **overwriting** the partial skeletons accumulated via `onChunk`,
- shows the `ai.chat.status.emptyResponse` status as if the model returned nothing,
- calls `applyStreamingCanvasPreviewResult({ skeletons: [], isComplete: true })` — which **clears the streamed preview from the canvas** ([useAIStreamingCanvasPreview.ts:206-213](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L206-L213)).

A 95 %-streamed drawing silently vanishes and the user is told the AI "returned an empty response", with no Retry affordance styled as an error.

Two adjacent facts that shape the fix:

1. **The `[DONE]` sentinel is currently discarded**: `iterateSSEJSONChunks` `break`s on it ([data/sse.ts:145-147](packages/excalidraw/data/sse.ts#L145-L147)) without telling the caller, so `TTAStreamFetch` cannot distinguish "loop ended because the server said it's over" from "loop ended because the socket died". (Note: [tta.md](tta.md) originally claimed the server never sends `[DONE]` — that's wrong, `StreamingResponse.end()` does; corrected there.)
2. **Abrupt closes (RST) already behave acceptably**: the reader rejects, `TTAStreamFetch`'s catch returns a generic error, and `getAIErrorMessageKey`'s `isLikelyConnectionError` maps it to the existing `ai.chat.errors.connection` copy. C2 is specifically about **clean** EOF.

## 2. Desired behavior

| Scenario | Today | After fix |
|---|---|---|
| Stream ends with a `done` chunk | success | unchanged |
| Stream ends with an `error` chunk | error | unchanged |
| Client aborts (Stop) | 499 `aborted` | unchanged |
| Reader throws (RST, offline) | generic error → connection copy | unchanged |
| **Clean EOF, no `done`/`error`, no `[DONE]`** | fake empty success, canvas wiped | error `STREAM_INTERRUPTED` (1002), message *"Connection interrupted before the response completed"* |
| **Clean EOF, `[DONE]` seen, but no `done`/`error` chunk** | fake empty success | error `STREAM_INTERRUPTED` (1002), message *"The AI server ended the stream without a result"* |
| Assistant message after an interrupted stream | skeletons overwritten with `[]`, "empty response" | keeps the last streamed `skeletons`, shows the existing `ai.chat.errors.connection` copy + **Retry** |
| Canvas draft after an interrupted stream | cleared (via fake success) | still cleared — same as every other failure (see §3 decision) |
| Retry semantics | n/a (no error shown) | existing **error-retry** path: `reason: "generation_error"`, same server turn via `retryAssistantMessageId` — exactly right for a disconnect (no "avoid similarity" instruction, no reference-image export) |

A legitimate `done` chunk with zero skeletons (model produced valid-but-empty EXML) still shows "empty response" — only the *no-terminal-chunk* path changes.

## 3. Design decisions (so nobody re-litigates them mid-implementation)

- **Disconnect = error, not "treat like Stop".** Stop commits the partial preview to the canvas and marks the message complete/stopped; retrying a stopped message goes through the *regenerate* flow (`user_not_happy` + avoid-similarity + exports a reference image — wrong semantics and extra cost for a network blip). Erroring instead gives the *error-retry* flow (same turn, plain re-run) for free, keeps canvas behavior consistent with every other failure, and avoids new canvas-replacement bookkeeping on the error-retry path (which currently assumes a clean canvas). The partial result is preserved **on the message** (and surfaced by Phase 2).
- **One error code, two messages.** Both EOF flavors get `AI_CLIENT_ERRORS.STREAM_INTERRUPTED = 1002`; the raw message strings differ ("connection interrupted" vs "server ended without a result") for logs/telemetry, while the user-facing copy is the same existing `ai.chat.errors.connection` key. No new i18n strings.
- **Use the sentinel the server already sends.** Surfacing `[DONE]` from the SSE iterator is a one-line, backward-compatible option (`TTDStreamFetch` shares this iterator and is unaffected).
- **No lifecycle changes in Phase 1.** The transport-error branch of `generateResponse` already does the right thing: its patch does not touch the `skeletons` field (so streamed partials survive on the message) and it clears the canvas draft — consistent with other failures. The whole Phase 1 fix lives in `client.ts` + `utils.ts` + `data/sse.ts`.

## 4. Phase 1 — implementation steps

### Step 1 — `packages/excalidraw/data/sse.ts`: surface the `[DONE]` sentinel

Find:

```ts
export interface IterateSSEJSONChunksOptions<T> {
  signal?: AbortSignal;
  ignorePayload?: (payload: string) => boolean;
  onInvalidJSON?: (payload: string, error: unknown) => void;
  parse?: (payload: string) => T;
}
```

Add:

```ts
  /**
   * Called when the stream's `[DONE]` terminator payload is received (the
   * iterator stops either way). Lets callers distinguish "the server ended
   * the stream deliberately" from "the connection was cut at EOF".
   */
  onDoneSentinel?: () => void;
```

Find (inside `iterateSSEJSONChunks`):

```ts
  const { signal, ignorePayload, onInvalidJSON } = options;
```

add `onDoneSentinel` to the destructuring, and find:

```ts
    if (payload === "[DONE]") {
      break;
    }
```

replace with:

```ts
    if (payload === "[DONE]") {
      onDoneSentinel?.();
      break;
    }
```

(Optional but trivially correct, since the option is additive: the other consumer, `components/TTDDialog/utils/TTDStreamFetch.ts`, needs no changes.)

### Step 2 — `packages/excalidraw/TTA/utils.ts`: new client error code + copy mapping

Find:

```ts
export const AI_CLIENT_ERRORS = {
  INVALID_RESULT: 1001,
} as const;
```

Replace with:

```ts
export const AI_CLIENT_ERRORS = {
  INVALID_RESULT: 1001,
  /** SSE stream reached EOF without a terminal `done`/`error` chunk. */
  STREAM_INTERRUPTED: 1002,
} as const;
```

In `getAIErrorMessageKey`, find:

```ts
  if (
    error.code === AI_CLIENT_ERRORS.INVALID_RESULT ||
    error.code === AI_ERRORS.GENERATION_ERROR.code
  ) {
    return "ai.chat.errors.invalidResult";
  }
```

Insert **directly after** it:

```ts
  // NOTE: client-side codes (1001/1002) are numerically >= 500, so this must
  // be matched before the generic `error.code >= 500` server branch below.
  if (error.code === AI_CLIENT_ERRORS.STREAM_INTERRUPTED) {
    if (opts?.isOffline) {
      return "ai.chat.errors.offline";
    }
    return "ai.chat.errors.connection";
  }
```

⚠️ Placement is the one real footgun in this change: the next branch returns `serverUnavailable` for any `code >= 500`, and `1002 >= 500`. (`INVALID_RESULT` only works today because of the same lucky ordering.) Both i18n keys already exist (`en.json` → `ai.chat.errors.connection` / `.offline`).

### Step 3 — `packages/excalidraw/TTA/client.ts`: report EOF-without-result as an error

Add the import (no cycle: `utils.ts` imports only `./types`):

```ts
import { AI_CLIENT_ERRORS } from "./utils";
```

Find:

```ts
    onStreamCreated?.();
    let startedPayload: AIStreamStartedPayload | null = null;
```

Add below:

```ts
    let receivedDoneSentinel = false;
```

Find the iterator options:

```ts
    for await (const event of iterateSSEJSONChunks<StreamChunk>(stream, {
      signal,
      ignorePayload: (rawPayload) => /^\[ai-server\]/i.test(rawPayload.trim()),
      onInvalidJSON: (rawPayload) => {
        console.warn("AI Client: Failed to parse JSON payload", rawPayload);
      },
    })) {
```

and add to the options object:

```ts
      onDoneSentinel: () => {
        receivedDoneSentinel = true;
      },
```

Find the post-loop block (the bug):

```ts
    if (signal?.aborted) {
      return {
        ...rateLimitInfo,
        error: toStreamError("Request aborted", 499, "aborted"),
      };
    }

    return {
      ...rateLimitInfo,
      finalPayload: {
        skeletons: [],
        isComplete: true,
        chatId: startedPayload?.chatId,
        turnId: startedPayload?.turnId,
        messageId: startedPayload?.messageId,
      },
      error: null,
    };
```

Replace with:

```ts
    if (signal?.aborted) {
      return {
        ...rateLimitInfo,
        error: toStreamError("Request aborted", 499, "aborted"),
      };
    }

    // Every deliberately-ended generation terminates with a `done` or `error`
    // chunk (the success path additionally appends a `[DONE]` sentinel — see
    // StreamingResponse.end() server-side). Reaching EOF without one means
    // the stream was cut (proxy idle timeout, server restart, network blip).
    // Never fabricate an empty success here: it would overwrite the streamed
    // partial skeletons and wipe the canvas preview (C2 in tta.md).
    return {
      ...rateLimitInfo,
      error: toStreamError(
        receivedDoneSentinel
          ? "The AI server ended the stream without a result"
          : "Connection interrupted before the response completed",
        AI_CLIENT_ERRORS.STREAM_INTERRUPTED,
        "failed",
      ),
    };
```

### Step 4 — `useAIStreamingLifecycle.ts`: no code change (verify only)

The transport resolves (does not throw) with `error`, so flow enters the `if (error)` branch in `generateResponse`. Verify, don't change:

- the patch there sets `error`, `isComplete: true`, `lifecycleStatus: "failed"` and does **not** include a `skeletons` key → streamed partials stay on the message ✓
- `applyStreamingCanvasPreviewResult({ skeletons: [], isComplete: true }, activeMessageId)` clears the canvas draft → intended (§3) ✓
- `TTAChatMessage` renders the error via `getAIErrorMessageKey` (code 1002 → connection copy) and shows **Retry** (`assistantError` ⇒ retry action) ✓
- `handleRetry` sees `message.error` ⇒ `isErrorRetry` ⇒ `reason: "generation_error"` with `retryAssistantMessageId: message.messageId` (set when `started` was received) → server retries the *same turn* ✓

## 5. Phase 2 (optional, separate commit) — salvage UI for partial results

Today an errored message hides its preview and "To canvas" action even when partial skeletons survived, which makes Phase 1's "we kept your partial result" invisible. Two small edits:

### 5a. `packages/excalidraw/TTA/useAIAssistantPreview.ts`

The hook hard-disables on `message.error` in two places. In the `useState` initializer, find:

```ts
      if (!skeletons?.length || message.error) {
```

→ `if (!skeletons?.length) {`. In the main effect, find:

```ts
    if (!skeletons?.length || message.error) {
```

→ `if (!skeletons?.length) {`. Leave `isStreaming` (`message.isComplete === false && !message.error`) as is; let the lint guide the effect's dependency array (`yarn fix`).

This is safe for the other consumers: history thumbnails and the empty-state pick their message via `getConversationPreviewMessage`, which already filters out errored messages ([chatHelpers.ts:260-274](packages/excalidraw/TTA/chatHelpers.ts#L260-L274)).

### 5b. `packages/excalidraw/TTA/TTAChatMessage.tsx`

Find:

```ts
  const { previewSvg, status: previewStatus } = useAIAssistantPreview(message, {
    enabled: !message.error,
  });
```

→ `const { previewSvg, status: previewStatus } = useAIAssistantPreview(message);`

Find:

```ts
  const assistantOutputExists =
    !message.error && !visibleContent && hasCurrentPreview;
```

Replace with:

```ts
  // A failed generation may still carry the partial skeletons streamed before
  // the failure (e.g. connection interruptions — C2 in tta.md). Surface them
  // so the user can preview/insert the partial result alongside the error.
  const hasSalvageablePartialResult = Boolean(
    assistantError && !isRateLimitWarning && message.skeletons?.length,
  );
  const assistantOutputExists =
    (!assistantError || hasSalvageablePartialResult) &&
    !visibleContent &&
    hasCurrentPreview;
```

> ⚠️ `isRateLimitWarning` and `assistantError` are declared *below* the current `assistantOutputExists` line — place the new block after them (it has no other order constraints; `visibleContent` is computed in the "Content visibility" section).

Notes:
- The "To canvas" button and preview-click insert already guard on `message.skeletons?.length` — no further changes.
- Error retry resets `skeletons: undefined` on the message (TTADialog retry-reset patch), so the salvage preview correctly disappears once a retry starts.
- Visually verify the shared `ChatMessage` component stacks `previewSvg` + `error` acceptably (it renders both props independently); if it looks crowded, gating the preview behind the error text is a CSS/ordering tweak inside `ChatMessage`, not logic.
- This intentionally also benefits *server-side* generation errors that streamed partials before failing — same salvage value.

## 6. Companion change (separate repo/PR, recommended): SSE heartbeats

Prevents the most common *cause* of C2 — proxy idle timeouts during silent phases. In `excalidraw-plus/libs/server/fastifyutils/src/lib/streaming.ts`, class `StreamingResponse`:

```ts
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(reply: FastifyReply, request: FastifyRequest) {
    // ...existing body...
    // SSE comment frames keep intermediaries (ALB: 60s idle default,
    // Cloudflare: 100s) from killing the stream during silent phases
    // (model thinking, LLM-fix round). Comment lines (leading ":") are
    // ignored by EventSource and by the client parser (parseSSEData).
    this.heartbeat = setInterval(() => {
      if (!this.streamEnded && !this.signal.aborted) {
        this.stream.push(`: hb\n\n`);
      }
    }, 15_000);
  }

  private cleanup() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    this.socket.off("close", this.onSocketClose);
  }
```

`cleanup()` already runs on both socket close and `end()` — the interval cannot outlive the response. Client compatibility is verified on both consumers: `parseSSEData` drops `:`-prefixed lines ([data/sse.ts:56-58](packages/excalidraw/data/sse.ts#L56-L58)), and TTD shares that parser. This benefits every streaming route using `setupStreamingResponse`, not just TTA.

## 7. Tests

### 7a. `packages/excalidraw/TTA/client.test.ts`

**One existing test locks in the bug and must be updated** — `"ignores ai-server diagnostics and synthesizes a final payload when needed"` currently asserts the fabricated empty success. Replace its expectations (import `AI_CLIENT_ERRORS` from `./utils`):

```ts
  it("ignores ai-server diagnostics and reports an interrupted stream when no result arrives", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: createMockStream(["data: [ai-server] debug line\n\n"]),
    });

    const result = await TTAStreamFetch({
      payload: { prompt: "hello" },
      fetch: createTransportFetch(),
    });

    expect(result.finalPayload).toBeFalsy();
    expect(result.error).toMatchObject({
      code: AI_CLIENT_ERRORS.STREAM_INTERRUPTED,
      lifecycleStatus: "failed",
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
```

New cases (reuse `createMockStream` / `createChunk` / `createTransportFetch`):

1. **EOF after partials → interrupted, partials were delivered**: stream = `started` + `partial { skeletons: [{ type: "rectangle" }] }`, then close. Assert `onChunk` was called with those skeletons, `result.error` matches `{ code: AI_CLIENT_ERRORS.STREAM_INTERRUPTED, lifecycleStatus: "failed" }`, and `result.error.message` matches `/connection interrupted/i`.
2. **`[DONE]` without a result chunk → server-ended flavor**: stream = `started` + `"data: [DONE]\n\n"`. Assert error code `STREAM_INTERRUPTED` and message matches `/ended the stream/i`.
3. Existing `done`, `error`-chunk, abort, and rate-limit tests must pass unchanged (they're the regression net for §2 rows 1–4).

### 7b. `packages/excalidraw/data/sse.test.ts`

Add one case to the existing `iterateSSEJSONChunks` describe block: a stream of `data: {"value":"a"}` + `data: [DONE]` + `data: {"value":"b"}` with `onDoneSentinel` spy → yields only `a`, sentinel spy called once. And a control: no `[DONE]` → spy not called.

### 7c. `packages/excalidraw/TTA/useAIStreamingLifecycle.test.tsx`

Add: **"keeps streamed partial skeletons on the message when the stream is interrupted"**. Generalize `TestHarness` to accept an optional `streamFetch` mock (default: current `mockResolvedValue(streamResult)`), then:

```ts
const skeleton = { type: "rectangle", x: 0, y: 0, width: 10, height: 10 };
const streamFetch = vi.fn().mockImplementation(async (options) => {
  // Deliberately no onStarted: activeMessageId stays null, which skips the
  // canvas-preview path — this test pins message-state behavior only.
  options.onChunk?.({ skeletons: [skeleton], isComplete: false });
  return {
    error: {
      code: 1002,
      message: "Connection interrupted before the response completed",
      lifecycleStatus: "failed",
    },
  };
});
```

Assert `messages[1]` ends as `{ id: "assistant-1", isComplete: true, lifecycleStatus: "failed", skeletons: [skeleton], error: { code: 1002 } }` and that no third message was appended. (If you also want to pin the canvas-clearing behavior, add `onStarted` and extend `createMockApp` with `state: { width: 100, height: 100, scrollX: 0, scrollY: 0, zoom: { value: 1 }, theme: "light" }` and `files: {}` so the real `insertAISkeletons` path works — see `insertAISkeletons.test.ts` for a working fixture. Optional; the message-state assertion is the C2 contract.)

### 7d. Phase 2 component test (only with Phase 2)

`TTAChatMessage` with `vi.mock("../i18n", ...)` and `vi.mock("./useAIAssistantPreview", () => ({ useAIAssistantPreview: () => ({ previewSvg: "data:image/svg+xml,...", status: "done" }) }))`: render an assistant message with `error: { code: 1002, message: "x" }`, `isComplete: true`, `skeletons: [{...}]` → assert both the error copy *and* the preview/To-canvas action render; control case without `skeletons` → error only. Adapt queries to the shared `ChatMessage` markup.

### 7e. Commands

```bash
yarn test:typecheck
yarn vitest packages/excalidraw/TTA packages/excalidraw/data/sse.test.ts
```

### 7f. Manual QA

Deterministic repros (temporary server hacks in `excalidraw-plus`, oss-ai-server route is easiest):

- **Cut mid-stream (no sentinel)**: in the route's `for await` loop, after ~3 written chunks: `reply.raw.destroy(); return;` → expect the connection-interrupted error, Retry button, chat message keeps its last partial state (Phase 2: thumbnail visible), canvas draft removed, **no** "empty response".
- **Server-ended (sentinel, no result)**: instead `break` out of the loop after the first `partial`, then let `stream.end()` run → same UX, log message says "ended the stream without a result".
- **Process kill**: SIGKILL the oss-ai-server mid-stream → thrown-reader path → connection copy (pre-existing behavior, just confirm no fake success).
- **Retry correctness**: after an interrupted stream that had received `started`, click Retry → verify server-side (logs/DB) it reuses the same turn (`existingTurn: true`, message_order 2), not a duplicate turn.
- **Regressions**: normal completion; Stop mid-stream; server `error` chunk (kill the API key); rate-limit exhaustion — all unchanged.

## 8. Acceptance criteria

- [ ] A stream ending without a terminal chunk never produces `finalPayload`; it produces `error.code === 1002` with `lifecycleStatus: "failed"` (both sentinel flavors).
- [ ] The assistant message keeps its last streamed `skeletons` after an interrupted stream; UI shows the `ai.chat.errors.connection` copy and a Retry that goes through the error-retry (same-turn) flow.
- [ ] Canvas draft is cleared on interruption (same as other failures); no "empty response" status appears for interruptions.
- [ ] `getAIErrorMessageKey(1002)` resolves to connection copy (offline-aware), **not** `serverUnavailable` (ordering footgun).
- [ ] The updated + new tests in §7 pass; `yarn test:typecheck` clean; TTD streaming is untouched (`onDoneSentinel` is additive).
- [ ] (Phase 2) Errored messages with partial skeletons render preview + "To canvas"; errored messages without skeletons render exactly as today.

## 9. Follow-ups (do not bundle)

- **TTD has the same EOF assumption** — `components/TTDDialog/utils/TTDStreamFetch.ts` shares `iterateSSEJSONChunks`; audit its end-of-stream handling and apply the same pattern.
- **Client inactivity watchdog**: a hung connection that never closes (black-holed TCP) still spins forever; a ~120 s no-bytes timeout that aborts and reuses `STREAM_INTERRUPTED` would close that hole (the server heartbeat in §6 makes such a timeout safe to add).
- **Disconnect before `started`**: the server may have persisted the attempt while the client never learned `messageId`; a retry then opens a new turn (server-side duplicate). Tied to S1/S4 in [tta.md](tta.md) (attempt-status finalization + order-race hardening), not fixable client-side.
- **S1 interplay**: server-side, an interrupted client connection still leaves the attempt row `pending` — fixing S1's `try/finally` makes server state agree with the new client error.
