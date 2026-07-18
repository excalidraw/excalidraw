# S2 implementation proposal — Stop must not refund a generation the user already received

Fixes finding **S2** from [tta.md](tta.md): *stop/abort refunds the rate limit unconditionally → cost-amplification loophole*.

Companion to [tta_c1.md](tta_c1.md)–[tta_c4.md](tta_c4.md) (same conventions: match code anchors by snippet, not line number; implementable without re-deriving the analysis). This one is **server-only, in the `excalidraw-plus` repo**: one route handler in `apps/api/src/routes/ai.ts` plus one new pure module (and its test) in `apps/api/src/lib/`. **No `libs/server/tta/**` changes** — `tta.ts` is S1's file; the two proposals are disjoint by construction (see §3). No client changes, no OSS-server changes.

---

## 1. The bug

The Plus TTA stream route (`apps/api/src/routes/ai.ts`, `POST /ai/w/:workspace/tta/generate/stream`) charges one rate-limit credit up front, then refunds it whenever the stream ended in an error **or an abort**:

```ts
      let shouldRollback = false;
      if (!aiConfig.isWorkspaceKey) {
        try {
          await rateLimiting.check({ ... });
          shouldRollback = true;
        } catch (error) {
          throw this.httpErrors.tooManyRequests(error.message);
        }
      }
```

```ts
        for await (const chunk of generator) {
          if (stream.signal.aborted) {
            break;
          }
          if (chunk.type === "error") {
            hasError = true;
          }
          stream.write(chunk);
        }

        if ((hasError || stream.signal.aborted) && shouldRollback) {
          rateLimiting.rollback({ ... });
        }

        stream.end();
      } catch (error: any) {
        if (shouldRollback) {
          rateLimiting.rollback({ ... });
        }
        ...
```

`stream.signal` aborts exactly when the client socket closes before the stream ended (`StreamingResponse.onSocketClose`, `libs/server/fastifyutils/src/lib/streaming.ts`) — i.e. on the **user pressing Stop** (the client aborts its `fetch`) as much as on a network failure. So the loophole is:

1. Send a prompt. One credit is charged (`textToDiagram` budget, see §1b).
2. Watch the canvas preview stream in (each `partial` chunk is a full skeleton snapshot — the user has the drawing on screen the whole time).
3. Hit **Stop** at ~95%: client aborts → socket closes → `stream.signal.aborted` → loop breaks → **full refund**.
4. Repeat. Each round consumes a real provider generation (up to `MAX_TTA_TOKENS = 8192` output tokens, plus thinking tokens, plus a possible LLM-fix round — `tta.ts`) at **zero quota cost**. The 100/day budget never depletes; provider spend is bounded only by how fast the user can click.

**The adjacent edge — a delivered generation can be free.** `streamTta` persists the completed generation (`store.saveGeneration`, `tta.ts:2274-2288`) *before* yielding the `done` chunk. After the route writes `done`, the loop still resumes the generator once more to observe its end; if the abort lands in that window (user stops at the last instant, or the client tears the connection down right after `done`), the post-loop check sees `stream.signal.aborted === true` and refunds — for a generation that was **fully delivered to the client and persisted in the DB** (it will even be loaded as context for the next turn). Same outcome if the abort lands between the loop exiting and the rollback check running.

### 1a. What `rateLimiting.rollback` actually does (verified)

`libs/server/rate-limiting/src/lib/rate-limiting.ts`. The counter store is **Firestore**: `users/{userId}` doc, field `rateLimits.{key}.{workspaceId}` (the `textToDiagram` key is `isWorkspaceSpecific: true`), value `{ count, firstUsed, lastUsed }`.

- `check()` reads the user + workspace docs, computes `nextCount = count + 1` (or `0` on a fresh window), sets the `X-Ratelimit-*` headers, throws *before persisting* when over limit, and otherwise **eagerly persists the incremented count with a fire-and-forget `userRef.update()`** (failure → Slack alert, request proceeds).
- `rollback()` is a **fire-and-forget Firestore transaction**: re-read the doc, and `if (count > 0)` write `count - 1`.

Two properties matter here:

