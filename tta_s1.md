# S1 implementation proposal — generation attempts must never end stuck `pending`

Fixes finding **S1** from [tta.md](tta.md): *generation attempts stuck `pending` in DB on client stop/disconnect and on generic errors*.

Companion to [tta_c1.md](tta_c1.md)–[tta_c4.md](tta_c4.md) (same conventions: match code anchors by snippet, not line number — line numbers below are from `dwelle/tta` @ `226267446` and will drift; implementable without re-deriving the analysis). This is a **server-side** change in the `excalidraw-plus` repo — server paths are inline code (cross-repo, can't relative-link), client paths are relative links. The entire fix lives in `excalidraw-plus/libs/server/tta/src/lib/tta.ts` (`streamTta`) — **no route, schema, protocol, or client changes**.

---

## 1. The bug

`streamTta` (`libs/server/tta/src/lib/tta.ts:1996-2308`) is an async generator. It persists the attempt row (`tta_chat_turn_messages`, `status: "pending"`) via `saveGenerationAttempt`, then streams `started` → `partial`* → `done`. The row's status is only ever finalized by:

- `saveGeneration` → `status: "completed"` (the happy path, `tta.ts:1259-1272`),
- `saveParseError` → `status: "failed"` (parse-failure paths only, via `saveParseErrorSafely`),
- `markAttemptAborted` → `status: "aborted"` — but **only at five explicit call sites**: four `signal?.aborted` checkpoints plus the abort branch of the outer catch.

There is **no `finally`**. Two classes of exits bypass all five sites and leave the row `pending` forever:

### 1a. Consumer teardown (`.return()` injection) — the race-dependent flavor

Both consumers drive the generator the same way (`apps/api/src/routes/ai.ts:554-562`, `apps/oss-ai-server/src/api/ai.ts:194-199`):

```ts
        for await (const chunk of generator) {
          if (stream.signal.aborted) {
            break;
          }
          ...
          stream.write(chunk);
        }
```

`StreamingResponse` aborts `stream.signal` on socket close (`libs/server/fastifyutils/src/lib/streaming.ts:32-38`), and the client's Stop button closes the connection. Whether the row ends `aborted` (correct) or stuck `pending` (the bug) is then race-dependent:

- **Abort lands while the generator is awaiting the provider** (route suspended in `generator.next()`): the chained `AbortController` (`createAbortController`, `tta.ts:489-497`) cancels the provider request; the TanStack stream throws or ends; the generator resumes and hits either the loop-top checkpoint or the outer catch's abort branch → `markAttemptAborted` runs. **Works today.**
- **Abort lands between a `yield` and the next pull**: the route receives the chunk, sees `stream.signal.aborted`, `break`s. The `for await` cleanup injects `.return()` into the generator at its suspended `yield` — the generator unwinds: **`finally` blocks run, `catch` blocks do not**, and no checkpoint code executes. `markAttemptAborted` never runs. **Row stuck `pending` forever.**

Verified empirically (throwaway script, node v22.16.0 — the load-bearing semantics for this whole design):

1. On `break` out of `for await`, the generator's `finally` runs; its `catch` does **not** (no throw is involved — `.return()` is a return-completion, not an exception).
2. An `await` inside that `finally` **completes before the consumer's `break` finishes** — the for-await's implicit `.return()` is awaited as part of loop cleanup (an 80 ms awaited sleep in `finally` delayed the statement after the loop by 80 ms). So a DB write in `finally` is guaranteed to have settled before the route handler proceeds.
3. Explicit `iterator.return(x)` resolves `{ value: x, done: true }` only after the `finally`'s awaits settle — same guarantee for any consumer.
4. A **throw** inside `finally` during teardown propagates out of the consumer's `break` — which is why the status write must swallow its own failures (§3).
5. Unwind order on teardown at a `yield` inside `for await (… of eagerStream.iterable)`: the **inner** iterator is closed first (running `createEagerAsyncIterable`'s internal `finally { cancel(); }`, `tta.ts:563-565` → `abortController.abort()` — the provider request is cancelled, **no token leak**), then the outer `finally` runs. So provider cancellation fires before the status write.

### 1b. Generic throws after the attempt persist — the always-broken flavor

The outer catch (`tta.ts:2300-2307`):

```ts
  } catch (error) {
    if (signal?.aborted) {
      await markAttemptAborted();
      return;
    }

    yield createStreamError(error);
  }
```

For a non-abort throw it yields the error chunk to the client — and never touches the row. Parse failures are covered upstream (`saveParseErrorSafely` writes `failed` on every parse path before throwing), but anything else thrown after `didPersistAttempt = true` lands here with the row still `pending`: a `saveGeneration` DB failure (`tta.ts:2274`), the provider stream *throwing* instead of yielding an `error` chunk, `remapElementIds` throwing (`tta.ts:2272`), any future bug. The client is correctly told "failed"; the DB permanently says "pending".

Status currently feeds analytics and context-loading hygiene only, so nothing user-visible breaks *yet* — but every user Stop producing a permanently-`pending` row poisons any future "resume incomplete generation" work, and after [tta_c2.md](tta_c2.md) the client explicitly reports interrupted streams as errors, so the server record should agree (§7).

## 2. Desired behavior

| Exit path | Today | After fix |
|---|---|---|
| Full run, `saveGeneration` + `done` | `completed` | unchanged — and still **zero** `markGenerationAttemptStatus` calls |
| Stop/disconnect, abort lands while awaiting provider (checkpoint/catch flavor) | `aborted` | unchanged (now written by the `finally`, exactly once) |
| **Stop/disconnect, abort lands between `yield` and next pull (`.return()` teardown)** | **stuck `pending`** | `aborted` |
| **Generic throw after attempt persist** (`saveGeneration` failure, provider stream throw, …) | error chunk yielded, **stuck `pending`** | error chunk yielded, `failed` |
| Provider `error` chunk mid-stream | `failed` (via `saveParseErrorSafely`) | unchanged (`finally` re-asserts `failed` — idempotent, and a second chance if the safe-save itself failed and was swallowed) |
| Parse failure (strict / heuristic / LLM-fix exhausted) | `failed` (via `saveParseErrorSafely`) then error chunk | unchanged |
| Abort arriving *during* the LLM-fix round | `aborted` (`parseFinalGeneration` deliberately rethrows on abort *without* saving `failed`, `tta.ts:1958-1961`) | unchanged — the design below preserves this existing "abort wins during error handling" intent |
| Failure *before* `saveGenerationAttempt` succeeds (context load, message build, the attempt transaction itself) | no row / row rolled back; no status write | unchanged (`didPersistAttempt` guard) |
| Teardown at the `done` yield (abort racing a successful finish) | `completed` (already written) | unchanged — `finally` skips; even a stray write would be a SQL no-op (§3) |

## 3. Design decisions (so nobody re-litigates them mid-implementation)

- **A `finally` is the only mechanism that can cover the `.return()` teardown.** No checkpoint, no catch, no consumer-side code can run inside the generator at that point (§1, fact 1). Everything else follows from this.
- **Terminal-status tracking: `finalStatus: "completed" | "failed" | null`, with `null ⇒ "aborted"` at the `finally`.** The state machine:

  | Exit path | `finalStatus` when `finally` runs | `finally` writes |
  |---|---|---|
  | `saveGeneration` succeeded | `"completed"` (set **before** `yield done` — ⚠️ see §4 step 6) | nothing (skip — saves a pointless DB roundtrip per successful generation) |
  | provider `error` chunk; outer catch, non-abort | `"failed"` (set **before** the error-chunk `yield`, so teardown *at* that yield still records the genuine failure) | `failed` |
  | abort checkpoints (`return`); outer catch, abort branch (`return`); consumer teardown (`.return()` at any `yield`) | `null` | `aborted` |

  Why no explicit `"aborted"` member: the teardown path **cannot execute an assignment** — no code runs between the suspended `yield` and the `finally` — so a "`null` means torn down/aborted" rule must exist regardless. Giving the abort checkpoints an explicit `finalStatus = "aborted"` would create a second, redundant representation of the same fact; instead they reduce to bare `return` and the `finally` owns the mapping in one place. Consumer-stop ≈ abort: the routes only `break` when `stream.signal.aborted`, and any hypothetical other consumer calling `.return()` also means "stopped consuming" — abort semantics either way.
- **Explicit `finalStatus` beats the teardown default; `completed` beats everything.** Concretely: once a path has decided `failed` (set before its `yield`), teardown at that yield writes `failed`, not `aborted` — the genuine error is the better record. Conversely, the abort branches deliberately *don't* set `failed`, so an abort arriving during error handling ends `aborted` — which is exactly what the existing code already prefers (`parseFinalGeneration`'s catch rethrows on abort *without* `saveParseErrorSafely`, and `parseExmlWithFix:1759-1762` likewise). One consequence: a provisional `failed` written by `saveParseErrorSafely` before the LLM-fix round (`tta.ts:1706`) gets overwritten to `aborted` if the user stops mid-repair — `markGenerationAttemptStatus` only SQL-guards `ne(status, 'completed')` (`tta.ts:1355-1358`), and that overwrite is intentional: the repair was abandoned because of the abort, not the error, and the `tta_errors` row keeps the diagnostics either way. (Same logic as `saveGeneration` unconditionally upgrading a provisional `failed` to `completed` after a successful fix — `tta.ts:1259-1272` has no status guard by design.)
- **The `finally`'s DB write must be swallowed + logged, never rethrown.** A throw in `finally` during teardown propagates out of the consumer's `break` (§1, fact 4) — in the Plus route that would surface as a handler error and wrongly hit the rollback/`stream.end(error)` paths. The existing `markAttemptAborted` already has the right try/catch+log shape; generalize it to `finalizeAttemptStatus(status)` rather than writing a new one. It also keeps the `didPersistAttempt` guard — `finally` runs even when the attempt transaction failed (no row to mark) or when `loadGenerationContext` threw (that happens *before* the `try`, so the `finally` doesn't even run there — also fine, nothing persisted).
- **⚠️ Never `yield` inside the `finally`.** During `.return()` teardown a `yield` in `finally` would re-suspend the generator mid-unwind and hand a value to a consumer that already left the loop. The `finally` is awaits-only.
- **Remove the five scattered `markAttemptAborted()` calls; keep the checkpoint `return`s.** The checkpoints are *work-avoidance* guards (don't parse, don't run a paid LLM-fix round, don't `saveGeneration` for a dead client) — they stay as bare `if (signal?.aborted) return;`. But their status writes become redundant: with the `finally` in place, keeping them means two identical UPDATEs per abort (checkpoint write + `finally` write — unless we added `"aborted"` tracking just to suppress the second, which is more code for less clarity). Single authority in the `finally` wins: every status write goes through one line, double-writes are structurally impossible, and the diff at each checkpoint is a one-line deletion. Defense-in-depth is not lost — the SQL `ne(status,'completed')` guard remains the backstop for ordering surprises.
- **No route changes.** Both consumers already do the right thing; the only observable difference is that their `for await` `break` now awaits one swallowed DB write before completing (§1, fact 2) — microseconds-to-milliseconds on a request whose socket is already gone. Verified nothing else iterates `streamTta` (only `apps/api/src/routes/ai.ts:543` and `apps/oss-ai-server/src/api/ai.ts:186`).
- **Scope: status-accounting correctness only.** The rate-limit refund policy on abort is S2's (separate proposal, separate file — §7), the `turn_order`/`message_order` race is S4's, M9/M10/M11 stay out.

## 4. Implementation steps

All edits in `excalidraw-plus/libs/server/tta/src/lib/tta.ts`, inside `streamTta`. Match by snippet — line numbers drift.

### Step 1 — generalize the helper, add the status tracker

Find (directly below the `messageId` declaration, ~`tta.ts:2010-2030`):

```ts
  let didPersistAttempt = false;
  let accumulated = "";
  const markAttemptAborted = async () => {
    if (!didPersistAttempt) {
      return;
    }

    try {
      await store.markGenerationAttemptStatus({
        messageId,
        status: "aborted",
      });
    } catch (error) {
      console.error("[TTA] Failed to mark generation attempt as aborted", {
        chatId: chat.id,
        turnId,
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
```

Replace with:

```ts
  let didPersistAttempt = false;
  let accumulated = "";
  /**
   * Terminal status of this attempt, written by the `finally` below.
   * `"completed"` / `"failed"` are assigned at the sites that decide them;
   * `null` means the generator exited without an explicit decision — an
   * abort-checkpoint `return`, or consumer teardown: when the route breaks
   * out of its `for await`, `.return()` is injected at the suspended `yield`
   * and only `finally` blocks run (`catch` does not). Both mean the consumer
   * stopped pulling, i.e. abort semantics — `null` maps to `"aborted"`.
   */
  let finalStatus: "completed" | "failed" | null = null;
  const finalizeAttemptStatus = async (status: "failed" | "aborted") => {
    if (!didPersistAttempt) {
      return;
    }

    try {
      await store.markGenerationAttemptStatus({
        messageId,
        status,
      });
    } catch (error) {
      // Swallow: a throw here would propagate out of the `finally` into the
      // consumer's `for await` cleanup and mask the actual outcome.
      console.error("[TTA] Failed to finalize generation attempt status", {
        chatId: chat.id,
        turnId,
        messageId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
```

(The narrowed `"failed" | "aborted"` parameter is deliberate — the store type allows `Exclude<TtaChatTurnMessageStatus, "completed">`, which includes `"pending"`; nothing should ever write `pending` back.)

### Step 2 — pre-loop + loop-top checkpoints: drop the writes

Find (the `started` yield through the loop head, ~`tta.ts:2087-2105` — one contiguous block):

```ts
    yield {
      type: "started",
      lifecycleStatus: "pending",
      chatId: chat.id,
      turnId,
      messageId,
      updatedAt: chat.updatedAt,
    };

    if (signal?.aborted) {
      await markAttemptAborted();
      return;
    }

    for await (const chunk of eagerStream.iterable) {
      if (signal?.aborted) {
        await markAttemptAborted();
        return;
      }
```

Replace with:

```ts
    yield {
      type: "started",
      lifecycleStatus: "pending",
      chatId: chat.id,
      turnId,
      messageId,
      updatedAt: chat.updatedAt,
    };

    // NOTE: abort checkpoints below are work-avoidance guards only (stop
    // consuming the provider, skip parsing/fix rounds/persistence for a gone
    // client). The status write happens once, in the `finally`.
    if (signal?.aborted) {
      return;
    }

    for await (const chunk of eagerStream.iterable) {
      if (signal?.aborted) {
        return;
      }
```

### Step 3 — provider `error` chunk: decide `failed` before yielding

Find (inside the `switch`, ~`tta.ts:2197-2212`):

```ts
        case "error": {
          const streamError = new TtaServiceError(
            chunk.error.message,
            TTA.ERRORS.SERVER_ERROR.code,
          );
          await saveParseErrorSafely({
            store,
            chat,
            turnId,
            messageId,
            error: streamError.message,
            generationText: accumulated || null,
          });
          yield createStreamError(streamError);
          return;
        }
```

Replace with:

```ts
        case "error": {
          const streamError = new TtaServiceError(
            chunk.error.message,
            TTA.ERRORS.SERVER_ERROR.code,
          );
          await saveParseErrorSafely({
            store,
            chat,
            turnId,
            messageId,
            error: streamError.message,
            generationText: accumulated || null,
          });
          // Set before the yield: if the consumer tears us down at this very
          // yield, the `finally` must record the provider failure, not an
          // abort. (Also re-asserts `failed` if saveParseErrorSafely's own
          // write failed and was swallowed.)
          finalStatus = "failed";
          yield createStreamError(streamError);
          return;
        }
```

### Step 4 — post-loop checkpoint: drop the write

Find (~`tta.ts:2223-2228`; the `let parsed` line disambiguates it from the identical-looking checkpoints):

```ts
    if (signal?.aborted) {
      await markAttemptAborted();
      return;
    }

    let parsed: ParsedExmlResult | null = null;
```

Replace with:

```ts
    if (signal?.aborted) {
      return;
    }

    let parsed: ParsedExmlResult | null = null;
```

### Step 5 — post-parse checkpoint: drop the write

Find (~`tta.ts:2251-2256`; anchored by `if (!parsed)`):

```ts
    if (signal?.aborted) {
      await markAttemptAborted();
      return;
    }

    if (!parsed) {
```

Replace with:

```ts
    if (signal?.aborted) {
      return;
    }

    if (!parsed) {
```

(The `!parsed` throw right below needs no `finalStatus` assignment — nothing yields between `saveParseErrorSafely` and the `throw`, so it reaches the outer catch, which sets `failed` in step 6.)

### Step 6 — mark `completed`, rewrite the catch, add the `finally`

Find (~`tta.ts:2274-2290`):

```ts
    await store.saveGeneration({
      chat,
      owner,
      generation: {
        response: parsed.normalized,
        responseSchemaVersion: CURRENT_TTA_RESPONSE_VERSION,
        model: aiConfig.model,
        webSearchEnabled,
        webSearchUsed,
        webSearchSources,
        turnId,
        messageId,
        usage,
      },
    });

    yield {
```

Replace with:

```ts
    await store.saveGeneration({
      chat,
      owner,
      generation: {
        response: parsed.normalized,
        responseSchemaVersion: CURRENT_TTA_RESPONSE_VERSION,
        model: aiConfig.model,
        webSearchEnabled,
        webSearchUsed,
        webSearchSources,
        turnId,
        messageId,
        usage,
      },
    });
    // The DB row says `completed` now (saveGeneration). Must be set BEFORE
    // the `done` yield: teardown at that yield would otherwise hit the
    // `finally`'s abort default (a SQL no-op thanks to the ne-completed
    // guard, but skipping avoids a pointless write per successful run).
    finalStatus = "completed";

    yield {
```

Then find the end of the function (~`tta.ts:2300-2308` — the final two `}` close the catch and `streamTta` itself):

```ts
  } catch (error) {
    if (signal?.aborted) {
      await markAttemptAborted();
      return;
    }

    yield createStreamError(error);
  }
}
```

Replace with:

```ts
  } catch (error) {
    if (signal?.aborted) {
      // Abort won the race (e.g. the chained AbortController made the
      // provider stream throw). Leave finalStatus null — the finally
      // records "aborted". Deliberately NOT "failed": matches the existing
      // intent in parseFinalGeneration/parseExmlWithFix, which rethrow on
      // abort without persisting a parse failure.
      return;
    }

    finalStatus = "failed";
    yield createStreamError(error);
  } finally {
    // Single authority for non-completed terminal statuses. Reached on every
    // exit, including consumer teardown (`.return()` injected at a suspended
    // `yield` — only `finally` runs; verified, see proposal §1). The await
    // is honored: the consumer's `for await` cleanup waits for it, and
    // finalizeAttemptStatus never throws.
    if (finalStatus !== "completed") {
      await finalizeAttemptStatus(finalStatus ?? "aborted");
    }
  }
```

⚠️ Two footguns for whoever implements:

1. **Do not move `finalStatus = "completed"` after the `done` yield** — that re-opens a (cosmetic) hole where teardown at the `done` yield fires a redundant `aborted` write that only the SQL guard neutralizes.
2. **Any future early `return` after the attempt persist inherits abort semantics.** If someone adds a non-abort early exit (e.g. an empty-prompt bail), it must set `finalStatus = "failed"` explicitly first. The doc-comment on `finalStatus` (step 1) says so; keep it.

## 5. Invariants to preserve (regression watch-list)

- **Exactly one status UPDATE per non-completed attempt; zero per completed attempt.** The five old call sites are gone; the `finally` is the only writer. (Pinned by tests §8 cases 2 and 4.)
- **The `finally` never throws and never yields.** `finalizeAttemptStatus` swallows; the block contains nothing else. A throw would escape through the consumer's `break` (§1, fact 4) and, in the Plus route, wrongly trigger the catch-side rate-limit rollback.
- **The error chunk still reaches the client on generic failures.** `finalStatus = "failed"` is set *before* `yield createStreamError(error)`, and the `finally` runs *after* the yield is consumed — order: client gets the error, then the row is finalized. (If the consumer is already gone, the yield terminates via `.return()` and the `finally` still writes `failed`.)
- **`didPersistAttempt` gating intact**: pre-attempt failures (context load throws before the `try`; `saveGenerationAttempt` transaction rollback at `tta.ts:2082-2085`, which also cancels the eager stream) produce no status write.
- **Provider cancellation untouched**: teardown inside the stream loop still cascades into `createEagerAsyncIterable`'s `finally { cancel(); }` *before* our `finally` runs (§1, fact 5); the signal-chained `AbortController` covers every disconnect flavor besides.
- **`markGenerationAttemptStatus` semantics unchanged** (`tta.ts:1348-1359`): plain UPDATE guarded by `ne(status, 'completed')` — still the backstop if a write ever races `saveGeneration`.
- **Chunk sequences on the wire are byte-identical on every path** — no new chunk types, no reordering (matters for S2, §7).

## 6. Edge-case walkthrough (teardown-point inventory)

Every `yield` in `streamTta` is a potential `.return()` injection point; what the `finally` records at each:

- **`yield started`** (~2087) — attempt was persisted just before → `aborted` ✓. One wrinkle: this is the only teardown point *before* the `for await` over `eagerStream.iterable` begins, so the cascade-cancel (§1, fact 5) doesn't fire — but in practice both routes only `break` after the signal aborted, and the signal is chained into the provider's `AbortController` at creation (`tta.ts:2036, 2052-2064`), so the provider request is cancelled anyway. A pure `.return()` with no abort has no production caller; noted in §10.
- **`yield partial`** (both the additive path ~2160 and the plain path ~2181) — the common mid-stream teardown → `aborted` ✓, provider cancelled via cascade ✓.
- **`yield event.chunk`** inside the `parseFinalGeneration` loop (~2244; fix-round status `message`s and fix partials) — teardown during the repair ladder → `aborted`, overwriting the provisional `failed` from `tta.ts:1706` per §3's "abort wins during error handling" decision ✓.
- **`yield createStreamError(streamError)`** in the provider-error case (~2210) — `finalStatus` already `"failed"` → `failed` ✓ (genuine error preserved even on a racing disconnect).
- **`yield done`** (~2290) — `finalStatus` already `"completed"` → no write ✓.
- **`yield createStreamError(error)`** in the catch — `"failed"` already set → `failed` ✓.

Non-teardown edges:

- **Abort during `saveGeneration`/parse awaits** (no yield in between): the generator keeps running to its next checkpoint or throw — `.return()` can't interrupt an `await`, it queues until the next suspension. Ends `aborted` via checkpoint or catch-abort-branch ✓.
- **Abort in the millisecond window between the post-parse checkpoint (step 5) and the catch's `signal?.aborted` test, after `!parsed`'s `saveParseErrorSafely` wrote `failed`**: row ends `aborted` instead of `failed`. Accepted — both non-completed, the `tta_errors` row keeps the diagnostics, and it matches §3's precedence rule.
- **`saveGenerationAttempt` itself fails**: transaction rolls back → no row → catch sets `failed` → `finally` calls `finalizeAttemptStatus` → `didPersistAttempt` is false → no-op ✓. The error chunk still reaches the client.
- **The status write itself fails in the `finally`**: logged (`[TTA] Failed to finalize generation attempt status`), swallowed; the row stays `pending` — irreducible without retry infrastructure (a DB that just failed a one-column UPDATE will likely fail a retry too); see §10.
- **Process kill (SIGKILL/OOM)**: no `finally` can run; row stays `pending`. Out of scope for in-process fixes — startup sweep / TTL in §10.

## 7. Ordering / compatibility

- **[tta_c2.md](tta_c2.md)** (client: interrupted streams become errors, not fake successes) — its §9 explicitly lists S1 as the server-side half: after both land, a mid-stream disconnect yields a client-side `STREAM_INTERRUPTED` error *and* a server-side `aborted` row (the server can't distinguish Stop from a cut socket — both arrive as socket close → `signal.aborted`; `aborted` is the honest record for either). A subsequent error-retry reuses the same turn (`retryAssistantMessageId`), inserting a new message row — `loadGenerationContext` keys context off `current_message_id`, which only `saveGeneration` sets, so a leftover `aborted`/`failed` row never pollutes context loading. Landing order: any.
- **tta_s2.md** (in progress, parallel): changes the Plus route's rate-limit rollback conditions by inspecting chunk types inside the route loop (`apps/api/src/routes/ai.ts:554-580`). Disjoint files — S1 touches only `tta.ts` and changes no chunk sequence on any path, so whatever chunk-type accounting S2 adds sees identical streams before/after S1. One behavioral note for S2's author: after S1, the route's `break` (and loop completion) awaits the generator's `finally` DB write before the rollback lines execute — do not assume `break` is instantaneous, and a throw *from the loop itself* still only happens for pre-stream failures (the generator's `finally` cannot throw, §5). Landing order: any.
- **S4** (order race in `saveGenerationAttempt`) — same function family, zero overlapping lines; independent.

## 8. Tests

### 8a. Test infrastructure (reality check)

`libs/server/tta` tests run on **Jest, not vitest**: nx target `test` (custom `tooling:test` executor, which injects fake envs for libs and delegates to `_test` = `@nx/jest:jest` with `libs/server/tta/jest.config.ts` — ts-jest, `testEnvironment: "node"`, `diagnostics: false`). Existing tests (`exmlParserV1.test.ts`, `exmlAdditiveMerge.test.ts`, `elementIdRemap.test.ts`) are pure-function tests with no mocking — but they prove the heavy parts of the import graph (skia-canvas text metrics, `@excalidraw/element` via `moduleNameMapper`) already work under this Jest setup.

```bash
cd ~/dev/excalidraw-plus
npx nx test server-tta            # full lib (via the env-wrapping executor)
npx nx run server-tta:_test       # direct jest, no env wrapper
```

### 8b. Unit test: `libs/server/tta/src/lib/tta.test.ts` (new file, colocated)

A real unit test of `streamTta` is pragmatic here — better than a standalone generator-semantics pin — because the two hard dependencies are cheap to neutralize and everything else is injectable or pure:

- **`store` is a parameter** (`TtaChatStore` — not exported, but structural typing or `Parameters<typeof streamTta>[0]["store"]` covers it). An in-memory fake records `markGenerationAttemptStatus` calls; `loadGenerationContext` returns a fresh unpersisted chat; `saveGenerationAttempt` is a no-op; `saveGeneration` resolves or rejects per case.
- **`jest.mock("@tanstack/ai", …)`** — `tta.ts` does `import { chat as generateChat } from "@tanstack/ai"` (top-level static import; the other two imports from it are type-only and erased), so a factory `{ chat: jest.fn() }` fully controls the provider stream. Each case scripts an async generator of TanStack chunks.
- **`jest.mock("@server/openai", …)`** — `tta.ts` uses `getTextAdapter`, `getProviderFromModel`, `getServerApiKey`, `getThinkingModelOptions` (all call-time only; with a non-Gemini model `getThinkingModelOptions` is never reached). Stubbing the module also keeps Jest from loading the real `@server/openai` graph (OpenAI SDK, `workspaceAiTokens`, …).
- **The EXML parser runs real** — feed the canonical minimal sample from `exmlParserV1.test.ts`: `<S v="1.0" layout="rel" w="hug" h="hug"><R w="100" h="50" /></S>` (no text element, so text metrics aren't exercised; still call `initServerTextMetrics()` in setup like the parser test does, so future EXML additions are safe).

Harness sketch:

```ts
jest.mock("@tanstack/ai", () => ({ chat: jest.fn() }));
jest.mock("@server/openai", () => ({
  getProviderFromModel: () => "anthropic",
  getServerApiKey: () => "test-key",
  getTextAdapter: () => ({}),
  getThinkingModelOptions: () => undefined,
}));

import { chat } from "@tanstack/ai";
import { AI_MODEL } from "@global/constants";
import { streamTta } from "./tta";
import { initServerTextMetrics } from "../textMetrics/serverTextMetrics";

initServerTextMetrics();

const EXML = `<S v="1.0" layout="rel" w="hug" h="hug"><R w="100" h="50" /></S>`;
const generateChatMock = chat as jest.Mock;

const createFakeStore = (overrides: Partial<Record<string, unknown>> = {}) => {
  const statusWrites: Array<{ messageId: string; status: string }> = [];
  const chatCtx = {
    id: "chat-1", createdAt: Date.now(), updatedAt: Date.now(),
    seed: 1, turns: [], persisted: false,
  };
  const store = {
    loadGenerationContext: async () => ({ chat: chatCtx, targetTurn: undefined }),
    saveGenerationAttempt: async () => {},
    saveGeneration: async () => {},
    saveParseError: async () => {},
    markGenerationAttemptStatus: async (args: { messageId: string; status: string }) => {
      statusWrites.push(args);
    },
    truncateConversation: async () => { throw new Error("unused"); },
    ...overrides,
  };
  return { store, statusWrites };
};

const aiConfig = {
  model: AI_MODEL.claude_4_6_sonnet, provider: "anthropic",
  apiKey: "test-key", isWorkspaceKey: false,
} as never; // AiConfig's type comes from the mocked module; diagnostics are off in jest.config
```

(An Anthropic model is deliberate: non-Gemini so `buildModelOptions` returns `undefined` without calling `getThinkingModelOptions`, and non-OpenAI/Gemini so `buildGenerationTools` returns no web-search tools.)

Cases:

1. **"marks the attempt `aborted` when the consumer stops pulling mid-stream (`.return()` teardown)"** — the S1 headline. Provider mock: `async function* () { yield { type: "content", delta: EXML }; await new Promise(() => {}); }` (the pending promise mimics an in-flight provider; it's never reached — the eager read pulls exactly once and teardown closes the suspended generator). Drive with `for await`, `break` on the first `partial` — exactly what the routes do — **passing no `signal` at all**, which pins that pure teardown (not a checkpoint) produces the write:

   ```ts
   const { store, statusWrites } = createFakeStore();
   generateChatMock.mockReturnValue(provider());
   const chunks: Array<{ type: string }> = [];
   for await (const chunk of streamTta({ store, aiConfig, owner: null, payload: { prompt: "draw" } } as never)) {
     chunks.push(chunk);
     if (chunk.type === "partial") { break; }
   }
   expect(chunks.map((c) => c.type)).toEqual(["started", "partial"]);
   expect(statusWrites).toEqual([{ messageId: expect.any(String), status: "aborted" }]);
   ```

2. **"marks the attempt `aborted` exactly once when the abort lands between pulls (checkpoint flavor)"** — provider yields the EXML delta, then a second `content` chunk. Pass `signal: controller.signal`; on receiving the first `partial`, call `controller.abort()` but **don't break** — keep iterating. The loop-top checkpoint returns, the `finally` writes. Assert the stream ends without a `done` chunk and `statusWrites` has length **1** (pins no-double-write after removing the scattered calls).
3. **"marks the attempt `failed` when a post-attempt store write fails"** — provider yields the full EXML + a `{ type: "done", finishReason: "stop", usage: {...} }` chunk, then ends; `saveGeneration: async () => { throw new Error("db down"); }`. Iterate to completion: last chunk is `{ type: "error", lifecycleStatus: "failed" }`, and `statusWrites` equals `[{ messageId: expect.any(String), status: "failed" }]`.
4. **"completed run performs no status write"** — same as 3 with `saveGeneration` resolving: chunks end with `type: "done"`, `statusWrites` is `[]`.
5. *(cheap extra)* **"provider error chunk → `failed`"** — provider yields `{ type: "error", error: { message: "boom" } }`; assert `saveParseError` was called once and `statusWrites` ends `[{ …, status: "failed" }]` (not `aborted`), pinning the §3 precedence rule at the error-chunk yield.

Honest caveat: importing `tta.ts` compiles its full remaining graph under ts-jest (drizzle-orm, `@global/types`, `@global/constants`, the parser). All of these are plain node-compatible modules and the parser tests already exercise the worst of it; if an unexpected module-load landmine surfaces anyway, extend the `jest.mock` list rather than abandoning the test — the two mocks above are the only *behaviorally* necessary ones. If even that proves disproportionate in practice, the fallback is a 20-line generator-semantics contract test (the §1 facts) plus manual QA — but the expectation is the real test works.

### 8c. Manual QA (dev oss-ai-server, `localhost:3016`)

Same code path as Plus (`streamTta` is shared; only the store adapter and route shell differ), so OSS QA covers the fix. DB inspection: the reviewer couldn't access the DB URI previously, so the SQL below is for you to run — `psql "$OSS_DATABASE_URI"` (the env var `apps/oss-ai-server/src/lib/ossDb.ts` reads).

1. **Kill mid-stream (the S1 repro)**:

   ```bash
   curl -sN -X POST http://localhost:3016/ai/tta/generate/stream \
     -H 'Content-Type: application/json' \
     --data '{"prompt":"a house with a tree, a sun, and a fence"}' | head -c 800
   ```

   `head -c 800` closes the pipe after the first partial frames → curl exits → socket close → `signal.aborted` → route `break` → `.return()` teardown. (Interactive Ctrl+C after a couple of frames works too.) Server log should show `SSEStream socket.close - client disconnected mid-stream`.

2. **Inspect the rows**:

   ```sql
   SELECT message_id, status, created_at
   FROM tta_chat_turn_messages
   ORDER BY created_at DESC
   LIMIT 10;
   ```

   Outcome key: `pending` on the just-killed row = **bug still present** (or a generation still genuinely in flight — wait for the provider stream to finish before judging); `aborted` = fix working for stop/disconnect; `completed` = full run; `failed` = error path.

3. **Generic-failure flavor** (temp hack, do not commit): add `throw new Error("S1 QA");` as the first line of `saveGeneration`'s transaction callback in `tta.ts` (or just before the `await store.saveGeneration(...)` call in `streamTta`). Run a full generation: the client gets the error chunk (red bubble + Retry), and the row reads `failed` — not `pending`.

4. **Regressions**: a full uninterrupted run → `completed`, and watch the server logs for the absence of `[TTA] Failed to finalize…`; Stop from the excalidraw.com dev UI mid-stream → `aborted`; retry after an aborted/failed attempt → new message row on the same turn (`message_order` 2), old row's status untouched.

5. **Pre-fix debris check** (informational): `SELECT count(*) FROM tta_chat_turn_messages WHERE status = 'pending' AND created_at < now() - interval '1 hour';` — rows counted here predate the fix (or are §6's process-kill residue); backfill is a follow-up, not part of this change.

## 9. Acceptance criteria

- [ ] Consumer `break`/`.return()` at any suspended `yield` after the attempt persist ends the row `aborted` — including the no-signal pure-teardown flavor (§8b case 1) and the checkpoint flavor (§8b case 2). No code path leaves a row `pending` after the generator settles.
- [ ] A generic throw after the attempt persist (e.g. `saveGeneration` failure) still yields the `error` chunk to the client **and** ends the row `failed` (§8b case 3).
- [ ] Completed runs make **zero** `markGenerationAttemptStatus` calls; non-completed runs make **exactly one** (§8b cases 2 and 4).
- [ ] Parse-failure paths still end `failed`; abort during error handling/fix round still ends `aborted` (existing precedence preserved, §3).
- [ ] The `finally` contains only the guarded, swallowing status write — no `yield`, no throw can escape it; a failed write is `console.error`-logged with `status` included.
- [ ] No changes to `apps/api/src/routes/ai.ts`, `apps/oss-ai-server/src/api/ai.ts`, `streaming.ts`, schemas, or any client file; chunk sequences on the wire are unchanged on every path.
- [ ] `npx nx test server-tta` green (new + existing); manual QA §8c shows `aborted` for the curl-kill repro.

## 10. Follow-ups (do not bundle)

- **Backfill + sweep for `pending` debris.** Rows stuck from before the fix, plus the irreducible process-kill/finally-write-failure residue (§6), want a one-off `UPDATE tta_chat_turn_messages SET status = 'aborted' WHERE status = 'pending' AND created_at < now() - interval '1 hour';` and optionally a periodic/startup sweep. Coordinate with M14 (data retention) in [tta.md](tta.md).
- **S2 — rate-limit refund policy on abort** (`apps/api/src/routes/ai.ts:563-580`): separate proposal in progress; S1 deliberately doesn't touch refunds.
- **S4 — `turn_order`/`message_order` race**: unique indexes exist (`tta_chat_turn_messages_turn_message_order_idx`, `tta_chat_turns_chat_turn_order_idx` in `libs/server/db-schemas/src/lib/oss.ts` and plus) but there's no retry-on-conflict; separate fix.
- **Hoist `eagerStream` for belt-and-braces cancellation in the `finally`.** The one teardown point outside the stream loop (`yield started`, §6) relies on the signal chain for provider cancellation; declaring `eagerStream` before the `try` and calling `eagerStream.cancel()` in the `finally` would make cancellation unconditional. Not needed by any current caller — both routes always abort the signal before breaking — and it widens the diff, so deferred.
- **Fix-round attempts have no status row of their own** — `requestTtaFix` usage/aborts fold into the parent message (relates to M11's dropped fix-pass usage); fine today, worth revisiting if "resume incomplete generation" lands.
- **`markGenerationAttemptStatus` could `.returning()` the previous status** for observability (how often does `finally` overwrite a provisional `failed`?) — telemetry nicety, not correctness.
