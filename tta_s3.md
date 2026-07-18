# S3 implementation proposal — gate every partial-snapshot emission (throttle + dedupe), and let small additive follow-ups stream their first partial

Fixes finding **S3** from [tta.md](tta.md): *partial parsing is unthrottled on the non-additive path: O(n²) CPU + O(n²) SSE bytes*. It also fixes the §3 Low-list item *small additive follow-ups can stream zero partials* (the two are one design problem — see §1), and dissolves the §3 double-assignment nit on `additiveNextPartialAttemptAt` (`tta.ts:2141-2147`; called **L1** below) by construction.

Companion to [tta_c1.md](tta_c1.md) / [tta_c2.md](tta_c2.md) / [tta_c4.md](tta_c4.md) (same conventions: code anchors are quoted as snippets — line numbers are from review time and may drift, match on the snippet, not the number; implementable without re-deriving the analysis). The change is **server-only**, inside `excalidraw-plus/libs/server/tta` — no protocol shape, client, type, or i18n changes. Client behavior is cited only to prove the server change is invisible to it.

---

## 1. The bug

There are exactly three places that emit streamed `partial` snapshots, all in `excalidraw-plus/libs/server/tta/src/lib/tta.ts` (verified — the only other `parsePartialExmlV1` consumer in the workspace is the one-shot `apps/ai-playground/src/server/tta/exmlPlayground.ts`, not a stream):

1. **Main stream, non-additive path** (`streamTta`, `tta.ts:2171-2186`) — runs `parsePartialExmlV1(accumulated)` and yields the **entire** skeleton array on **every** provider content delta. No throttle of any kind. This is the path for every fresh generation *and* for follow-ups the model answers with `ttaOp="full"`.
2. **Main stream, additive path** (`tta.ts:2131-2168`) — throttled by `ADDITIVE_PARTIAL_MIN_INTERVAL_MS = 250` **and** `ADDITIVE_PARTIAL_MIN_DELTA_CHARS = 256` (`tta.ts:219-220`), conditions ANDed.
3. **LLM-fix stream** (`requestTtaFix`, `tta.ts:1523-1546`) — parses + emits per delta, unthrottled, same as (1).

Per-attempt cost is not a tag-scan: `parsePartialExmlV1` (`libs/server/tta/src/lib/ai/parser/exmlParserV1.ts:157-186`) runs `normalizePartialExmlSource` (regex + matching-close scan over the **full accumulated text**), then the loose XML parse and the **entire layout engine** — `buildLayoutTree` → `sizeLayoutTree` → `positionLayoutTree`/`finalizeDeferredLineConnects` → `normalizeLinearPoints`/`applyGroupRotations` → `flattenLayoutTree` — each pass O(n) in the accumulated source. Per-delta invocation makes the stream Σᵢ O(nᵢ) = **O(n·d)** CPU for d deltas of total length n (≈ O(n²) when deltas are token-sized), and since every emission is a full snapshot, **O(P·d)** bytes on the wire for final payload size P.

Live-measured (tta.md §5, dev oss-ai-server on `dwelle/tta`, raw SSE captures, 2026-06-12):

- a 5-element drawing → **11 partials at 28–144 ms cadence, growing 52 B → ~2 KB**;
- a follow-up (answered `ttaOp="full"` — only the unthrottled path can produce sub-250 ms cadence) → **18 partials → 3.2 KB**;
- the same capture session contains a **consecutive byte-identical run (715 B / 715 B / 715 B)** — the deltas in between completed no new element, so three identical snapshots crossed the wire;
- the flip side: a small follow-up edit (*"rename box A to X"*, `ttaOp="replace"`) streamed **zero** partial frames — spinner-only until `done`.

The zero-partial case is the additive throttle's 256-char floor: `additiveLastPartialAttemptLength` starts at 0, so the **first** attempt already requires ≥256 accumulated chars — a complete small replace/append fragment (~80–200 chars) never qualifies. And if a fragment *does* qualify but its mid-stream merge fails, the bare `catch {}` (`tta.ts:2165`) swallows it invisibly.

The current additive block, quoted in full (this is also the **find** anchor for §4 step 5):

```ts
          if (additivePreviousExml && followUpOperation && followUpOperation !== "full") {
            const now = Date.now();
            if (
              now < additiveNextPartialAttemptAt ||
              accumulated.length - additiveLastPartialAttemptLength <
                ADDITIVE_PARTIAL_MIN_DELTA_CHARS
            ) {
              break;
            }

            additiveLastPartialAttemptLength = accumulated.length;
            additiveNextPartialAttemptAt = now + ADDITIVE_PARTIAL_MIN_INTERVAL_MS;

            const partial = parsePartialExmlV1(accumulated, {
              seed: chat.seed,
            });
            additiveNextPartialAttemptAt = Date.now() + ADDITIVE_PARTIAL_MIN_INTERVAL_MS;

            if (partial) {
              try {
                const mergedPartial = applyAdditiveExmlOperation({
                  operation: followUpOperation,
                  previousExml: additivePreviousExml,
                  additiveExml: partial.normalizedSource,
                });
                const parsedPartial = parseExmlV1(mergedPartial, {
                  seed: chat.seed,
                });
                remapElementIds(parsedPartial.elements, chat.id);
                yield {
                  type: "partial",
                  skeletons: parsedPartial.elements,
                  isComplete: partial.isComplete,
                };
              } catch {}
            }

            break;
          }
```

Note **L1** inside it: `additiveNextPartialAttemptAt` is assigned twice — pre-parse (`now + …`, dead) and post-parse (`Date.now() + …`, wins). Evidence the throttle's *time* half is the right idea, implemented one-and-a-half times in one place and zero times in the other two.

Why this is safe to fix server-side (the client already cannot use the excess frames):