1. **Rollback is floored at zero but NOT idempotent per request.** Every call decrements the live counter by one. Two rollbacks for one request refund two credits — the second one effectively refunds *some other request's* charge. The zero-floor only saves the degenerate case where the counter is already empty.
2. **Can both rollback sites fire for one request today?** The post-loop rollback runs, then `stream.end()`; if `end()` threw, the catch would fire the second rollback. `StreamingResponse.end()` is well guarded (sets `streamEnded` first, `try/finally`, and `Readable.push` does not throw in these states), so the double-fire is **practically unreachable today — but structurally open**: nothing encodes "at most once", and any future statement added between the post-loop rollback and the end of the `try` would arm it. The fix latches it shut (§4 step 3).

One more service-level quirk, noted for completeness (pre-existing, not worsened or fixed here): because `check()`'s charge persist is fire-and-forget, a rollback racing a *very* fast failure can read the pre-charge count and lose the refund when the charge write lands afterwards. The race favors the house and needs sub-second streams; out of scope.

### 1b. The shared budget

```ts
const AI_GEN_COMMON_RATE_LIMIT_KEY = "textToDiagram" as const;
```

(`apps/api/src/routes/ai.ts`). `RATE_LIMITS.textToDiagram` (`libs/global/constants/src/lib/rate-limit-constants.ts`) = **100/day, trial 100/day, per user per workspace** (staff e-mails get 1000). Three Plus routes draw from this one budget:

| Route | check | rollback policy today |
|---|---|---|
| `POST …/text-to-diagram/generate` | ✓ | refund on any throw |
| `POST …/text-to-diagram/chat-streaming` | ✓ | **refund on error *or abort*** — the same unconditional pattern, same loophole |
| `POST …/tta/generate/stream` | ✓ | **refund on error *or abort*** — this proposal |

(`diagramToCode` and `nameScene` are separate keys/budgets.) ⚠️ So S2 is not fully closed by this change alone — the mermaid `chat-streaming` route refunds aborts against the *same key*; porting the policy there is a follow-up (§9), kept out of scope because its chunk protocol differs (`AI.StreamMessage` content deltas, not skeleton partials).

BYOK workspaces (`aiConfig.isWorkspaceKey`) skip `check` entirely (`shouldRollback` stays `false`) — they pay provider costs on their own key, no amplification against us; unchanged throughout.

**Honesty note on accounting.** Provider cost starts *before* the first `partial` ever reaches the route — Gemini/GPT thinking tokens, and the prompt itself, are spent during a phase where the user has seen nothing. Perfect cost accounting is impossible at the route (token usage only arrives in the `done` chunk, `tta.ts:2191-2194` — too late for aborts by definition). The policy below does not try; it removes the **amplification incentive** — repeated near-complete generations at zero quota — while still refunding aborts where the user demonstrably received nothing.

## 2. Desired behavior

| Scenario | Today | After fix |
|---|---|---|
| Stream completes (`done` written) | charge stands | unchanged |
| Genuine server failure (`error` chunk, before or after partials) | refund | unchanged — refund |
| Handler throws (e.g. `loadGenerationContext` DB failure before anything streamed) | refund | unchanged — refund |
| Abort before any output (during thinking phase / before `started`) | refund | unchanged — refund (user got nothing) |
| Abort after only *empty* partials (`skeletons: []`) | refund | unchanged — refund (nothing rendered on canvas) |
| **Abort after a non-empty `partial` (the exploit)** | refund | **charge stands** |
| **Abort landing after `done` was received (delivered + persisted)** | refund | **charge stands** |
| `error` chunk written, then user aborts before loop exit | refund | unchanged — refund (server failed first) |
| Double rollback (post-loop + catch for one request) | structurally possible | structurally impossible (settle-once latch) |
| BYOK / 429 / OSS route / client UX / wire protocol | — | byte-for-byte unchanged |

## 3. Design decisions (so nobody re-litigates them mid-implementation)

