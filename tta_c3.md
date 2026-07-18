# C3 implementation proposal — failed retries must not surface as unhandled promise rejections

Fixes finding **C3** from [tta.md](tta.md): *failed retry throws an unhandled promise rejection*.

Companion to [tta_c1.md](tta_c1.md) and [tta_c2.md](tta_c2.md) (same conventions: match code anchors by snippet, not line number; implementable without re-deriving the analysis). The change is **one catch block** in `packages/excalidraw/TTA/TTADialog.tsx` — no lifecycle, transport, type, i18n, or server changes.

---

## 1. The bug

The streaming lifecycle has an explicit error contract. When `generateResponse` hits an *unexpected* throw (anything its catch can't classify as stop/abort/already-handled), it patches the assistant message to a failed state and then **deliberately re-throws**, marked as handled ([useAIStreamingLifecycle.ts:339-373](packages/excalidraw/TTA/useAIStreamingLifecycle.ts#L339-L373)):

```ts
        patchAssistantMessage(assistantId, {
          lifecycleStatus: "failed",
          progressPhase: undefined,
          generationElapsedMs: getElapsedMs(generationStartedAt),
          statusText: undefined,
          error: {
            code: errorCode,
            message: errorMessage,
          },
          isComplete: true,
        });
        throw withAIChatErrorMeta(new Error(errorMessage), {
          handled: true,
        });
```

The contract is: *callers must catch; `handled: true` means "the chat message is already patched — don't add your own error UI".* `sendChatPrompt` honors it ([TTADialog.tsx:767-786](packages/excalidraw/TTA/TTADialog.tsx#L767-L786)):

```ts
    } catch (err) {
      console.error("[AI Chat] error:", err);
      clearStreamingCanvasPreview();
      if (!isAIChatErrorHandled(err)) {
        const message = err instanceof Error ? err.message : String(err);
        setChatMessages((prev) => [
          ...prev,
          { /* fallback error bubble */ },
        ]);
      }
    } finally {
      setIsSendingChat(false);
    }
```

`handleRetry` does not — it awaits the same pipeline inside a `try`/`finally` with **no catch** ([TTADialog.tsx:1016-1036](packages/excalidraw/TTA/TTADialog.tsx#L1016-L1036)):

```ts
      try {
        const retryImage = await (!isErrorRetry
          ? exportImageFromMessageSkeletons(message.messageId)
          : undefined);

        await streamAssistantResponse(
          conversationToRetry,
          { ... },
          { ... },
        );
      } finally {
        setIsSendingChat(false);
      }
```

and its only call site is a floating promise ([TTADialog.tsx:1310-1312](packages/excalidraw/TTA/TTADialog.tsx#L1310-L1312), via `TTADialogPanelActions.onRetry: (messageId: string) => void`):

```ts
    onRetry: (messageId) => {
      handleRetry(messageId);
    },
```

So any rejection escaping the `try` becomes a browser-level `Uncaught (in promise)` unhandled rejection.

### Which retry failures actually reject (verified)

One precision on [tta.md](tta.md)'s phrasing ("every failed retry"): **most** stream failures do *not* reject. `TTAStreamFetch` is total — its top-level catch converts every transport throw (network failure, reader error, callback throw inside the SSE loop) into a *resolved* `{ error }` ([client.ts:325-338](packages/excalidraw/TTA/client.ts#L325-L338)), and `generateResponse` handles resolved errors in its `if (error)` branch without throwing. The rejection paths that do escape `handleRetry`'s `try` are:

1. **Handled-marked rethrow** from `generateResponse`'s catch (the contract above). Live triggers with the stock adapter:
   - the **final canvas render fails**: after a *successful* stream, `throttledApplyStreamingCanvasPreviewResult.flush()` / `applyStreamingCanvasPreviewResult(finalPayload, finalMessageId)` run post-await inside `generateResponse`'s `try`; if `insertAISkeletons` throws there, the preview hook wraps it as `INVALID_RESULT` (1001) ([useAIStreamingCanvasPreview.ts:238-248](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L238-L248)) — 1001 is *not* in `isHandledStreamErrorCode`'s set ({400, 422, 429, 500}), so it reaches the patch+rethrow tail;
   - any **custom transport adapter** whose `stream()` rejects — `TTADialog` ships in the npm package and `transportAdapter` is a host prop; only `TTADefaultTransportAdapter` is guaranteed total.
2. **Not-handled rejections** that bypass `generateResponse` entirely: the synchronous guard in `streamAssistantResponse` ([TTADialog.tsx:681-684](packages/excalidraw/TTA/TTADialog.tsx#L681-L684)):

   ```ts
      const latestMessage = conversation.at(-1);
      if (!latestMessage || latestMessage.role !== "user") {
        throw new Error("Conversation must end with the latest user prompt.");
      }
   ```

   Today this is unreachable from `handleRetry` (the slice ends at the user message the loop just found), but it is the designated failure mode for future drift in the retry conversation assembly — and *if* it ever fires, the retry bubble was already reset to `pending`, nothing patches it back, and it **spins forever** on top of the unhandled rejection.

(`exportImageFromMessageSkeletons` cannot reject — it is internally try/caught and resolves `undefined` on failure, [TTADialog.tsx:559-582](packages/excalidraw/TTA/TTADialog.tsx#L559-L582). The `MIN_RETRYING_VISIBLE_MS` delay promise is resolve-only and sits before the `try` anyway.)

The send path has identical failure modes and already handles both; retry is simply the one non-conforming caller of the contract.

## 2. Desired behavior

| Scenario | Today | After fix |
|---|---|---|
| Retry succeeds | normal completion | unchanged |
| Retry fails via a **resolved** `{ error }` (server `error` chunk, HTTP !ok, fetch network failure through the default adapter) | message patched `failed` by the lifecycle; promise resolves — no rejection | unchanged |
| Retry fails via the **handled-marked rethrow** (final render failure, rejecting custom adapter, future post-await bug) | message patched `failed` by the lifecycle (UI looks correct) **+ unhandled promise rejection** in the console | rejection caught, `console.error`-logged, swallowed — UI identical |
| Retry fails via a **not-handled throw before the stream** (conversation guard, future bugs) | retry bubble stuck spinning forever **+ unhandled rejection** (`finally` does clear `isSendingChat`) | retry bubble patched to `failed` with the error message; no extra bubble; Retry still offered |
| Stop pressed during a retry | quiet return, no rejection | unchanged |
| Send-path failures (`sendChatPrompt`) | caught | unchanged |
| `onRetry` call-site shape | floating promise | still floating — `handleRetry` becomes total (never rejects) |

## 3. Design decisions (so nobody re-litigates them mid-implementation)

- **The catch lives in `handleRetry`; the call site stays fire-and-forget.** `TTADialogPanelActions.onRetry` is typed `(messageId: string) => void` and flows through two layers of sync UI callbacks (`TTAChatMessage` → `TTADialogPanel`); awaiting there would only move the floating promise one frame up — *somebody* has to be the final catcher, and the function that owns the retry state (the placeholder bubble, `isSendingChat`) is the right owner. This exactly mirrors `sendChatPrompt`, which is equally total and equally invoked floating from the composer's `onSend`.
- **Handled errors (`isAIChatErrorHandled(err)`): log and swallow.** Per the lifecycle contract, the assistant message was already patched to `failed` before the rethrow — any further state change would double-patch. A `console.error` keeps the diagnostic visible (same as `sendChatPrompt`).
- **Not-handled errors: patch the existing retry bubble, do not append a new one.** This is the one place the fix intentionally diverges from `sendChatPrompt`. On the send path, the guard throw happens *before* `streamAssistantResponse` inserts the assistant placeholder (`insertAssistantMessage` defaults to true, and insertion follows the guard) — so appending a fresh error bubble is correct there. On the retry path, `handleRetry` passes `insertAssistantMessage: false` because it already owns a bubble (`retryAssistantId` — the *reused* failed message id for error-retry, a fresh appended placeholder for regenerate), reset to `pending` before the `try`. Appending would strand that bubble spinning forever next to a second error bubble. Patch it instead, with the same field set the analogous failure patches use (`generateResponse`'s catch, `handleStopGeneration`): `lifecycleStatus: "failed"`, `progressPhase`/`statusText` cleared, `generationElapsedMs` stamped, `error: { message }`, `isComplete: true`. ⚠️ `TTADialog` has no `patchAssistantMessage` — that helper lives inside the lifecycle hook — so the catch uses the `setChatMessages((prev) => prev.map(...))` idiom the retry reset and stop handler already use.
- **Don't change `generateResponse`'s contract instead** (alternative considered and rejected). Making the lifecycle never reject would (a) still not cover the pre-stream guard throw, which never enters `generateResponse`; (b) dead-code `sendChatPrompt`'s `isAIChatErrorHandled` branch and silently change a documented contract; (c) collide with [tta_c1.md](tta_c1.md), which reworks that exact function's entry/catch/finally. Keep the contract, fix the one non-conforming caller. (A contract redesign is listed as a follow-up.)
- **Keep `clearStreamingCanvasPreview()` in the catch**, mirroring `sendChatPrompt`. For handled rethrows it is an idempotent no-op (the lifecycle's catch already ran `removeGeneratedElementsByMessageId` + `clearStreamingCanvasPreview`; the handle ref is null and the helper early-exits). For the pre-stream guard nothing was inserted (and `handleRetry` already cleared at entry). It only does real work for hypothetical future not-handled mid-stream bugs — cheap symmetry, zero risk.
- **Don't clear `skeletons` in the catch patch.** The error-retry reset already cleared them; the regenerate placeholder never had them; and if a future bug fails *after* partials streamed, keeping them on the failed message is exactly the salvage direction [tta_c2.md](tta_c2.md) §5 establishes.

## 4. Implementation steps

### Step 1 (the only step) — `packages/excalidraw/TTA/TTADialog.tsx`

Find (inside `handleRetry`):

```ts
      try {
        const retryImage = await (!isErrorRetry
          ? exportImageFromMessageSkeletons(message.messageId)
          : undefined);

        await streamAssistantResponse(
          conversationToRetry,
          {
            reason: isErrorRetry ? "generation_error" : "user_not_happy",
            avoidSimilarity: !isErrorRetry,
            retryAssistantMessageId: message.messageId,
          },
          {
            assistantId: retryAssistantId,
            insertAssistantMessage: false,
            images: retryImage ? [retryImage] : undefined,
          },
        );
      } finally {
        setIsSendingChat(false);
      }
```

Replace with:

```ts
      try {
        const retryImage = await (!isErrorRetry
          ? exportImageFromMessageSkeletons(message.messageId)
          : undefined);

        await streamAssistantResponse(
          conversationToRetry,
          {
            reason: isErrorRetry ? "generation_error" : "user_not_happy",
            avoidSimilarity: !isErrorRetry,
            retryAssistantMessageId: message.messageId,
          },
          {
            assistantId: retryAssistantId,
            insertAssistantMessage: false,
            images: retryImage ? [retryImage] : undefined,
          },
        );
      } catch (err) {
        // `handleRetry` is invoked fire-and-forget (panelActions.onRetry) —
        // it must never reject. `generateResponse` re-throws handled-marked
        // errors after patching the assistant message itself (see
        // useAIStreamingLifecycle); mirror `sendChatPrompt`'s catch, except
        // we patch the retry bubble we already own instead of appending a
        // fallback one (C3 in tta.md).
        console.error("[AI Chat] retry error:", err);
        clearStreamingCanvasPreview();
        if (!isAIChatErrorHandled(err)) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setChatMessages((prev) =>
            prev.map((entry) =>
              entry.id === retryAssistantId && entry.role === "assistant"
                ? {
                    ...entry,
                    lifecycleStatus: "failed",
                    progressPhase: undefined,
                    statusText: undefined,
                    generationElapsedMs: Math.max(
                      0,
                      Date.now() -
                        (entry.generationStartedAt ??
                          entry.createdAt ??
                          Date.now()),
                    ),
                    error: { message: errorMessage },
                    isComplete: true,
                  }
                : entry,
            ),
          );
        }
      } finally {
        setIsSendingChat(false);
      }
```

Notes:

- ⚠️ **Do not copy `sendChatPrompt`'s catch verbatim** — it declares `const message = err instanceof Error ? ...`, but `handleRetry` already binds `message` (`const message = chatMessages[messageIndex]` near the top). The block-scoped shadow would compile, but it is exactly the kind of confusion `no-shadow` lints exist for; hence `errorMessage`.
- **No dependency-array changes.** Everything the new code references is already covered: `clearStreamingCanvasPreview` and `setChatMessages` are in `handleRetry`'s deps, `isAIChatErrorHandled` is a module-scope import (already imported at the top of the file for `sendChatPrompt`), `retryAssistantId` is a local, `console` is global.
- The elapsed-time expression intentionally reads `entry.generationStartedAt` inside the updater (the `Math.max(0, Date.now() - (… ?? createdAt ?? now))` shape from `handleStopGeneration` and `stopIncompleteAssistantMessages`) rather than the closure's `retryStartedAt`: if `generateResponse` ran, it re-stamped `generationStartedAt` at its own entry, which is the more accurate epoch; if it never ran (pre-stream throw), the retry reset/placeholder set it to `retryStartedAt` — both cases resolve correctly.
- The patch deliberately leaves `turnId`/`messageId`/`skeletons`/`stopReason` untouched, same as `generateResponse`'s catch patch (`stopReason` is already `undefined` from the reset; keeping `messageId` keeps a follow-up error-retry pointed at the same server turn).

## 5. Invariants to preserve (regression watch-list)

- **`finally` still always runs** — the catch never returns early or rethrows, so `setIsSendingChat(false)` keeps clearing the composer's sending state on every path (it already did pre-fix; don't break it now).
- **No double error UI for handled errors** — the `isAIChatErrorHandled` gate must skip the patch entirely; the lifecycle already wrote `lifecycleStatus: "failed"` + `error` to the same bubble.
- **The patched bubble stays retryable** — `getLatestRetryableAssistantMessage` requires `isComplete && !warningType` ([chatHelpers.ts:179-193](packages/excalidraw/TTA/chatHelpers.ts#L179-L193)); the patch sets `isComplete: true` and never sets `warningType`, so the Retry button re-renders and the user can try again. A subsequent retry of the patched message takes the error-retry path (`Boolean(message.error)`), which is correct.
- **Both retry flavors patch the right bubble** — error-retry reuses the failed message's id (`retryAssistantId === messageId`); regenerate appended a fresh placeholder with `id: retryAssistantId` *before* the `try`, so it is present in `prev` by the time the catch's updater runs.
- **Stop during retry** — `handleStopGeneration` patches the bubble itself and `generateResponse` exits quietly (stop-flag / abort checks in both its success path and catch) — no rejection reaches the new catch; behavior unchanged.
- **Send path untouched** — `sendChatPrompt`'s append-a-fallback-bubble behavior stays as is (its placeholder may not exist at failure time; see §3).

## 6. Edge-case walkthrough (rejection-source inventory)

Everything awaited inside `handleRetry`'s `try`, and what the fix does with it:

- **`exportImageFromMessageSkeletons`** — total (internal try/catch → `undefined`); never reaches the catch.
- **`streamAssistantResponse` guard throw** (not handled-marked) — unreachable today from `handleRetry` (the conversation slice ends at the user message the backward scan just found, on the same captured `chatMessages` array), but if future drift makes it fire: today = forever-spinner + unhandled rejection; after = bubble patched `failed` with `"Conversation must end with the latest user prompt."`, retryable. This is the case that justifies the patch branch even though it is currently dead weight in practice.
- **`generateResponse`, resolved `{ error }`** (server error chunk, HTTP !ok, network failure via the default adapter — `TTAStreamFetch` never rejects) — handled inside the lifecycle's `if (error)` branch; resolves normally; the new catch never fires. Unchanged before/after.
- **`generateResponse`, handled-marked rethrow** (final-render `INVALID_RESULT`, rejecting custom adapter, future post-await throw) — bubble already patched by the lifecycle; new catch logs and swallows. The `clearStreamingCanvasPreview()` call is a no-op here (handle already nulled by the lifecycle's cleanup).
- **`generateResponse`, swallowed throws** — its catch returns *without* rethrowing for stop/abort, for thrown errors carrying a handled stream code (400/422/429/500), and when the message already has an `error`; none of these reject, so none reach the new catch. (The coded-throw swallow leaves the bubble pending if a custom adapter throws pre-coded errors — pre-existing, out of scope; noted in §11.)
- **Code before the `try`** (sync section: cancel/reset/setState, plus the resolve-only `MIN_RETRYING_VISIBLE_MS` delay) — can only reject via a sync bug in React state updates or scene calls; same exposure class as every sync event handler in the app, and the same residual exposure `sendChatPrompt` has before *its* try. Out of scope.
- **The catch itself** — `setChatMessages` (pure updater) and `console.error` are safe; `clearStreamingCanvasPreview` could in pathological cases throw from `updateScene`, which would re-reject. `sendChatPrompt` has the identical residual exposure; accepted for symmetry rather than nesting try/catch inside a catch.

## 7. Audit — sibling fire-and-forget async handlers in `TTADialog`

Swept so reviewers don't have to redo it. Every async function invoked without an await/`.catch` in TTADialog.tsx:

| Handler | Called floating from | Awaits inside | Verdict |
|---|---|---|---|
| `sendChatPrompt` | composer `onSend` ([TTADialog.tsx:1253](packages/excalidraw/TTA/TTADialog.tsx#L1253)) | `streamAssistantResponse` | **fine** — full try/catch/finally with the `isAIChatErrorHandled` gate |
| `handleRetry` | `panelActions.onRetry` | `exportImageFromMessageSkeletons`, delay, `streamAssistantResponse` | **the C3 fix** |
| `executeDelete` | `confirmDelete` ([TTADialog.tsx:1199-1206](packages/excalidraw/TTA/TTADialog.tsx#L1199-L1206)) | two `transportAdapter.truncate` calls | **fine** — both awaits individually try/caught (`console.warn` on failure: the clear-chat path at the `!truncated.length` branch, and the keep-through-turn path below it); the third risky call, `insertAISkeletons`, is sync and also try/caught. Remaining sync calls (`removeGeneratedElementsByGenerationTags`, draft clears) are unguarded but are ordinary scene mutations — same exposure as any sync handler; not a C3-class hole |
| `handleStartNewChat` | `panelActions.onStartNewChat`, `handleDeleteChat`, the Cmd/Ctrl+Shift+O shortcut | **none** — the `async` keyword is vestigial; `saveConversationToHistory` is synchronous (state update; the IndexedDB write happens later in `useTTAChatHistory`'s debounced effect, which has its own try/catch) | **fine** — can only reject via a sync throw, equivalent to a sync handler |

No other floating async call sites exist in the file (`handleInsertResult` is sync with an internal try/catch; everything else is sync).

## 8. Ordering / compatibility with C1 and C2

- **[tta_c1.md](tta_c1.md)** touches `TTAComposer`, `useAIStreamingLifecycle.generateResponse` (entry/callbacks/catch/finally), and adds a guard at the *top* of `sendChatPrompt` — it explicitly does **not** modify `handleRetry` ("Do not add this guard to `handleRetry`"), and its catch rework only *prepends* ownership/stop checks, leaving the patch+rethrow tail (the contract C3 relies on) intact. No logical conflict; this change's anchors (the `handleRetry` try/finally) are untouched by C1, though unrelated line numbers in TTADialog.tsx will drift if C1 lands first — match on snippets. C1's §6 covers the retry-during-stream interplay (interrupting an active stream is retry's intended semantics); C3 changes nothing about that.
- **[tta_c2.md](tta_c2.md)** converts EOF-without-terminal-chunk into a *resolved* `{ error }` — i.e. it produces more failures on the non-rejecting path, which `handleRetry` already survives. Orthogonal. One coordination point: C2 §7c generalizes the lifecycle `TestHarness` to accept a `streamFetch` override — the same generalization §9a below needs. Whoever lands second reuses the other's harness param instead of duplicating it.
- **Landing order: any.** All three are independent; implement C3 standalone.

## 9. Tests

There is no `TTADialog` test file today, and standing one up means mocking the `useApp` context (the dialog reads `app.scene`/`app.api`/`app.files` throughout), jotai atoms, i18n, and both adapters — disproportionate scaffolding for a 25-line catch. Instead: pin the **lifecycle contract** the catch relies on (cheap, durable, uses existing infrastructure), and cover the catch itself with manual QA. Explicitly *not* proposing a TTADialog component test.

### 9a. Extend `packages/excalidraw/TTA/useAIStreamingLifecycle.test.tsx`

Two harness tweaks (both additive; existing test unchanged):

1. Optional `streamFetch` override. Find:

   ```ts
     const [streamFetch] = useState(() => vi.fn().mockResolvedValue(streamResult));
   ```

   → `const [streamFetch] = useState(() => streamFetchMock ?? vi.fn().mockResolvedValue(streamResult));` with new optional props `streamFetchMock?: TTATransportAdapter["stream"]` (import the type from `./client`) and `streamResult` made optional. (Same shape as [tta_c2.md](tta_c2.md) §7c — reuse if already landed.)

2. Capture settlement instead of `void`-ing. Find:

   ```ts
       void generateResponse("assistant-1", { prompt: "hello" });
   ```

   Replace with:

   ```ts
       generateResponse("assistant-1", { prompt: "hello" }).then(
         () => onGenerateSettled?.(null),
         (error) => onGenerateSettled?.(error),
       );
   ```

   with a new optional prop `onGenerateSettled?: (error: unknown) => void` (add it to the effect's dependency array; the `didGenerateRef` guard keeps it single-shot). ⚠️ This is not optional polish: with a rejecting mock, the current `void` call becomes an unhandled rejection, and this repo's vitest config does not set `dangerouslyIgnoreUnhandledErrors` — the run would fail on the rejection itself rather than on your assertions.

New cases:

1. **"rejects with a handled-marked error after patching the message when the stream fetch throws"** — the C3 contract. `streamFetchMock: vi.fn().mockRejectedValue(new Error("boom"))`, `onGenerateSettled` spy. After `waitFor(() => expect(onGenerateSettled).toHaveBeenCalledTimes(1))`:
   - the settled value is an `Error` with `message: "boom"` and `isAIChatErrorHandled(settled) === true` (import from `./chatErrors`) — i.e. *a rejection from `generateResponse` always means "the message is already patched; just swallow"*;
   - serialized `messages[1]` matches `{ id: "assistant-1", role: "assistant", isComplete: true, lifecycleStatus: "failed", error: { message: "boom" } }`;
   - `messages` still has length 2 — the hook patches, it never appends a fallback bubble (that division of labor is why the dialog-side catch exists at all).
2. **"resolves — does not reject — when the transport reports a stream error"** — the control pinning the other half: `streamResult: { error: { code: 500, message: "kaput", lifecycleStatus: "failed" } }` → `onGenerateSettled` called with `null`, `messages[1]` matches `{ isComplete: true, lifecycleStatus: "failed", error: { code: 500, message: "kaput" } }`. This documents that resolved transport errors never reach callers' catches — so `handleRetry`'s catch only ever sees thrown errors, which is what §3's two-branch design assumes.

### 9b. Commands

```bash
yarn test:typecheck
yarn vitest packages/excalidraw/TTA/useAIStreamingLifecycle.test.tsx
```

### 9c. Manual QA (excalidraw-app + dev oss-ai-server)

The dev backend is the oss-ai-server on `localhost:3016` (`VITE_APP_AI_BACKEND` in `.env.development`). ⚠️ Note the repro subtlety from §1: simply killing the backend does **not** reproduce the unhandled rejection — a dead backend yields a *resolved* `{ error }` (the default adapter never rejects). You need one of the temp hacks below for the rejecting flavors (same convention as tta_c2.md's QA, which uses temporary server hacks). Optionally run `window.addEventListener("unhandledrejection", (e) => console.log("UNHANDLED:", e.reason));` in the devtools console first to make hits unmissable.

1. **Handled-rethrow flavor** — temp hack in `excalidraw-app/components/AI.tsx`, right after `ttaTransport` is constructed:

   ```ts
   // TEMP — C3 QA only, do not commit:
   ttaTransport.stream = async () => {
     throw new Error("simulated transport failure");
   };
   ```

   Then: send a prompt → bubble turns failed, *no* extra fallback bubble, `[AI Chat] error:` logged (control: the send path already swallows the handled rethrow). Click **Retry** → before the fix: `Uncaught (in promise) Error: simulated transport failure` (the bubble still looks correct — which is exactly why this bug shipped silently); after the fix: only `[AI Chat] retry error:` is logged, no unhandled rejection, the bubble shows failed, Retry is still offered, and the composer leaves its sending state (Stop button reverts).
2. **Not-handled flavor** (optional, demonstrates why the catch patches instead of appending) — temporarily change `handleRetry`'s slice to `chatMessages.slice(0, retryUserMessageIndex)` (drops the trailing user message) and Retry an errored message → before the fix: the retry bubble spins forever *and* the guard error is an unhandled rejection; after: the bubble is patched to failed with `"Conversation must end with the latest user prompt."` and remains retryable.
3. **Resolved-error control** (no hacks) — stop the oss-ai-server, send → failed bubble with connection copy; click Retry → fails the same way; verify there is **no** unhandled rejection before *or* after the fix (this path never rejected — it must stay that way).
4. **Regressions** — restart the backend: normal send → success; Retry (regenerate) on a successful message → streams, old result swapped; error-retry after a mid-stream `Ctrl+C` of the server → recovers on retry; Stop mid-retry → "stopped" bubble, no rejection; delete the turn mid-retry → clean cancel.

## 10. Acceptance criteria

- [ ] `handleRetry` is total: no input or downstream failure makes its promise reject (the floating `panelActions.onRetry` call site is safe by construction).
- [ ] Handled-marked rejections from `generateResponse` are logged (`[AI Chat] retry error:`) and swallowed — no second patch, no appended bubble, no `Uncaught (in promise)` in the console.
- [ ] Not-handled rejections patch the existing retry bubble (`retryAssistantId`) to `{ lifecycleStatus: "failed", isComplete: true, error: { message }, progressPhase/statusText cleared, generationElapsedMs stamped }` — no appended bubble, and the bubble remains retryable.
- [ ] `setIsSendingChat(false)` still runs on every path (success, handled, not-handled, stop).
- [ ] The lifecycle contract is pinned by tests: a `generateResponse` rejection is always handled-marked with the message already patched (§9a case 1), and resolved `{ error }` results never reject (§9a case 2).
- [ ] `sendChatPrompt`, Stop, delete, and regenerate behavior unchanged (watch-list §5); `yarn test:typecheck` clean.

## 11. Follow-ups this surfaces (do not bundle)

- **C1 / C2** ([tta_c1.md](tta_c1.md), [tta_c2.md](tta_c2.md)) — same files, separate changes; C1's single-flight and C2's stream-EOF handling are explicitly out of scope here.
- **Lifecycle error-contract redesign** — the "patch then rethrow handled-marked" contract works but forces every caller to know it; folding errors into a resolved result (or the status-state-machine from [tta.md](tta.md) §4.3 / single-flight-at-hook-level §4.1) would remove the caller obligation structurally. Touches C1's territory — do it after C1.
- **Latent: coded throws are swallowed without patching** — `generateResponse`'s catch returns silently for thrown errors carrying a handled stream code (400/422/429/500, `isHandledStreamErrorCode`) on the assumption the message was already patched; a custom adapter that *throws* pre-coded errors (instead of resolving them) would leave the bubble pending forever. Unreachable with the default adapter; worth hardening when the contract is revisited.
- **`@typescript-eslint/no-floating-promises`** would have flagged `onRetry`/`confirmDelete` at review time; adopting it is a repo-wide lint decision, not a TTA change.
- **Retry-UX rework** (orphaned user message when retrying an older turn mid-stream, retry affordance placement) — tracked in C1 §9; unrelated to the rejection fix.