- the canvas preview renders **at most one frame per 300 ms** (`STREAMING_PREVIEW_RENDER_THROTTLE_DELAY` — [packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts:23](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L23)) and parks only the *latest* pending result ([useAIStreamingCanvasPreview.ts:278-295](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L278-L295)) — everything between renders is discarded;
- every partial **replaces** the previous one wholesale ([packages/excalidraw/TTA/client.ts:255-259](packages/excalidraw/TTA/client.ts#L255-L259) — `onChunk({ skeletons: event.skeletons ?? [], isComplete: false })`), and the `done` chunk always carries the **final full skeletons** (`tta.ts:2290-2299`, verified below in §5) — dropping intermediate frames is lossless by protocol design;
- as a side benefit, fewer partials = fewer per-chunk assistant-message patches and fewer debounced whole-history IndexedDB writes (M2 in [tta.md](tta.md)).

## 2. Desired behavior

| Scenario | Today | After fix |
|---|---|---|
| Fresh generation / `ttaOp="full"` follow-up, content delta arrives | full re-parse + full-snapshot emission **per delta** (11 frames at 28–144 ms on the §5 run) | parse attempts ≥250 ms apart (first attempt immediate); emit only when the snapshot actually changed |
| Additive follow-up (replace/append), large fragment | attempt requires 250 ms elapsed **and** ≥256 new chars | attempt requires 250 ms elapsed and *any* new content; dedupe on top |
| Additive follow-up, **small fragment** (<256 chars total) | **zero partials** — spinner until `done` (§5 live) | first attempt always allowed once the root op is known → **≥1 partial** (empirically a meaningful frame — §3); further attempts at 250 ms |
| Consecutive byte-identical snapshots (the 715 B triple) | all emitted | only the first |
| Final parse yields `isComplete: true`, content changed | emitted | emitted (unchanged) |
| Final parse yields `isComplete: true`, skeletons identical to previous frame | emitted | **still emitted** — the dedupe key includes `isComplete`, a bare flag-flip is never deduped |
| Final delta lands inside a closed throttle window | partial emitted (no throttle) | attempt skipped; `done` (always full final skeletons) follows — see §3 "no trailing flush" |
| LLM-fix stream | unthrottled per delta | same gate, fresh instance per fix |
| Additive merge / strict re-parse fails mid-stream | silent `catch {}` | still swallowed (best-effort), but `console.info`-logged **once per generation** |
| Additive "pending root op" early-break (`tta.ts:2123-2129`) | breaks before any parse | unchanged, stays *before* the gate |
| `done` chunk contents / `isComplete` semantics on partials | full final skeletons / parser-derived flag | unchanged |

## 3. Design decisions (so nobody re-litigates them mid-implementation)

- **One gate, three call sites.** A closure factory `createPartialEmitGate({ minIntervalMs?, now? })` (injectable clock for tests) returning `{ shouldAttempt, markAttempted, shouldEmit }`, instantiated once per `streamTta` invocation and once per `requestTtaFix` invocation. One instance suffices for both main-stream branches: `followUpOperation` resolves once per generation, so exactly one branch runs throughout. The fix stream gets a *fresh* instance deliberately — its first (fixed) frame must not be deduped against the last broken-stream frame.
- **Attempt gating = interval + "any new content"; the 256-char floor is removed, not renamed.** The floor is what starved small additive fragments, and a first-attempt exception alone does not save them: the first attempt fires the moment the root op resolves (fragment ≈ root tag only), and with a 256-char AND-floor the *rest* of a small fragment never re-qualifies — worse, if that lone first merge threw, the stream would again emit zero partials. With time-only gating the cost ceiling is already firm (≤4 attempts/sec regardless of delta granularity), and "must have grown since the last attempt" is the principled remainder of the floor: re-parsing unchanged input can never produce a new frame. (Within `case "content"` the growth check is currently vacuous — `accumulated += chunk.delta` precedes the gate and `chunk.delta` is non-empty — but it is free and protects future call sites.) So: `ADDITIVE_PARTIAL_MIN_INTERVAL_MS` → `PARTIAL_EMIT_MIN_INTERVAL_MS` (moves into the new module); `ADDITIVE_PARTIAL_MIN_DELTA_CHARS` is deleted.
- **First-attempt exception, and it produces a real frame.** Empirically verified against the current parser/merge code (2026-06-12, scratch run through `parsePartialExmlV1` → `applyAdditiveExmlOperation` → `parseExmlV1` → `remapElementIds`): for previous-scene `box-a("A")`/`box-b("B")` and accumulated text of *only* the complete replace root tag (`<R v="1.0" ttaOp="replace" ttaReplace="#box-a" …>`, what the first attempt sees — the pending-root-op break guarantees the root tag is complete), the merge succeeds and yields 3 elements: box-a swapped for the still-childless replacement, box-b and its label intact. One delta later (`<T text="X" />`) the rename is visible mid-stream. So the *"rename box A to X"* repro goes from spinner-only to previous-scene-shown-immediately, edit landing mid-stream.
- **Keep 250 ms; justify against the client's 300 ms.** The server's emission interval must stay ≲ the client's render interval ([useAIStreamingCanvasPreview.ts:23](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L23) — 300 ms): at 250 ms the client almost always has a ≤250 ms-fresh frame when its render window opens; pushing the server interval above 300 ms would make the client render stale frames or idle through windows. 250/300 also leaves headroom for parse time (the interval is measured from the *end* of an attempt, below).
- **Dedupe = serialized payload, `isComplete` included, owned by the gate.** Key: `` `${isComplete}:${JSON.stringify(skeletons)}` ``, compared against the last *emitted* key. Element count alone is **not** a valid proxy — label text grows within an element — and the serialization is O(payload), trivially cheap next to the layout-pipeline parse that produced the payload. Determinism of the key is guaranteed by the seeded parser + chat-scoped stable id remap (verified: two parses of identical input with the same seed/chat produce byte-identical JSON — that's also *why* the 715 B triple was byte-identical on the wire). Including `isComplete` means the one observed real-world flag-flip shape — the closing root tag arrives, skeleton JSON byte-identical (verified live: 1287 B / 1287 B with only `isComplete` flipping) — is **never** deduped. Memory cost: one retained serialized payload per active generation (bounded by the parser's 10k-node cap), short-lived.
- **`markAttempted` is called once, after the whole attempt — L1 dissolves.** The gate owns timing; there is exactly one recording point. Today the *winning* assignment (`tta.ts:2147`) starts the window after `parsePartialExmlV1` but before the merge + strict re-parse; the gate's `markAttempted` runs after the full attempt (parse **and** merge), which is the defensible reading — attempts, not parse-halves, are spaced 250 ms apart. ⚠️ This is a deliberate (slightly more conservative) semantic nudge, not an accident.
- **A throttled-away final partial is fine; `done` is the protocol's trailing flush.** The gate can suppress the last in-window parse attempt, so the would-be `isComplete: true` partial may never be built. No client-visible regression: (a) `done` always carries the final full skeletons (`tta.ts:2290-2299`) and follows the last delta by strict-parse + `saveGeneration` time (milliseconds) in the common case; (b) on the slow path (LLM fix) the dropped frame contained the *malformed* source anyway, and the gated fix stream emits its own partials. We do **not** lean on the client bug here — yes, [client.ts:255-259](packages/excalidraw/TTA/client.ts#L255-L259) currently hardcodes `isComplete: false` for partials (tta.md §3 type-drift item), so dropping the flag is doubly invisible today — but the argument holds for a *corrected* client too: `done` is and remains the authoritative completion signal (that is also [tta_c2.md](tta_c2.md)'s position — success requires a terminal `done`, never a partial), so partial-`isComplete` is advisory. And when the final attempt *is* made, the flag-flip is guaranteed through (dedupe key includes it). Documented here so nobody adds a special-case "always emit the complete partial" code path — it would buy nothing.
- **No server-side trailing flush either.** Re-parsing once more after the loop "to be safe" would duplicate work `parseFinalGeneration` does immediately after, for a frame the client would hold ≤300 ms before `done` replaces it. The protocol already has the flush.
- **`catch {}` becomes observable but stays a swallow.** Partials are best-effort — mid-stream merges legitimately fail (auto-closed fragments can flunk the strict re-parse; hallucinated `ttaReplace` targets throw — M9), so per-failure logging would spam and *throwing* would kill a recoverable stream. But total silence is how the zero-partial behavior stayed invisible until live validation. Decision: `console.info` (matches the file's `[TTA]` logging idiom, e.g. the LLM-fix line at `tta.ts:1697`) with chatId + operation + message, **capped at once per generation** via a local flag. Full merge-failure UX (fallback to `op: "full"`) is M9, out of scope.
- **Extract `buildPartialChunk` so the content-case logic is unit-testable.** The parse→(merge)→remap→chunk pipeline is pure (no generator state, no I/O) and identical in shape across all three call sites; extracting it collapses the two main-stream branches into one gated block and gives tests a scripted-delta entry point without mocking `streamTta` (provider + store + abort plumbing — disproportionate; see §6c).
- **New module `libs/server/tta/src/lib/partialEmit.ts`, no `@global/types` import.** ⚠️ Load-bearing detail: this lib's `tsconfig.spec.json` `paths` only map `@excalidraw/*` (it *replaces*, not merges, the base config's paths), and `jest.config.ts` `moduleNameMapper` likewise — existing tests never import `@global/*` or `tta.ts` itself. The module therefore declares a structural `EmittablePartialChunk` (field-for-field identical to `TTA.PartialChunk`, whose `ExcalidrawElementSkeleton` comes from the same `@excalidraw/element` — verified in `libs/global/types/src/lib/tta-types.ts:1,22-37`), keeping it assignable at every `TTA.StreamChunk` yield site while staying jest-importable.
- **Disclosed behavior change (acceptable):** on the unthrottled paths the *first* attempt now happens on the first content delta (almost certainly a null parse — no root tag yet) and the first successful parse may land up to one 250 ms window later than today. The client's first render was already gated at 300 ms; net perceived difference ≈ 0–250 ms on first paint, in exchange for the O(n·d) → O(n·k) cut.

## 4. Implementation steps

All in `excalidraw-plus` (branch `dwelle/tta`). Steps 2–6 are find/replace in `libs/server/tta/src/lib/tta.ts`; step 1 is a new file.

### Step 1 — new file `libs/server/tta/src/lib/partialEmit.ts`

```ts
import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import { parseExmlV1, parsePartialExmlV1 } from "./ai/parser/exmlParserV1";
import {
  applyAdditiveExmlOperation,
  type ExmlOperation,
  stripTtaControlAttrs,
} from "./exml/exmlAdditiveMerge";
import { remapElementIds } from "./exml/elementIdRemap";

/**
 * Purpose:
 * - Single emit-gate for every streamed `partial` snapshot (main stream,
 *   additive follow-ups, LLM-fix stream): rate-limits parse *attempts* and
 *   dedupes byte-identical *emissions*.
 * - `buildPartialChunk` is the one place that turns accumulated stream text
 *   into an emittable skeleton snapshot (additive merge included).
 *
 * Why: each parse attempt runs the full O(n) pipeline over the accumulated
 * text (normalize -> loose XML parse -> layout/size/position -> flatten), so
 * per-delta attempts are O(n * deltas) CPU and full-snapshot emissions are
 * O(payload * deltas) on the wire (S3 in the TTA review). Dropping frames is
 * lossless by protocol design: every partial is a full snapshot and the
 * `done` chunk always carries the final skeletons.
 */

export const PARTIAL_EMIT_MIN_INTERVAL_MS = 250;

/**
 * Structurally identical to `Extract<TTA.StreamChunk, { type: "partial" }>`
 * (`ExcalidrawElementSkeleton` resolves to the same `@excalidraw/element`
 * type). Deliberately not imported from `@global/types`: this module is
 * jest-unit-tested and the lib's tsconfig.spec.json / jest moduleNameMapper
 * only resolve `@excalidraw/*` paths.
 */
export type EmittablePartialChunk = {
  type: "partial";
  skeletons: ExcalidrawElementSkeleton[];
  isComplete: boolean;
};

export type PartialEmitGate = {
  shouldAttempt: (accumulatedLength: number) => boolean;
  markAttempted: (accumulatedLength: number) => void;
  shouldEmit: (chunk: EmittablePartialChunk) => boolean;
};

export const createPartialEmitGate = ({
  minIntervalMs = PARTIAL_EMIT_MIN_INTERVAL_MS,
  now = Date.now,
}: {
  minIntervalMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
} = {}): PartialEmitGate => {
  let hasAttempted = false;
  let nextAttemptAt = 0;
  let lastAttemptLength = 0;
  let lastEmittedKey: string | null = null;

  return {
    shouldAttempt: (accumulatedLength) => {
      // The first attempt is always allowed: small additive fragments may
      // never accumulate enough content to clear a delta floor, and used to
      // stream zero partials because of exactly that (tta.md S3 / §5).
      if (!hasAttempted) {
        return true;
      }
      // Re-parsing unchanged input can never produce a new frame; beyond
      // that, attempts are spaced by `minIntervalMs`, measured from the end
      // of the previous attempt (see markAttempted).
      return now() >= nextAttemptAt && accumulatedLength > lastAttemptLength;
    },
    markAttempted: (accumulatedLength) => {
      hasAttempted = true;
      lastAttemptLength = accumulatedLength;
      nextAttemptAt = now() + minIntervalMs;
    },
    shouldEmit: (chunk) => {
      // Full-payload comparison: element count alone is not a valid change
      // proxy (label text grows within an element), and serializing is
      // O(payload) — trivial next to the parse that produced the payload.
      // `isComplete` is part of the key so a final frame that flips only the
      // flag is never deduped. Key determinism is guaranteed by the seeded
      // parser + chat-scoped stable id remap.
      const key = `${chunk.isComplete}:${JSON.stringify(chunk.skeletons)}`;
      if (key === lastEmittedKey) {
        return false;
      }
      lastEmittedKey = key;
      return true;
    },
  };
};

/**
 * Parses the accumulated stream text into an emittable partial snapshot.
 * Returns null while nothing parseable has streamed yet.
 *
 * Throws when an additive merge / strict re-parse fails mid-stream — callers
 * treat partials as best-effort and must swallow (the final result is parsed
 * separately via `parseFinalGeneration`).
 */
export const buildPartialChunk = ({
  accumulated,
  operation,
  previousExml,
  seed,
  chatId,
}: {
  accumulated: string;
  operation: ExmlOperation;
  previousExml: string | null;
  seed: number;
  chatId: string;
}): EmittablePartialChunk | null => {
  if (previousExml && operation !== "full") {
    const partial = parsePartialExmlV1(accumulated, { seed });
    if (!partial) {
      return null;
    }

    const merged = applyAdditiveExmlOperation({
      operation,
      previousExml,
      additiveExml: partial.normalizedSource,
    });
    const parsedPartial = parseExmlV1(merged, { seed });
    remapElementIds(parsedPartial.elements, chatId);
    return {
      type: "partial",
      skeletons: parsedPartial.elements,
      isComplete: partial.isComplete,
    };
  }

  const source =
    previousExml && operation === "full"
      ? stripTtaControlAttrs(accumulated)
      : accumulated;
  const partial = parsePartialExmlV1(source, { seed });
  if (!partial) {
    return null;
  }

  remapElementIds(partial.elements, chatId);
  return {
    type: "partial",
    skeletons: partial.elements,
    isComplete: partial.isComplete,
  };
};
```

(`operation !== "full"` narrows `ExmlOperation` to the `Exclude<ExmlOperation, "full">` that `applyAdditiveExmlOperation` requires — no cast. The parse/merge/remap calls are byte-for-byte the ones currently inlined in `tta.ts`, so element output is unchanged.)

### Step 2 — `tta.ts`: imports

Find:

```ts
import { parseExmlV1, parsePartialExmlV1 } from "./ai/parser/exmlParserV1";
```

Replace with (all three `parsePartialExmlV1` call sites move into `buildPartialChunk`; `parseExmlV1` stays used by the final-parse paths):

```ts
import { parseExmlV1 } from "./ai/parser/exmlParserV1";
```

Find:

```ts
import {
  applyHeuristicDuplicateAttributeFix,
  applyHeuristicQuoteFix,
  logParseFixMetrics,
} from "./exml/exmlRepair";
```

Replace with:

```ts
import {
  applyHeuristicDuplicateAttributeFix,
  applyHeuristicQuoteFix,
  logParseFixMetrics,
} from "./exml/exmlRepair";
import {
  buildPartialChunk,
  createPartialEmitGate,
  type EmittablePartialChunk,
} from "./partialEmit";
```

⚠️ `applyAdditiveExmlOperation`, `stripTtaControlAttrs`, `getExmlRootOperation`, and `remapElementIds` remain imported in `tta.ts` — they are still used by `parseFinalGeneration` / `createGenerationMessages` (`tta.ts:1834,1897,1932,1951,2272`). Only `parsePartialExmlV1` leaves.

### Step 3 — `tta.ts`: constants

Find:

```ts
const CURRENT_TTA_RESPONSE_VERSION = 1;
const ADDITIVE_PARTIAL_MIN_INTERVAL_MS = 250;
const ADDITIVE_PARTIAL_MIN_DELTA_CHARS = 256;
```

Replace with (the interval now lives in `partialEmit.ts` as `PARTIAL_EMIT_MIN_INTERVAL_MS`; the delta floor is removed by design — §3):

```ts
const CURRENT_TTA_RESPONSE_VERSION = 1;
```

### Step 4 — `tta.ts`: `streamTta` per-generation state

Find:

```ts
    let followUpOperation: ExmlOperation | null = additivePreviousExml ? null : "full";
    let additiveNextPartialAttemptAt = 0;
    let additiveLastPartialAttemptLength = 0;
```

Replace with:

```ts
    let followUpOperation: ExmlOperation | null = additivePreviousExml ? null : "full";
    const partialEmitGate = createPartialEmitGate();
    let partialBuildFailureLogged = false;
```

### Step 5 — `tta.ts`: the main-stream `case "content"`

Find the **whole** case (quoted faithfully from current code; the additive block inside it is the one shown in §1):

```ts
        case "content": {
          if (!chunk.delta) {
            break;
          }

          accumulated += chunk.delta;

          if (additivePreviousExml && followUpOperation === null) {
            const operation = getExmlRootOperation(accumulated);
            if (operation.status === "pending") {
              break;
            }
            followUpOperation = operation.op;
          }

          if (additivePreviousExml && followUpOperation && followUpOperation !== "full") {
            const now = Date.now();
            if (
              now < additiveNextPartialAttemptAt ||
              accumulated.length - additiveLastPartialAttemptLength <
                ADDITIVE_PARTIAL_MIN_DELTA_CHARS
            ) {
              break;
            }

            additiveLastPartialAttemptLength = accumulated.length;
            additiveNextPartialAttemptAt = now + ADDITIVE_PARTIAL_MIN_INTERVAL_MS;

            const partial = parsePartialExmlV1(accumulated, {
              seed: chat.seed,
            });
            additiveNextPartialAttemptAt = Date.now() + ADDITIVE_PARTIAL_MIN_INTERVAL_MS;

            if (partial) {
              try {
                const mergedPartial = applyAdditiveExmlOperation({
                  operation: followUpOperation,
                  previousExml: additivePreviousExml,
                  additiveExml: partial.normalizedSource,
                });
                const parsedPartial = parseExmlV1(mergedPartial, {
                  seed: chat.seed,
                });
                remapElementIds(parsedPartial.elements, chat.id);
                yield {
                  type: "partial",
                  skeletons: parsedPartial.elements,
                  isComplete: partial.isComplete,
                };
              } catch {}
            }

            break;
          }

          const partialSource =
            additivePreviousExml && followUpOperation === "full"
              ? stripTtaControlAttrs(accumulated)
              : accumulated;
          const partial = parsePartialExmlV1(partialSource, {
            seed: chat.seed,
          });

          if (partial) {
            remapElementIds(partial.elements, chat.id);
            yield {
              type: "partial",
              skeletons: partial.elements,
              isComplete: partial.isComplete,
            };
          }

          break;
        }
```

Replace with:

```ts
        case "content": {
          if (!chunk.delta) {
            break;
          }

          accumulated += chunk.delta;

          if (additivePreviousExml && followUpOperation === null) {
            const operation = getExmlRootOperation(accumulated);
            if (operation.status === "pending") {
              break;
            }
            followUpOperation = operation.op;
          }

          if (
            // `followUpOperation` is always resolved past this point (fresh
            // generations initialize it to "full"; additive generations
            // either resolved it above or broke on "pending") — the null
            // check only narrows the type for `buildPartialChunk`.
            followUpOperation === null ||
            !partialEmitGate.shouldAttempt(accumulated.length)
          ) {
            break;
          }

          let partialChunk: EmittablePartialChunk | null = null;
          try {
            partialChunk = buildPartialChunk({
              accumulated,
              operation: followUpOperation,
              previousExml: additivePreviousExml,
              seed: chat.seed,
              chatId: chat.id,
            });
          } catch (error) {
            // Partials are best-effort: a failed additive merge / strict
            // re-parse mid-stream only skips this frame — the final result
            // still goes through parseFinalGeneration. Log the first failure
            // per generation so silent merge breakage (the zero-partial
            // observation in tta.md §5) stays diagnosable without
            // per-delta spam.
            if (!partialBuildFailureLogged) {
              partialBuildFailureLogged = true;
              console.info("[TTA] Partial preview build failed mid-stream", {
                chatId: chat.id,
                operation: followUpOperation,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
          partialEmitGate.markAttempted(accumulated.length);

          if (partialChunk && partialEmitGate.shouldEmit(partialChunk)) {
            yield partialChunk;
          }

          break;
        }
```

⚠️ The `yield` sits *outside* the `try` on purpose: the old code yielded inside the additive `try {} catch {}`, which would also have swallowed an error injected by a consumer `.throw()` at the suspension point. Nothing calls `.throw()` today (both routes just stop pulling), but don't reintroduce the hazard while touching this.

### Step 6 — `tta.ts`: `requestTtaFix`

Find:

```ts
  }) as AsyncIterable<TanStackStreamChunk>;

  let accumulated = "";
```

Replace with:

```ts
  }) as AsyncIterable<TanStackStreamChunk>;

  let accumulated = "";
  const partialEmitGate = createPartialEmitGate();
```

Find:

```ts
      case "content": {
        if (!chunk.delta) {
          break;
        }

        accumulated += chunk.delta;

        const partial = parsePartialExmlV1(accumulated, {
          seed: chat.seed,
        });

        if (partial) {
          remapElementIds(partial.elements, chat.id);
          yield {
            type: "partial",
            chunk: {
              type: "partial",
              skeletons: partial.elements,
              isComplete: partial.isComplete,
            },
          };
        }
        break;
      }
```

Replace with (the fix stream is always a fresh full parse — `previousExml: null` — so `buildPartialChunk` cannot throw here, same as today's code; no try/catch needed):

```ts
      case "content": {
        if (!chunk.delta) {
          break;
        }

        accumulated += chunk.delta;

        if (!partialEmitGate.shouldAttempt(accumulated.length)) {
          break;
        }

        const partialChunk = buildPartialChunk({
          accumulated,
          operation: "full",
          previousExml: null,
          seed: chat.seed,
          chatId: chat.id,
        });
        partialEmitGate.markAttempted(accumulated.length);

        if (partialChunk && partialEmitGate.shouldEmit(partialChunk)) {
          yield {
            type: "partial",
            chunk: partialChunk,
          };
        }
        break;
      }
```

(`EmittablePartialChunk` is structurally `Extract<TTA.StreamChunk, { type: "partial" }>`, so it satisfies `FixStreamEvent["chunk"]` — `tta.ts:121-125` — and the bare `yield partialChunk` in step 5 satisfies `TTA.StreamChunk`. Note the fix stream's partials only reach the wire on the non-additive final-parse path — `parseFinalGeneration` forwards just `message` chunks on the additive path, `tta.ts:1915-1919` — but both go through the now-gated `requestTtaFix` regardless.)

## 5. Invariants to preserve (regression watch-list)

- **`done` always carries the final full skeletons** — `streamTta` ends with `yield { type: "done", …, skeletons: parsed.elements, … }` (`tta.ts:2290-2299`) built from `parseFinalGeneration` over the complete accumulated text, never from the partial path. This is what makes every dropped/deduped intermediate frame lossless. Untouched.
- **The additive "pending root op" early-break stays, and stays *before* the gate** — so the gate's first-attempt exception only fires once the complete root tag (and thus the operation + all root attrs) is known.
- **`isComplete` semantics on partials are unchanged** — the parser-derived flag flows through untouched; the dedupe key includes it, so a flag-only flip is always emitted; the throttle may drop the final attempt entirely, which is covered by `done` (§3).
- **Merge failures remain non-fatal** — `buildPartialChunk` throws, the caller swallows; the stream proceeds to `parseFinalGeneration` exactly as today (where the same failure either repros and enters the fix ladder, or doesn't matter).
- **Per-generation state only** — gate + log-flag live inside the generator invocation; concurrent generations (and the Plus route, `apps/api/src/routes/ai.ts`, which consumes the same `streamTta`) are isolated. No module-level state.
- **`signal?.aborted` checkpoints, `started`/`message`/`error` chunks, web-search accounting, `finishReason`/usage capture** — all outside the replaced region, untouched.
- **The one-shot parse in `apps/ai-playground/.../exmlPlayground.ts`** keeps importing `parsePartialExmlV1` directly (single parse per request — nothing to gate).
- **Out of scope, explicitly**: protocol shape (no delta-ops — §8), client changes, S1 (attempt-status finalization), S2 (refund policy), S4 (order race), M9 (merge-failure fallback), M10 (`finishReason: "length"`).

## 6. Tests

Runner: **jest via nx** (`libs/server/tta/project.json` → `test` target wraps `_test` = `@nx/jest:jest` with `libs/server/tta/jest.config.ts`; existing suites: `exmlParserV1.test.ts`, `exmlAdditiveMerge.test.ts`, `elementIdRemap.test.ts` — `describe`/`it`, `initServerTextMetrics()` at module top when layout runs).

### 6a. New `libs/server/tta/src/lib/partialEmit.test.ts` — the gate (pure, injected clock)

```ts
import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import { initServerTextMetrics } from "./textMetrics/serverTextMetrics";
import { getExmlRootOperation } from "./exml/exmlAdditiveMerge";
import {
  buildPartialChunk,
  createPartialEmitGate,
  type EmittablePartialChunk,
} from "./partialEmit";

initServerTextMetrics();

describe("createPartialEmitGate", () => {
  const createTestGate = () => {
    let t = 0;
    const gate = createPartialEmitGate({ minIntervalMs: 250, now: () => t });
    return { gate, tick: (ms: number) => (t += ms) };
  };

  it("always allows the first attempt regardless of content length", () => {
    const { gate } = createTestGate();
    expect(gate.shouldAttempt(10)).toBe(true);
  });

  it("spaces attempts by minIntervalMs from the end of the previous attempt", () => {
    const { gate, tick } = createTestGate();
    gate.markAttempted(100);
    expect(gate.shouldAttempt(200)).toBe(false);
    tick(249);
    expect(gate.shouldAttempt(200)).toBe(false);
    tick(1);
    expect(gate.shouldAttempt(200)).toBe(true);
  });

  it("never re-attempts unchanged input, even after the interval", () => {
    const { gate, tick } = createTestGate();
    gate.markAttempted(100);
    tick(10_000);
    expect(gate.shouldAttempt(100)).toBe(false);
    expect(gate.shouldAttempt(101)).toBe(true);
  });

  it("dedupes identical consecutive emissions but never a bare isComplete flip", () => {
    const { gate } = createTestGate();
    const skeletons = [
      { type: "rectangle", width: 10 },
    ] as unknown as ExcalidrawElementSkeleton[];
    expect(gate.shouldEmit({ type: "partial", skeletons, isComplete: false })).toBe(true);
    expect(gate.shouldEmit({ type: "partial", skeletons, isComplete: false })).toBe(false);
    // The live-observed final-frame shape: the closing root tag changes
    // nothing but the flag (byte-identical skeletons) — must still emit.
    expect(gate.shouldEmit({ type: "partial", skeletons, isComplete: true })).toBe(true);
  });
});
```

### 6b. Same file — `buildPartialChunk` with scripted deltas

Expected values below were **verified against the current parser/merge code** (2026-06-12) by running the exact pipeline (`parsePartialExmlV1` → `applyAdditiveExmlOperation` → `parseExmlV1` → `remapElementIds`, seed 42, chat `"chat-1"`) — they are observations, not guesses:

```ts
describe("buildPartialChunk", () => {
  const PREVIOUS = `<S v="1.0" layout="h" w="hug" h="hug"><R id="box-a" w="100" h="50"><T text="A" /></R><R id="box-b" w="100" h="50"><T text="B" /></R></S>`;
  const replaceArgs = { operation: "replace", previousExml: PREVIOUS, seed: 42, chatId: "chat-1" } as const;

  it("emits a merged frame from the very first additive attempt (root tag only)", () => {
    const chunk = buildPartialChunk({
      accumulated: `<R v="1.0" ttaOp="replace" ttaReplace="#box-a" w="100" h="50">`,
      ...replaceArgs,
    });
    // Verified: 3 elements — box-a swapped for the still-childless
    // replacement, box-b + its "B" label intact. This is the frame that
    // turns the §5 "spinner until done" repro into instant feedback.
    expect(chunk).not.toBeNull();
    expect(chunk!.isComplete).toBe(false);
    expect(chunk!.skeletons).toHaveLength(3);
  });

  it("shows streamed content mid-fragment; the closing tag flips only isComplete", () => {
    const mid = buildPartialChunk({
      accumulated: `<R v="1.0" ttaOp="replace" ttaReplace="#box-a" w="100" h="50"><T text="X" />`,
      ...replaceArgs,
    });
    const closed = buildPartialChunk({
      accumulated: `<R v="1.0" ttaOp="replace" ttaReplace="#box-a" w="100" h="50"><T text="X" /></R>`,
      ...replaceArgs,
    });
    // Verified: both parse to 4 elements with texts ["X", "B"] and
    // byte-identical skeleton JSON; only `isComplete` differs — exactly the
    // shape the dedupe key must NOT collapse.
    expect(mid!.skeletons.some((s) => (s as { text?: string }).text === "X")).toBe(true);
    expect(mid!.isComplete).toBe(false);
    expect(closed!.isComplete).toBe(true);
    expect(JSON.stringify(closed!.skeletons)).toBe(JSON.stringify(mid!.skeletons));
  });

  it("returns null before a parseable root; identical inputs serialize identically", () => {
    expect(
      buildPartialChunk({
        accumulated: `<R v="1.0" ttaOp=`,
        operation: "full", previousExml: null, seed: 42, chatId: "chat-1",
      }),
    ).toBeNull();
    const a = buildPartialChunk({ accumulated: PREVIOUS, operation: "full", previousExml: null, seed: 42, chatId: "chat-1" });
    const b = buildPartialChunk({ accumulated: PREVIOUS, operation: "full", previousExml: null, seed: 42, chatId: "chat-1" });
    // Pins the dedupe key's determinism (seeded parser + stable id remap).
    expect(JSON.stringify(a!.skeletons)).toBe(JSON.stringify(b!.skeletons));
  });

  it("throws on hallucinated replace targets (callers swallow + log once)", () => {
    expect(() =>
      buildPartialChunk({
        accumulated: `<R v="1.0" ttaOp="replace" ttaReplace="#nope" w="100" h="50">`,
        ...replaceArgs,
      }),
    ).toThrow(/Replacement target not found/);
  });

  it("streams ≥1 (but throttled) partials for a small additive fragment driven through the gate", () => {
    // Mirrors the content-case wiring (root-op break -> shouldAttempt ->
    // build -> markAttempted -> shouldEmit) over scripted 8-char deltas at a
    // simulated 60 ms cadence — the whole fragment is ~80 chars, far below
    // the old 256-char floor that produced zero partials.
    let t = 0;
    const gate = createPartialEmitGate({ now: () => t });
    const fragment = `<R v="1.0" ttaOp="replace" ttaReplace="#box-a" w="100" h="50"><T text="X" /></R>`;
    const emitted: EmittablePartialChunk[] = [];
    let accumulated = "";
    for (let i = 0; i < fragment.length; i += 8) {
      accumulated += fragment.slice(i, i + 8);
      t += 60;
      if (getExmlRootOperation(accumulated).status !== "ready") {
        continue;
      }
      if (!gate.shouldAttempt(accumulated.length)) {
        continue;
      }
      let chunk: EmittablePartialChunk | null = null;
      try {
        chunk = buildPartialChunk({ accumulated, ...replaceArgs });
      } catch {}
      gate.markAttempted(accumulated.length);
      if (chunk && gate.shouldEmit(chunk)) {
        emitted.push(chunk);
      }
    }
    expect(emitted.length).toBeGreaterThanOrEqual(1); // the zero-partial fix
    expect(emitted.length).toBeLessThanOrEqual(3); // …and still throttled
  });
});
```

### 6c. Why no `streamTta` integration test (honest scope)

Driving the real generator would mean mocking `generateChat` (`@tanstack/ai`), the eager-iterable wrapper, the store (`saveGenerationAttempt`/`saveGeneration`/`loadGenerationContext`), and abort plumbing — a large fixture that would mostly test the mock. The last test in §6b deliberately re-states the content-case wiring instead of executing it; the thin generator glue (gate placement, once-logging, yield order) is covered by the manual QA below, which replicates the §5 measurement method that found S3 in the first place.

### 6d. Commands

```bash
npx nx test server-tta                                      # full lib suite
npx nx run server-tta:_test --testPathPattern=partialEmit   # scoped (direct jest target)
```

### 6e. Manual QA — replicate the §5 measurements (dev oss-ai-server, before/after)

⚠️ Use `127.0.0.1`, not `localhost`: `RATE_LIMIT_ALLOW_LIST` only exempts IPv4 loopback (tta.md §5 dev trivia — `::1` is rate-limited). Route: `POST /v1/ai/tta/generate/stream` (`apps/oss-ai-server/src/api/ai.ts:174`, registered with `prefix: "/v1"`).

1. **Fresh generation — frame count + inter-arrival:**

   ```bash
   curl -sN http://127.0.0.1:3016/v1/ai/tta/generate/stream \
     -H 'content-type: application/json' \
     -d '{"prompt":"a flowchart with five labeled boxes"}' \
   | while IFS= read -r line; do
       [ -n "$line" ] && printf '%s %6d  %s\n' "$(date +%s.%3N)" "${#line}" "${line:0:60}"
     done | tee /tmp/tta-fresh.log
   grep -c '"type":"partial"' /tmp/tta-fresh.log
   ```

   Before: ~one partial per provider delta at 28–144 ms (11 on the §5 run). After: partial inter-arrival ≥ ~250 ms, count ≈ ⌊window/250 ms⌋ + 1 (≈3–6 for a §5-sized run — §7 math), `started` → `partial*` → `done` → `[DONE]` order unchanged, `done` still carries the full skeletons.
2. **No byte-identical consecutive frames:** `grep '"type":"partial"' /tmp/tta-fresh.log | awk '{$1=""; print}' | uniq -d` → must print nothing (before the fix, the §5-session captures showed a 715 B/715 B/715 B run).
3. **Small additive edit — the zero-partial repro:** take `chatId` from the `started` frame of run 1, then:

   ```bash
   curl -sN http://127.0.0.1:3016/v1/ai/tta/generate/stream \
     -H 'content-type: application/json' \
     -d '{"prompt":"rename the first box to X","chatId":"<chatId>"}' | grep -c '"type":"partial"'
   ```

   Before: `0` (live-confirmed §5, *if* the model answers with `ttaOp="replace"` — check the raw capture; a `full` answer exercises path 1 instead). After: **≥1**, the first arriving right after the additive root tag streams; the canvas/chat preview shows the previous scene immediately instead of a spinner.
4. **Fix-stream gating (opportunistic):** if a run happens to enter the LLM-fix ladder (`status` message *"…fixing…"* appears), confirm its partials are also ≥250 ms apart. Don't force it — the path is identical code.
5. **Merge-failure log:** temporarily hack a bogus `ttaReplace` target into a follow-up response (or replay one from `tta_errors`) → exactly **one** `[TTA] Partial preview build failed mid-stream` info line per generation, stream still completes or fails through the normal final-parse path.
6. **Client regressions:** excalidraw.com dev client against this server — streaming canvas preview still animates (its 300 ms renderer now receives ~4 fps instead of ~10–35 fps of which it rendered ~3; visually equivalent), stop/retry/insert flows unchanged. TTD (separate route/parser) untouched.

## 7. Performance accounting (honest math against the live numbers)

- **Run A (fresh, 5 elements; §5):** 11 partials, 10 inter-arrival gaps × 28–144 ms ⇒ emitting window T ≈ 0.3–1.4 s (≈0.9 s at the midpoint cadence). Gated attempts in-window ≈ ⌊T/250 ms⌋ + 1 = **2–6 (≈4 typical)** vs 11 — a ~2–3× frame cut; dedupe independently collapses runs like the 715 B triple. Bytes: frames grew 52 B → ~2 KB, Σ ≈ 11 KB; ~4–6 surviving frames skew *later/larger* on the same growth curve ⇒ ≈4–7 KB — byte savings are real but smaller than the frame-count ratio on a run this tiny.
- **Run B (follow-up, `full`; §5):** 18 partials → 3.2 KB frames; same cadence ⇒ T ≈ 0.5–2.4 s ⇒ **3–10 expected** vs 18 (~2–4× fewer).
- **Asymptotics (the actual point):** for an 8k-token response (`MAX_TTA_TOKENS = 8192`, ~30 KB of EXML) with d per-token-ish deltas, today's cost is Σᵢ O(nᵢ) ≈ **O(n·d/2)** full layout-pipeline runs and **O(P·d/2)** SSE bytes. After: attempts k = ⌊T_wall/250 ms⌋ + 1 — a 30–60 s stream caps at **121–241 attempts regardless of d** — giving **O(n·k)** CPU and **O(P·k)** bytes (further minus dedupe). The bound is wall-clock-driven and independent of provider chunking, which is what "throttled" must mean for a server under N concurrent generations.
- Throttling cannot recover the per-frame O(P) snapshot cost — that's the delta-ops follow-up (§8), explicitly out of scope here.

## 8. Acceptance criteria

- [ ] All three emission paths (main non-additive, main additive, `requestTtaFix`) run through `createPartialEmitGate`: attempts ≥250 ms apart after an always-allowed first attempt, never on unchanged input, and no consecutive emission with identical `{skeletons, isComplete}`.
- [ ] A small additive follow-up (the §5 *"rename box A to X"* repro) emits **≥1 partial**; the first one arrives as soon as the additive root tag has streamed (QA §6e-3).
- [ ] `ADDITIVE_PARTIAL_MIN_INTERVAL_MS` / `ADDITIVE_PARTIAL_MIN_DELTA_CHARS` are gone from `tta.ts`; the single knob is `PARTIAL_EMIT_MIN_INTERVAL_MS = 250` in `partialEmit.ts`; the double `additiveNextPartialAttemptAt` assignment no longer exists (L1 closed — `markAttempted` is the only timing write).
- [ ] `done` still carries the final full skeletons; a partial whose parse flips only `isComplete` is still emitted (dedupe key includes the flag); the additive pending-root-op break still precedes any parse.
- [ ] Additive merge failures are still swallowed (stream survives) but produce exactly one `[TTA] Partial preview build failed mid-stream` info log per generation.
- [ ] `npx nx test server-tta` passes including the new `partialEmit.test.ts`; repo typecheck/lint clean; no changes outside `libs/server/tta` (routes, client, `@global/types` untouched).
- [ ] Manual QA §6e: fresh-run partial count drops to ≈⌊window/250 ms⌋+1 with ≥250 ms inter-arrival and zero byte-identical consecutive frames; client streaming preview, stop, retry, TTD all behave as before.

## 9. Follow-ups (do not bundle)

- **Delta-ops protocol** — emit `{op: "patch"}` element diffs instead of full snapshots to cut the per-frame O(P) wire cost too; needs client + `@global/types` changes and a versioned chunk shape (touches the tta.md §3 "single source of truth for types" item). The gate is the prerequisite either way.
- **M9 — hallucinated-target fallback**: the new once-per-generation log will produce the first real-world frequency data for failed additive merges; use it to justify the `op: "full"` fallback in `replaceAdditiveExml`/`mergeAdditiveExml` consumers.
- **Client M1 — trailing flush in the preview throttle**: with the server now pacing at 250 ms, a chunk parked inside the client's 300 ms window still renders only on the *next* chunk; the stall window shrinks but the missing `setTimeout(remaining)` flush ([useAIStreamingCanvasPreview.ts:278-313](packages/excalidraw/TTA/useAIStreamingCanvasPreview.ts#L278-L313)) remains worth fixing client-side.
- **Partial `isComplete` end-to-end**: the client hardcodes it to `false` ([client.ts:255-259](packages/excalidraw/TTA/client.ts#L255-L259), tta.md §3 type-drift item). Once [tta_c2.md](tta_c2.md)'s stream-end signaling lands, decide whether partial-`isComplete` should drive any UI (e.g. "finalizing…" state between last partial and `done`) — until then it stays advisory and droppable.
- **Adaptive interval** (only if metrics demand): grow `minIntervalMs` with `accumulated.length` so very large responses spend a bounded *fraction* of wall-clock parsing (e.g. interval ≥ k·lastParseDuration); the gate's option bag is shaped for this.
- **S2 interplay**: S2's "refund only if nothing meaningful streamed" heuristic proposed "no `partial` chunk yielded yet" as a signal — note that throttling slightly delays the first partial (≤250 ms + first-parse success), which marginally *widens* the refund window; fine, but whoever implements S2 should know the first-partial timestamp is now gate-shaped.