- **The policy.** (a) genuine errors → always refund; (b) abort → refund only if no meaningful output was streamed; (c) `done` observed → never refund, full stop. (c) outranks everything because `done` is the route's proxy for "saveGeneration committed" — the user keeps the value server-side whatever happens to the socket afterwards. (a) outranks (b): an `error` chunk means `done` never came and no completed generation was persisted (`streamTta`'s only post-`saveGeneration` step *is* yielding `done`), so even a user who watched partials got nothing usable — refund, also when they aborted after the error.
- **"Meaningful output" = the first `partial` chunk with `skeletons.length > 0` received in the route loop.** Cheap (the loop already switches on `chunk.type` for `hasError`), observable without touching `tta.ts`, and it matches user-visible value exactly: the client renders those skeletons on the canvas as they stream, so this is the moment the user starts *receiving* the generation. Empty-skeleton partials don't count — `parsePartialExmlV1` can legitimately emit `elements: []` early (opening tag parsed, no complete child yet), and the user sees nothing for them. Rejected alternatives:
  - *token-count threshold* — usage data arrives only in the `done` chunk; unavailable for every abort case by definition;
  - *wall-clock / chunk-count threshold* — arbitrary constants; a thinking-heavy prompt crosses any time threshold having delivered zero user value (refund would be wrongly denied), and chunk cadence varies 28–144 ms in live captures (tta.md §5);
  - *the `started` chunk* — fires right after the attempt row persists, before any provider content reaches the user; counting it would deny refunds for aborts during the silent thinking phase, where a refund is clearly owed;
  - *`partial` with `isComplete: true` only* — too strict; the user has the drawing on screen long before the final partial.
- **`hasCompleted` is set on `done`-chunk *receipt*, not on write delivery.** By the time `streamTta` yields `done`, `saveGeneration` has already committed. `stream.write()` silently no-ops if the abort won the race (`StreamingResponse.write` checks `signal.aborted`), but the charge must stand either way — the generation exists in the user's chat context. (The mirror-image residual — abort landing *before* the route receives `done` but *after* `saveGeneration`, in a generation that streamed zero non-empty partials — still refunds; see §6 "residual races".)
- **Settle exactly once (the latch).** Because `rollback` is a non-idempotent counter decrement (§1a), the fix funnels both rollback sites through one `settleRateLimitCharge()` helper guarded by a `rateLimitSettled` flag. This makes double-refund *structurally* impossible instead of relying on `stream.end()` never throwing. `shouldRollback` keeps its current meaning ("a refundable charge exists" — system key, check passed) and is no longer consulted at two independent sites.
- **The decision is a pure function in `apps/api/src/lib/aiStreamRateLimitPolicy.ts`.** Not inline in the route: `routes/ai.ts` has import-time side effects (`../lib/plusDb` constructs a `Database` from `process.env.PLUS_DATABASE_URI` at module load; `@server/fire`, `@server/openai` likewise), so a unit test importing the route module is a non-starter. A dependency-free module makes the decision table testable with zero mocks (§7) — apps/api currently has **no** tests at all, so this is deliberately the lowest-footprint entry.
- **Route-local; no `tta.ts` changes.** [S1](tta.md) (attempt rows stuck `pending`) is a parallel proposal that touches `libs/server/tta/src/lib/tta.ts` only; S2 touches `apps/api/src/routes/ai.ts` (+ the new lib module) only. Disjoint files, any landing order, no semantic coupling — S1 fixes what the *DB row* says after an abort, S2 fixes what the *quota* says.
- **Catch-path classification.** A throw whose name is `AbortError`, or any throw while `stream.signal.aborted`, follows abort rules; everything else is a genuine failure → refund. (The `AbortError` branch exists today as a defensive inheritance from the chat-streaming route; `streamTta` itself returns cleanly on abort rather than throwing, but `createAbortController`-wrapped adapter throws could surface. Keeping the classification costs nothing.)
- **Unreachable default = keep the charge.** `streamTta` always terminates in `done`, an `error` chunk, or an abort-driven return (verified: its own `catch` converts every internal throw into an `error` chunk unless aborted). A clean loop exit with none of the flags set is therefore unreachable — the helper returns early without refunding, which is also exactly what today's code does for that combination (parity; no new behavior hides there).
- **Telemetry goes to pino (`req.log`), not `req.appLog`.** Checked the idiom: `appLog` rows are buffered in-memory and persisted by the server's `onResponse` hook (`apps/api/src/main.ts`). On a client abort the response is already torn down — `onResponse` (and thus `appLogger.save`) will typically have fired *before* the stream loop even notices the abort (the loop is suspended awaiting the next provider chunk when the socket closes), so an appLog row written at settle time would be **lost precisely for the abort terminals we want to observe**. `req.log.info` (the route family already uses `req.log.error` in text-to-drawing) goes to stdout/log aggregation unconditionally. If DB-queryable abuse analytics are wanted later, that needs an explicit appLog flush model — follow-up, not this change.

