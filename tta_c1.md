# C1 implementation proposal — single-flight chat generations

Fixes finding **C1** from [tta.md](tta.md): *Enter-to-send bypasses `isSending` → concurrent generations*.

This document is written so it can be implemented without re-deriving the analysis. Code anchors are quoted as snippets (line numbers are from review time and may drift — match on the snippet, not the number). All changes are client-only, inside `packages/excalidraw/TTA/`. No server, protocol, or i18n changes.

---

## 1. The bug

Product design: while a generation is streaming, the composer's send button is replaced by a **Stop** button — you cannot send; you stop or wait. Three gaps break this:

1. **`TTAComposer.handleSend` only checks `disabled`.** `canSend = hasContent && !isSending && !disabled` gates the *button* only; the Enter keydown path calls `handleSend()` directly ([TTAComposer.tsx:203-248](packages/excalidraw/TTA/TTAComposer.tsx#L203-L248)). Typing during a stream and pressing Enter submits.
2. **`sendChatPrompt` has no in-flight guard** ([TTADialog.tsx:730](packages/excalidraw/TTA/TTADialog.tsx#L730)) — it trusts its callers.
3. **`generateResponse` is not single-flight** ([useAIStreamingLifecycle.ts:160-396](packages/excalidraw/TTA/useAIStreamingLifecycle.ts#L160-L396)). A second invocation overwrites `activeStreamAbortControllerRef`, so the first stream becomes uncancellable, both streams patch chat messages and fight over the shared canvas draft, and the user double-spends rate limit.

There is also a **latent race in the cleanup** that must be fixed for any single-flight design to be safe: the `finally` block unconditionally resets shared refs —

```ts
// useAIStreamingLifecycle.ts (current)
} finally {
  clearIdleStatusTimeout();
  cancelPendingCanvasPreviewRenders();
  resetCanvasPreviewRenderState();
  activeStreamAbortControllerRef.current = null;   // ← clobbers a successor's controller
  stopRequestedRef.current = false;                // ← clobbers a successor's stop request
}
```

If generation B starts while generation A is still unwinding (which is exactly what retry does today via `cancelActiveStream()` + new stream), A's `finally` nulls **B's** abort controller → Stop becomes a no-op for B, and B's pending canvas renders get cancelled by A. This hasn't bitten visibly only because the unwind is usually fast.

## 2. Desired behavior

| Scenario | Expected |
|---|---|
| Enter while idle, composer has content | sends (unchanged) |
| Enter while streaming | **no-op** — no send, no newline inserted, composer text/images preserved |
| Send button while streaming | already impossible (Stop button shown) — unchanged |
| Double-Enter in quick succession (before React re-renders) | exactly **one** generation starts |
| Retry (error retry or regenerate) while another stream is active | allowed — **interrupts** the active stream (existing semantics), and the interrupted assistant message is closed out as `aborted`/`interrupted`, never left spinning |
| Stop button | unchanged behavior |
| Typing / pasting images into the composer while streaming | still allowed (composing the next prompt is a feature) |
| Send immediately after a stream completes | allowed (normal next turn) |

Non-goals (explicitly out of scope): queueing a send to auto-fire when the current stream ends; any server-side single-flight; findings C2/C3 (separate fixes); the pre-existing “retry an older message mid-stream orphans the newer user message” quirk (this change improves it — the orphaned *assistant* message now gets closed out — but the UX rethink is separate).

## 3. Design — three layers

Defense in depth; each layer alone is insufficient:

- **Layer 1 — UI consistency (`TTAComposer`)**: `handleSend` early-returns when `isSending`. Makes Enter behave like the button. *Insufficient alone:* `isSending` is a prop derived from React state — stale for events dispatched before the next render (fast double-Enter).
- **Layer 2 — call-site guard (`TTADialog.sendChatPrompt`)**: check `isSendingChat` **and** a ref-based `isGenerationActive()` exposed by the lifecycle hook. The ref is set synchronously inside `generateResponse`, and two keydowns are always separate tasks, so the second Enter reliably sees it. *Insufficient alone:* other callers (retry) and future call sites bypass `sendChatPrompt`.
- **Layer 3 — lifecycle invariant (`useAIStreamingLifecycle.generateResponse`)**: ownership-token single-flight with **last-caller-wins** semantics. If a stream is active on entry, it is interrupted (abort + cancel pending canvas renders + close out its chat message), exactly like retry already intends. All shared-state cleanup (`finally`, error paths, stream callbacks) becomes ownership-guarded so a finished/interrupted invocation can never clobber its successor.

Why *last-caller-wins* rather than *reject* at layer 3: by the time `generateResponse` runs, the caller has already mutated chat state (user message appended, composer cleared) — silently no-op'ing would strand an unanswered user message. Rejection is the job of layers 1–2, *before* state mutations; layer 3's job is to make whatever happens next consistent. It also makes retry's existing interrupt flow safe instead of accidentally-working.

Why a **token** (monotonic counter) and not the abort controller or `assistantId` for ownership: `cancelActiveStream()` nulls the controller ref from outside (so the controller can't be used to test "am I still the owner"), and `assistantId` is *reused* on error-retry (`retryAssistantId = isErrorRetry ? messageId : ...` in TTADialog), so it is not unique per invocation.

## 4. Implementation steps

### Step 1 — `packages/excalidraw/TTA/TTAComposer.tsx`

Find:

```ts
  const handleSend = useCallback(() => {
    if (disabled) {
      return;
    }
```

Replace with:

```ts
  const handleSend = useCallback(() => {
    // The send button is replaced by a Stop button while a generation is in
    // flight (`canSend` gates only the button) — keep Enter-to-send and any
    // programmatic callers consistent with it.
    if (disabled || isSending) {
      return;
    }
```

And add `isSending` to the hook's dependency array. Find:

```ts
  }, [
    disabled,
    inputValue,
    selectedImages,
    onSend,
    resetValue,
    allowImageUpload,
  ]);
```

and add `isSending,` to the list.

Notes:
- The early return happens **before** `onSend`/`resetValue`, so composer text and attached images are preserved — the user can send them after the stream ends. This is intentional.
- `handleKeyDown` already `preventDefault()`s Enter before calling `handleSend`, so a blocked Enter inserts no newline. Intentional: Enter never means "newline" in this composer (Shift+Enter does), and silently inserting one would surprise.
- Do not touch the paste/typing paths — composing during a stream stays allowed.

### Step 2 — `packages/excalidraw/TTA/useAIStreamingLifecycle.ts`

#### 2a. Add ownership refs

Find:

```ts
  const activeStreamAbortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);
  const chatMessagesRef = useRef(chatMessages);
```

Append below:

```ts
  // Monotonic token identifying the invocation that currently owns the shared
  // streaming state (abort controller, stop flag, throttled canvas preview).
  // Guards every shared-state write so a finished or interrupted invocation
  // can never clobber its successor (see C1 in tta.md).
  const generationSeqRef = useRef(0);
  const activeGenerationTokenRef = useRef<number | null>(null);
```

#### 2b. Move `cancelActiveStream` above `generateResponse`

`generateResponse` will reference `cancelActiveStream` in its body and dependency array. The dependency array is evaluated when the `useCallback` executes, so referencing a `const` declared *later* in the component throws (TDZ). Move this block (currently below `generateResponse`):

```ts
  const cancelActiveStream = useCallback(() => {
    if (activeStreamAbortControllerRef.current) {
      activeStreamAbortControllerRef.current.abort();
      activeStreamAbortControllerRef.current = null;
    }
  }, []);
```

to just after the `resetCanvasPreviewRenderState` definition (before `generateResponse`). It has no dependencies; the move is purely mechanical. Do not leave a duplicate behind.

#### 2c. Add the interrupt helper

Place after `patchAssistantMessage` (it follows the same shape as `stopIncompleteAssistantMessages` in [chatHelpers.ts](packages/excalidraw/TTA/chatHelpers.ts) and the stop handler in TTADialog):

```ts
  /**
   * Closes out any still-streaming assistant message other than the one the
   * new generation owns. Without this, an interrupted generation's message
   * would stay `isComplete: false` and spin forever (its stream is aborted,
   * so no further patches arrive).
   */
  const markIncompleteAssistantMessagesInterrupted = useCallback(
    (excludeAssistantId: string) => {
      setChatMessages((prev) => {
        let didChange = false;
        const next = prev.map((message) => {
          if (
            message.role === "assistant" &&
            message.isComplete === false &&
            message.id !== excludeAssistantId
          ) {
            didChange = true;
            return {
              ...message,
              lifecycleStatus: "aborted" as const,
              progressPhase: undefined,
              statusText: undefined,
              generationElapsedMs: Math.max(
                0,
                Date.now() -
                  (message.generationStartedAt ??
                    message.createdAt ??
                    Date.now()),
              ),
              isComplete: true,
              stopReason: "interrupted" as const,
            };
          }
          return message;
        });
        return didChange ? next : prev;
      });
    },
    [setChatMessages],
  );
```

(`stopReason: "interrupted"` and its i18n key `ai.chat.stopReason.interrupted` already exist — used by `stopIncompleteAssistantMessages`.)

The `excludeAssistantId` parameter matters: both the normal-send and regenerate flows insert the **new** pending placeholder *before* `generateResponse` runs, and error-retry resets its target message to pending first — all of these are `isComplete: false` at entry and must not be closed out. They are always the `assistantId` of the new invocation.

#### 2d. Claim ownership at the top of `generateResponse`

Find the start of the function body:

```ts
  const generateResponse = useCallback(
    async (assistantId: string, payload: AIGenerateRequestPayload) => {
      let activeTurnId: string | null = null;
```

Insert at the very top of the body (before the local declarations):

```ts
      // --- Single-flight: last caller wins. ---
      // Guarded callers (composer Enter / sendChatPrompt) never get here with
      // a stream active; retry gets here intentionally. Take over: abort the
      // active stream, drop its queued canvas renders, close out its message.
      if (activeGenerationTokenRef.current !== null) {
        cancelActiveStream();
        cancelPendingCanvasPreviewRenders();
        markIncompleteAssistantMessagesInterrupted(assistantId);
      }
      const generationToken = ++generationSeqRef.current;
      activeGenerationTokenRef.current = generationToken;
      const isCurrentGeneration = () =>
        activeGenerationTokenRef.current === generationToken;
```

Add `cancelActiveStream` and `markIncompleteAssistantMessagesInterrupted` to `generateResponse`'s dependency array (`cancelPendingCanvasPreviewRenders` is already there).

> Note: `cancelPendingCanvasPreviewRenders` is declared above `generateResponse` already; if you inlined Step 2b differently, re-check declaration order for everything referenced in the deps array.

#### 2e. Guard the stream callbacks

A late chunk can still flush from the aborted reader's queue after a takeover (the abort rejects the *next* read, not chunks already decoded). Without a guard it would patch the closed-out message and — worse — re-insert the old generation's canvas preview through the throttle.

In the `streamFetch({ ... })` options inside `generateResponse`:

- `onChunk` — find:

  ```ts
            onChunk: (partialPayload) => {
              if (stopRequestedRef.current) {
                return;
              }
  ```

  replace the condition with:

  ```ts
              if (stopRequestedRef.current || !isCurrentGeneration()) {
                return;
              }
  ```

- `onStarted`, `onMessage`, `onStreamCreated` — add the same early return as the first line of each:

  ```ts
              if (!isCurrentGeneration()) {
                return;
              }
  ```

  (These only patch message status — cosmetic — but the uniform rule is cheaper to reason about than per-callback exceptions.)

The post-await success path already self-guards: a takeover aborts the old controller, so the existing `if (stopRequestedRef.current || abortController.signal.aborted) return;` catches it. Leave it as is.

#### 2f. Ownership-guard the catch block

Find:

```ts
      } catch (error: unknown) {
        cancelPendingCanvasPreviewRenders();
        if (stopRequestedRef.current || isAbortError(error)) {
          return;
        }
```

Replace with:

```ts
      } catch (error: unknown) {
        if (
          !isCurrentGeneration() ||
          stopRequestedRef.current ||
          isAbortError(error)
        ) {
          // Stopped or taken over: the successor owns the shared state and
          // this invocation's message has already been closed out.
          return;
        }
        cancelPendingCanvasPreviewRenders();
```

Rationale for moving `cancelPendingCanvasPreviewRenders()` below the return: in the interrupted case the *successor's* renders may already be queued; cancelling them from the dying invocation is exactly the cross-talk this change removes. For genuine owner errors it still runs. (The later `removeGeneratedElementsByMessageId(activeMessageId)` / `clearStreamingCanvasPreview()` in this block are then only reachable by the owner — correct.)

#### 2g. Ownership-guard the finally block

Find:

```ts
      } finally {
        clearIdleStatusTimeout();
        cancelPendingCanvasPreviewRenders();
        resetCanvasPreviewRenderState();
        activeStreamAbortControllerRef.current = null;
        stopRequestedRef.current = false;
      }
```

Replace with:

```ts
      } finally {
        // Invocation-local cleanup — always.
        clearIdleStatusTimeout();
        // Shared-state cleanup — only if this invocation still owns it. A
        // successor that took over (retry, forced send) must keep its abort
        // controller, stop flag, and queued canvas renders intact.
        if (isCurrentGeneration()) {
          activeGenerationTokenRef.current = null;
          cancelPendingCanvasPreviewRenders();
          resetCanvasPreviewRenderState();
          activeStreamAbortControllerRef.current = null;
          stopRequestedRef.current = false;
        }
      }
```

#### 2h. Expose `isGenerationActive`

Add near `setStopRequested`:

```ts
  const isGenerationActive = useCallback(
    () => activeGenerationTokenRef.current !== null,
    [],
  );
```

and add `isGenerationActive,` to the hook's returned object.

### Step 3 — `packages/excalidraw/TTA/TTADialog.tsx`

#### 3a. Destructure the new helper

Find the `useAIStreamingLifecycle({ ... })` destructuring:

```ts
  const {
    clearStreamingCanvasPreview,
    clearActiveCanvasDraftFromCanvas,
    commitStreamingCanvasPreview,
    resetActiveCanvasDraft,
    cancelActiveStream,
    cancelPendingCanvasPreviewRenders,
    setStopRequested,
    generateResponse,
  } = useAIStreamingLifecycle({
```

and add `isGenerationActive,` to the destructured list.

#### 3b. Guard `sendChatPrompt`

Find:

```ts
  const sendChatPrompt = async (prompt?: string, images?: string[]) => {
    if (rateLimits?.rateLimitRemaining === 0) {
      return;
    }
```

Replace with:

```ts
  const sendChatPrompt = async (prompt?: string, images?: string[]) => {
    // Single-flight: the composer blocks Enter/send while streaming, but
    // `isSendingChat` is React state and can be stale within a tick — the
    // lifecycle ref check closes that race (it is set synchronously when a
    // generation starts). Retry is intentionally NOT routed through here;
    // it interrupts the active stream by design.
    if (isSendingChat || isGenerationActive()) {
      return;
    }
    if (rateLimits?.rateLimitRemaining === 0) {
      return;
    }
```

Do **not** add this guard to `handleRetry` — interrupting is its intended semantics (it already calls `cancelActiveStream()` itself; with Step 2d that explicit call becomes redundant but harmless — leave it, it documents intent).

## 5. Invariants to preserve (regression watch-list)

- **Stop button flow**: `handleStopGeneration` sets `stopRequested`, aborts, commits the preview, and patches the last message to `aborted/stopReason: "user"`. The unwinding invocation must still take the quiet exit (`stopRequestedRef.current` → return) and its finally must still reset `stopRequested` (it is the owner — token check passes, since `cancelActiveStream` nulls only the *controller* ref, never the token).
- **Error retry** (`handleRetry`, `isErrorRetry === true`): reuses the failed message's `id` as `assistantId` and resets it to pending *before* calling in — the interrupt helper must not close it out (covered by `excludeAssistantId`).
- **Regenerate** (`isErrorRetry === false`): removes the old message, appends a fresh placeholder, exports a retry reference image (async, before `generateResponse`) — no new guard may block this path.
- **Delete during stream** (`executeDelete`): calls `setStopRequested(true)` + `cancelActiveStream()` and never starts a new generation — the dying invocation exits via the stop check; its finally is owner-scoped and runs fully. Unchanged behavior.
- **Unmount cleanup effect** calls `cancelActiveStream` — unchanged.
- Composer text/images survive a blocked Enter (Step 1 returns before `resetValue`).

## 6. Edge-case walkthrough (why this is enough)

- **Double-Enter, same render window**: two keydowns are two event-loop tasks. Task 1 runs `sendChatPrompt` → `streamAssistantResponse` → `generateResponse` *synchronously up to its first await*, which claims the token. Task 2's `sendChatPrompt` sees `isGenerationActive() === true` (ref, not state) → no-op. One stream.
- **Enter mid-stream**: Layer 1 blocks at the composer; even if a future caller bypasses the composer, Layer 2 blocks; even if someone calls `generateResponse` directly, Layer 3 keeps the world consistent.
- **Retry of older message while streaming**: `handleRetry` cancels the stream, then `generateResponse` entry sees no active token *if* the old invocation already unwound, or interrupts (idempotently — `cancelActiveStream` on a nulled ref is a no-op) if not. Either way the in-flight message is closed out as `interrupted` by the helper (today it stays spinning forever — this fix improves that).
- **Old invocation unwinds *after* successor started**: its catch returns early (not owner / AbortError), its finally skips all shared resets (not owner). Successor's Stop button, stop flag, and throttled canvas renders stay intact. This is the latent clobber-race fix.
- **Late chunk flushes after takeover**: `onChunk`'s `isCurrentGeneration()` guard drops it — no message resurrection, no stale canvas preview insert.
- **Send right after completion**: token already cleared by the owner's finally → guards pass → normal next turn.

## 7. Tests

### 7a. Extend `packages/excalidraw/TTA/useAIStreamingLifecycle.test.tsx`

Follow the existing `TestHarness` pattern (renders the hook, `streamFetch` mocked, asserts via serialized `chatMessages`). You'll need a harness variant that (1) lets the test trigger `generateResponse` imperatively and (2) uses a `streamFetch` mock whose first call returns a **deferred** promise capturing its `signal`:

```ts
const createDeferredStream = () => {
  let resolve!: (value: TTAStreamFetchResult) => void;
  const promise = new Promise<TTAStreamFetchResult>((r) => (resolve = r));
  return { promise, resolve };
};
```

Cases:

1. **second call interrupts the first** — call `generateResponse("assistant-1", ...)` (deferred, never resolves on its own), then `generateResponse("assistant-2", ...)` (resolves with a completed `finalPayload`). Assert:
   - the first call's `signal.aborted === true`;
   - message `assistant-1` ends `{ isComplete: true, lifecycleStatus: "aborted", stopReason: "interrupted" }`;
   - message `assistant-2` ends completed with its `turnId`/`messageId` — and then resolve the *first* deferred (late settle) and re-assert `assistant-2` is untouched (finally-clobber regression).
2. **late unwind doesn't break the successor's Stop** — as above, but after the first invocation settles, call `cancelActiveStream()` and assert the *second* fetch's signal aborts (i.e. the controller ref still points at stream 2).
3. **`isGenerationActive`** — `false` before, `true` while the deferred is pending, `false` after resolution.
4. **error-retry placeholder survives** — start `generateResponse("assistant-1")` while a message with `id: "assistant-1", isComplete: false` exists (the harness's default state already has this): assert it is *not* marked interrupted by its own invocation's entry (the exclude rule).

### 7b. New `packages/excalidraw/TTA/TTAComposer.test.tsx`

`TTAComposer` calls `useI18n()` internally; if rendering it standalone complains about i18n context, stub it (this is the robust path):

```tsx
vi.mock("../i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
```

Cases (render with `value="hello"`, `onChange` no-op so content exists):

1. `isSending={false}` + Enter keydown on the textarea → `onSend` called once with `"hello"`.
2. `isSending={true}` + Enter → `onSend` **not** called, and the textarea value is unchanged (no `onChange("")` reset call).
3. `isSending={true}` + Shift+Enter → unchanged behavior (no send; newline handling is the browser default since `handleKeyDown` ignores it).
4. (existing behavior, cheap to lock in) `disabled={true}` + Enter → no send.

### 7c. Commands

```bash
yarn test:typecheck
yarn test:update   # or: yarn vitest packages/excalidraw/TTA
```

### 7d. Manual QA (against excalidraw-app + a TTA backend)

- Send → while streaming type more text → press Enter repeatedly → exactly one generation; text stays in composer; after completion, Enter sends it as the next turn.
- Send → Stop mid-stream → message shows “stopped”, partial preview committed (unchanged behavior).
- Send → while streaming, Retry the previous completed message → old stream stops, its bubble shows *interrupted* (not an infinite spinner), retry streams normally, Stop works on the retry.
- Trigger an error retry (kill the backend mid-stream, then Retry) → spinner resets, retry proceeds.
- Delete the streaming turn via an older message's delete → no stray canvas preview, no stuck spinner.

## 8. Acceptance criteria

- [ ] Enter while `isSending` does not call `onSend`, inserts no newline, and preserves composer content.
- [ ] Rapid double-Enter produces exactly one `streamFetch` call.
- [ ] `generateResponse` is last-caller-wins: starting a new generation aborts the previous fetch and its assistant message is finalized as `aborted`/`interrupted`.
- [ ] A late-unwinding invocation cannot null the successor's abort controller, reset its stop flag, or cancel its pending canvas renders (ownership-guarded `catch`/`finally`/callbacks).
- [ ] Retry, Stop, delete-during-stream, and unmount flows behave exactly as before (watch-list in §5).
- [ ] New/updated tests in 7a/7b pass; `yarn test:typecheck` clean.

## 9. Follow-ups this unlocks (do not bundle)

- **C2** (EOF-without-`done` treated as success) and **C3** (`handleRetry` missing catch) from [tta.md](tta.md) touch the same files — keep them as separate changes on top.
- The retry-during-stream UX (orphaned *user* message of the interrupted turn) is now visible-but-consistent; a product decision is needed on whether retry of an older turn should be disabled while streaming instead.
- If a "queue the send until the stream finishes" UX is ever wanted, it slots in at Layer 2 (`sendChatPrompt`) without touching Layers 1/3.