## 4. Implementation steps

All anchors are verbatim from the current `dwelle/tta` state of `excalidraw-plus/apps/api/src/routes/ai.ts`.

### Step 1 — new file `apps/api/src/lib/aiStreamRateLimitPolicy.ts`

```ts
/**
 * Refund policy for streamed AI generations charged via `rateLimiting.check`
 * (S2 in the TTA review): decides whether the per-user rate-limit charge of a
 * terminated stream should be rolled back.
 *
 * Dependency-free on purpose — the route module (`routes/ai.ts`) opens DB
 * connections at import time, so the decision lives here, where the full
 * table is unit-testable without mocks.
 */
export const shouldRollbackRateLimit = ({
  hasError,
  aborted,
  hasMeaningfulOutput,
  hasCompleted,
}: {
  /** an `error` chunk was streamed, or the handler threw a non-abort error */
  hasError: boolean;
  /** the client aborted / disconnected (Stop button, network cut) */
  aborted: boolean;
  /** at least one `partial` chunk with non-empty `skeletons` was streamed */
  hasMeaningfulOutput: boolean;
  /** a `done` chunk was received — the generation is persisted server-side */
  hasCompleted: boolean;
}): boolean => {
  if (hasCompleted) {
    // delivered & persisted — the charge stands even if the client aborts
    // during stream teardown (previously a refunded, i.e. free, generation)
    return false;
  }
  if (hasError) {
    // the server failed the user: `done` never came, no completed generation
    // was persisted, partials alone are not usable — always refund
    return true;
  }
  if (aborted) {
    // user-initiated stop: refund only if they never saw a drawing forming —
    // otherwise streaming ~95% and stopping would cost zero quota, repeatably
    return !hasMeaningfulOutput;
  }
  // clean exit without done/error/abort — unreachable from streamTta's
  // semantics; keep the charge (parity with current behavior)
  return false;
};
```

### Step 2 — `apps/api/src/routes/ai.ts`: import

Find:

```ts
import { plusDb } from "../lib/plusDb";
```

Replace with:

```ts
import { plusDb } from "../lib/plusDb";
import { shouldRollbackRateLimit } from "../lib/aiStreamRateLimitPolicy";
```

### Step 3 — flags + the settle-once helper

In the `POST /ai/w/:workspace/tta/generate/stream` handler, find:

```ts
      const stream = setupStreamingResponse<typeof reply, TTA.StreamChunk>(reply, req);
      let hasError = false;
```

Replace with:

```ts
      const stream = setupStreamingResponse<typeof reply, TTA.StreamChunk>(reply, req);
      let hasError = false;
      let hasMeaningfulOutput = false;
      let hasCompleted = false;
      let rateLimitSettled = false;

      /**
       * Decides the fate of the rate-limit charge exactly once per request
       * (S2 in the TTA review): genuine errors always refund; user aborts
       * refund only when no meaningful output was streamed; a completed
       * (persisted) generation is never refunded. `rateLimiting.rollback`
       * decrements a live Firestore counter and is NOT idempotent — the
       * `rateLimitSettled` latch makes a double refund structurally
       * impossible.
       */
      const settleRateLimitCharge = (terminal: { hasError: boolean; aborted: boolean }) => {
        if (rateLimitSettled || (!terminal.hasError && !terminal.aborted)) {
          // already settled, or normal completion — the charge stands
          return;
        }
        rateLimitSettled = true;

        const refunded =
          shouldRollback &&
          shouldRollbackRateLimit({
            hasError: terminal.hasError,
            aborted: terminal.aborted,
            hasMeaningfulOutput,
            hasCompleted,
          });

        if (refunded) {
          rateLimiting.rollback({
            userId: req.firebaseUser.id,
            workspaceId: workspace,
            key: AI_GEN_COMMON_RATE_LIMIT_KEY,
          });
        }

        // pino rather than req.appLog: appLog rows are persisted by the
        // server's `onResponse` hook, which on client aborts typically fires
        // before this code runs — the row would be lost exactly for the
        // terminals we want to observe (abuse = repeated `refunded: false`,
        // `aborted: true`, `hasMeaningfulOutput: true` per user).
        req.log.info(
          {
            tta: {
              event: "rate-limit-refund",
              refunded,
              charged: shouldRollback,
              hasError: terminal.hasError,
              aborted: terminal.aborted,
              hasMeaningfulOutput,
              hasCompleted,
              userId: req.firebaseUser.id,
              workspaceId: workspace,
            },
          },
          "TTA stream ended abnormally — rate-limit refund decision",
        );
      };
```

### Step 4 — track the new flags in the existing chunk loop

Find:

```ts
        for await (const chunk of generator) {
          if (stream.signal.aborted) {
            break;
          }
          if (chunk.type === "error") {
            hasError = true;
          }
          stream.write(chunk);
        }
```

Replace with:

```ts
        for await (const chunk of generator) {
          if (stream.signal.aborted) {
            break;
          }
          if (chunk.type === "error") {
            hasError = true;
          }
          if (chunk.type === "partial" && chunk.skeletons.length > 0) {
            // the user is watching this drawing form on the canvas — a Stop
            // after this point keeps the charge (S2: no refund for work the
            // user consumed)
            hasMeaningfulOutput = true;
          }
          if (chunk.type === "done") {
            // streamTta persists the generation (saveGeneration) *before*
            // yielding `done` — from here on the charge must stand even if
            // the client aborts during teardown
            hasCompleted = true;
          }
          stream.write(chunk);
        }
```

(`chunk.type === "partial"` narrows to `TTA.PartialChunk`, whose `skeletons` is required — no optional chaining needed. `message` chunks — the LLM-fix status strings — intentionally do *not* count as meaningful output.)

### Step 5 — replace the post-loop rollback

Find:

```ts
        if ((hasError || stream.signal.aborted) && shouldRollback) {
          rateLimiting.rollback({
            userId: req.firebaseUser.id,
            workspaceId: workspace,
            key: AI_GEN_COMMON_RATE_LIMIT_KEY,
          });
        }

        stream.end();
```

Replace with:

```ts
        settleRateLimitCharge({ hasError, aborted: stream.signal.aborted });

        stream.end();
```

### Step 6 — replace the catch-path rollback

Find:

```ts
      } catch (error: any) {
        if (shouldRollback) {
          rateLimiting.rollback({
            userId: req.firebaseUser.id,
            workspaceId: workspace,
            key: AI_GEN_COMMON_RATE_LIMIT_KEY,
          });
        }

        if (error?.name === "AbortError") {
          return stream.end();
        }
```

Replace with:

```ts
      } catch (error: any) {
        // a throw that *is* the abort (AbortError, or anything thrown while
        // the socket is already gone) follows abort rules; everything else is
        // a genuine server failure → refund. If the post-loop settle already
        // ran (hypothetical `stream.end()` throw), the latch makes this a
        // no-op — previously that path could refund twice.
        const aborted = stream.signal.aborted || error?.name === "AbortError";
        settleRateLimitCharge({ hasError: !aborted, aborted });

        if (error?.name === "AbortError") {
          return stream.end();
        }
```

That's the whole change: ~6 lines of flag tracking, one helper, two call sites, one pure module.

## 5. Invariants to preserve (regression watch-list)

- **Wire protocol untouched.** `stream.write`/`stream.end` calls and their ordering are byte-for-byte what they were; only the refund decision changed. The client cannot tell the difference (it never sees rollback).
- **BYOK never charged → never refunded.** `shouldRollback` stays `false` for workspace keys; `settleRateLimitCharge` still logs the terminal (with `charged: false`) but never calls `rollback`.
- **429 path unreachable by the new code.** `rateLimiting.check` throws *before* persisting when over limit; the handler converts it to `tooManyRequests` before the stream (and the helper) exist — no charge, no refund, unchanged.
- **`rollback` called at most once per request**, from exactly one site (`settleRateLimitCharge`), latched by `rateLimitSettled`.
- **Refunds stay fire-and-forget** — `rollback` is non-blocking by design; no latency added to stream teardown.
- **The start-of-request `req.appLog.info({ action: "ai:tta", ... })` entry is untouched** (it runs before streaming, where appLog persistence is safe).
- **The other four AI routes in the file are untouched** — including the `chat-streaming` twin (its fix is a follow-up, §9, not a drive-by).

## 6. Decision table & path walkthrough

Terminal condition × flags → decision, each row verified against an actual code path:

| # | Path (how you get there) | hasError | aborted | meaningful | completed | Today | After |
|---|---|---|---|---|---|---|---|
| 1 | `done` written, clean teardown | – | – | any | ✓ | charge | charge |
| 2 | `done` received, abort during teardown (delivered + persisted) | – | ✓ | any | ✓ | **refund** | **charge** |
| 3 | `error` chunk before any output (provider error, parse failure, `saveGeneration` throw) | ✓ | – | – | – | refund | refund |
| 4 | `error` chunk after non-empty partials (`done` never came) | ✓ | – | ✓ | – | refund | refund |
| 5 | `error` chunk written, then user aborts before loop exit | ✓ | ✓ | any | – | refund | refund |
| 6 | abort before `started`/any partial (thinking phase) | – | ✓ | – | – | refund | refund |
| 7 | abort after empty-skeleton partials only | – | ✓ | – | – | refund | refund |
| 8 | **abort after a non-empty partial (the S2 exploit)** | – | ✓ | ✓ | – | **refund** | **charge** |
| 9 | catch: genuine throw (`loadGenerationContext` / store failure on first `next()`) | ✓ | – | – | – | refund | refund |
| 10 | catch: `AbortError` / throw while socket gone | – | ✓ | almost surely – | – | refund | refund iff nothing meaningful streamed |
| 11 | clean loop exit, no done/error/abort (unreachable from `streamTta`) | – | – | any | – | charge | charge (parity) |

Path notes, verified in code:

- **Rows 3–5**: `streamTta` yields the `error` chunk and `return`s (`tta.ts` case `"error"`, and its outer `catch` → `createStreamError`); `done` can never follow an `error`, and an `error` can never follow `done` — `hasError && hasCompleted` is unreachable from chunks. (If it ever co-occurred via the catch path, `hasCompleted` winning is correct: the user has the persisted result; only teardown failed.)
- **Row 9**: the route `catch` *is* reachable — `store.loadGenerationContext` is awaited at the top of `streamTta`, so its throw surfaces on the route's first `for await` tick, before anything streamed. Refund, as today.
- **Row 10**: after the first chunks flow, `streamTta` stops throwing (its catch converts to `error` chunks; aborts return cleanly), so a catch-path abort with `hasMeaningfulOutput === true` requires a `stream.end()`-class throw after the post-loop settle — which the latch already neutralized.
- **Double-rollback verdict**: today, post-loop rollback + catch rollback can only stack if `stream.end()` throws (practically unreachable, §1a); after the change it cannot stack at all (`rateLimitSettled`).
- **Residual races (documented, accepted)**: (i) abort landing after `saveGeneration` but before the route receives `done`, in a generation that streamed **zero** non-empty partials (small additive follow-ups can legitimately stream zero partials — tta.md §3 low-list / §5) → refunded despite a persisted result. Window is one generator tick wide, blind to the client (no observable signal to aim at), and value requires a later follow-up turn to exploit the persisted context. The structural fix is server-side reconciliation (charge keyed to attempt lifecycle status — S1's territory makes that possible later). (ii) the `check()` eager-persist vs `rollback` race on sub-second failures (§1a) — house-favoring, pre-existing.

## 7. Tests

**Status of test infrastructure (verified):** `apps/api` has a wired jest target (`project.json` → `test` → `tooling:test` → `_test` `@nx/jest` with `apps/api/jest.config.ts`, ts-jest, node env) but **zero test files today** — this adds the first one. The repo's route-level test pattern (`createRouteTestApp` + `app.inject` + per-service `jest.mock`) exists only in `apps/public-api/src/lib/test-helpers.ts`; standing up the equivalent for `routes/ai.ts` means mocking `@server/fire`, `@server/services`, `@server/openai`, `@server/rate-limiting`, `@server/tta`, `@server/sandbox`, the auth decoration, and `../lib/plusDb` (which constructs a live `Database` at import) — and `app.inject` (light-my-request) cannot abort a request mid-stream, so the most important rows (2, 8) aren't expressible in it anyway; abort-timing tests need a real socket (`fastify.listen` + undici + `AbortController`). That is disproportionate for this change. Honest position: **the policy carries the risk, and the policy is a pure function — test that exhaustively**; the route wiring is three flag assignments and two call sites, covered by review + manual QA.

### 7a. `apps/api/src/lib/aiStreamRateLimitPolicy.test.ts` (new)

```ts
import { shouldRollbackRateLimit } from "./aiStreamRateLimitPolicy";

describe("shouldRollbackRateLimit (S2 decision table)", () => {
  const cases: [
    description: string,
    flags: Parameters<typeof shouldRollbackRateLimit>[0],
    expected: boolean,
  ][] = [
    // completed — never refund
    ["clean completion",
      { hasError: false, aborted: false, hasMeaningfulOutput: true, hasCompleted: true }, false],
    ["abort during teardown after done (delivered + persisted generation)",
      { hasError: false, aborted: true, hasMeaningfulOutput: true, hasCompleted: true }, false],
    ["abort after done with zero partials (small additive follow-up)",
      { hasError: false, aborted: true, hasMeaningfulOutput: false, hasCompleted: true }, false],
    // errors — always refund
    ["error before any output",
      { hasError: true, aborted: false, hasMeaningfulOutput: false, hasCompleted: false }, true],
    ["error after meaningful partials (done never came)",
      { hasError: true, aborted: false, hasMeaningfulOutput: true, hasCompleted: false }, true],
    ["error then abort",
      { hasError: true, aborted: true, hasMeaningfulOutput: true, hasCompleted: false }, true],
    // aborts — refund only when the user got nothing
    ["abort during thinking phase (nothing streamed)",
      { hasError: false, aborted: true, hasMeaningfulOutput: false, hasCompleted: false }, true],
    ["abort after meaningful partials — the S2 exploit",
      { hasError: false, aborted: true, hasMeaningfulOutput: true, hasCompleted: false }, false],
    // unreachable defaults — parity with current behavior (keep the charge)
    ["clean exit without any terminal flag",
      { hasError: false, aborted: false, hasMeaningfulOutput: false, hasCompleted: false }, false],
    ["clean exit with partials but no done",
      { hasError: false, aborted: false, hasMeaningfulOutput: true, hasCompleted: false }, false],
  ];

  test.each(cases)("%s", (_description, flags, expected) => {
    expect(shouldRollbackRateLimit(flags)).toBe(expected);
  });

  test("hasCompleted dominates every other flag combination", () => {
    for (const hasError of [true, false]) {
      for (const aborted of [true, false]) {
        for (const hasMeaningfulOutput of [true, false]) {
          expect(
            shouldRollbackRateLimit({
              hasError,
              aborted,
              hasMeaningfulOutput,
              hasCompleted: true,
            }),
          ).toBe(false);
        }
      }
    }
  });
});
```

### 7b. Commands

```bash
npx nx test api        # first-ever test in apps/api — the target exists and is wired
npx nx tsc api         # the repo's typecheck target for this app
```

(⚠️ `nx test api` presumably exits non-zero *today* on "no tests found" — nobody runs it yet; after 7a it's green and meaningful.)

### 7c. Manual QA (requires a Plus-like dev environment)

The reviewer's live validation (tta.md §5) covered the **OSS** server only, where this route and the refund system don't exist — so this section is for whoever has a Plus dev setup (Firebase auth + workspace + Firestore); otherwise rely on 7a + the §6 table. The observable is the `X-Ratelimit-Remaining` header on the **next** generation request (refunds are async — allow a beat for the Firestore transaction), plus the new pino line:

1. **Full completion** → next request's `Remaining` is one lower; log line absent (normal terminals don't log).
2. **Stop mid-stream after the canvas shows elements** → `Remaining` stays one lower (no refund) — **the fix**; log shows `refunded: false, aborted: true, hasMeaningfulOutput: true`.
3. **Stop immediately after sending (during the silent thinking phase)** → `Remaining` recovers (+1); log shows `refunded: true, hasMeaningfulOutput: false`.
4. **Genuine failure** (temporarily break the provider key / throw in `loadGenerationContext`) → `Remaining` recovers; log shows `refunded: true, hasError: true`.
5. **Stop at the last instant (right as the result lands)** → if `done` was received, `Remaining` stays one lower; log shows `hasCompleted: true, refunded: false`.
6. **Regressions**: BYOK workspace streams never log a refund with `charged: true`; the 429 response when the budget is exhausted is unchanged; Firestore `users/{id}.rateLimits.textToDiagram.{ws}.count` never goes below 0 and never drops by 2 for one request.

## 8. Acceptance criteria

- [ ] A client abort after at least one non-empty `partial` chunk does **not** refund the rate-limit charge; an abort before any non-empty partial still does.
- [ ] A stream whose `done` chunk was received never refunds, regardless of abort timing or teardown errors (the delivered-and-persisted edge is closed).
- [ ] Genuine failures still always refund: `error` chunks (before *and* after partials) and non-abort handler throws.
- [ ] `rateLimiting.rollback` is invoked at most once per request, from a single call site, latched — double-refund is structurally impossible.
- [ ] Every abnormal terminal emits one structured `req.log.info` line with `{ refunded, charged, hasError, aborted, hasMeaningfulOutput, hasCompleted, userId, workspaceId }`; normal completions emit nothing new.
- [ ] BYOK, 429, wire protocol, client behavior, the other AI routes, and `libs/server/tta/**` are unchanged; `npx nx tsc api` clean.
- [ ] §7a decision-table test passes (`npx nx test api`), including the `hasCompleted`-dominance sweep.

## 9. Follow-ups (do not bundle)

- **Port the policy to `POST …/text-to-diagram/chat-streaming`** — same file, same `textToDiagram` key, same unconditional abort-refund; until then the amplification loophole survives via the mermaid chat route against the shared budget. "Meaningful output" there = first non-empty content delta written; the settle helper generalizes (consider hoisting it next to `shouldRollbackRateLimit` when there are two consumers).
- **S1** ([tta.md](tta.md)) — `tta.ts` `try/finally` so aborted/failed attempts stop sticking `pending`; disjoint files, any landing order. Longer-term, attempt lifecycle status enables charge-by-outcome reconciliation, which would also close the §6 residual race (i).
- **OSS asymmetry** — the OSS route (`apps/oss-ai-server/src/api/ai.ts`) uses `@fastify/rate-limit` via the `sharedStreamingAiRateLimit` preHandler: fixed 100/day per IP (with the `FIXME revert to 10 before TTA PR merge` — M13), charged at request start, **no rollback of any kind**. So the S2 loophole doesn't exist there — but neither do error refunds: an OSS user whose generations all fail burns quota with nothing to show. If that becomes a complaint, the fix is a different mechanism (`max` is not decrementable mid-flight in @fastify/rate-limit) — out of scope here; just don't "port" this proposal there expecting symmetry.
- **Refund observability in the DB** — if abuse analysis needs SQL rather than log search, the `onResponse`-buffered appLog model needs an explicit flush for post-teardown writes (§3 telemetry decision); a small `appLogger.saveOne` or moving the save to `onClose` would unlock it for all streaming routes.
- **Service-level hardening of `rateLimiting`** — (a) make `rollback` request-idempotent (e.g. ledger of `{requestId}` refunds) instead of relying on caller discipline; (b) the `check` eager-persist vs `rollback` race (§1a); (c) the fresh-window `nextCount = 0` off-by-one (a window admits `limit + 1` requests). All pre-existing, none blocking.
- **M11 interplay** — fix-pass token usage is dropped (`tta.ts`), so even `done`-chunk usage under-reports; any future token-based refund policy needs that fixed first.
