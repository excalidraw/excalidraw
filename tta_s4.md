# S4 implementation proposal — order-assignment race: verified facts + hardening

Resolves finding **S4** from [tta.md](tta.md): *Verify `turn_order` / `message_order` race under concurrent sends*. S4 was filed as a "verify" item — §1–§2 of this document **are** that verification (performed against `excalidraw-plus` @ `dwelle/tta`, merge commit `226267446`), and the verdict differs from the finding's hypothesis in two important ways. The rest turns the verified state into a small, explicit fix.

Companion to [tta_c1.md](tta_c1.md) / [tta_c2.md](tta_c2.md) (same conventions: match code anchors by snippet, not line number; implementable without re-deriving the analysis). All changes are **server-only**, in `excalidraw-plus` — `libs/server/tta/src/lib/tta.ts` plus one new unit-test file and a migration-hygiene step. No client, protocol, or i18n changes. Scope is the order-assignment race only: not S1's status accounting, not M14 retention (notes for its owner in §10), no client single-flight (that's C1).

---

## 1. Verified: what is actually in the schemas (the S4 question)

The TTA tables are defined twice — `libs/server/db-schemas/src/lib/oss.ts` (OSS DB) and `libs/server/db-schemas/src/lib/excalidraw-plus.ts` (Plus DB). **The unique constraints S4 asked about exist in both.** Per table:

| Table | PK | Unique indexes | Other indexes | FKs (ON DELETE) |
|---|---|---|---|---|
| `tta_chats` | `id uuid` | — | plus only: `(workspace_id, user_id, updated_at desc)`, `(user_id, updated_at desc)` | — |
| `tta_chat_turns` | `turn_id uuid` | **`tta_chat_turns_chat_turn_order_idx (chat_id, turn_order)`** · `tta_chat_turns_current_message_idx (current_message_id)` | — | `chat_id → tta_chats.id` **cascade** · `current_message_id → tta_chat_turn_messages.message_id` **set null** |
| `tta_chat_turn_messages` | `message_id uuid` | **`tta_chat_turn_messages_turn_message_order_idx (turn_id, message_order)`** | `(turn_id, created_at desc)` | `turn_id → tta_chat_turns.turn_id` **cascade** |
| `tta_images` | `image_id uuid` | **`tta_images_turn_image_order_idx (turn_id, image_order)`** | — | `turn_id → tta_chat_turns.turn_id` **cascade** |
| `tta_errors` | `id uuid` | — | `(chat_id, created_at desc)`, `(turn_id)`, `(message_id)` | `chat_id` / `turn_id` / `message_id` → all **cascade** |

Receipts (drizzle schema):

```ts
// libs/server/db-schemas/src/lib/oss.ts:59-62  (identical in excalidraw-plus.ts:445-448, which adds .enableRLS())
  (table) => [
    uniqueIndex("tta_chat_turns_chat_turn_order_idx").on(table.chat_id, table.turn_order),
    uniqueIndex("tta_chat_turns_current_message_idx").on(table.current_message_id),
  ],
```

```ts
// libs/server/db-schemas/src/lib/oss.ts:89-95  (identical in excalidraw-plus.ts:475-481)
  (table) => [
    uniqueIndex("tta_chat_turn_messages_turn_message_order_idx").on(
      table.turn_id,
      table.message_order,
    ),
    index("tta_chat_turn_messages_turn_created_idx").on(table.turn_id, table.created_at.desc()),
  ],
```

And in the **committed migration SQL**, so this is not schema-file wishful thinking:

```sql
-- migrations/oss/0000_legal_newton_destine.sql:94-101 (same statements at the bottom of
-- migrations/excalidraw-plus/0022_green_clint_barton.sql)
CREATE UNIQUE INDEX IF NOT EXISTS "tta_chat_turn_messages_turn_message_order_idx" ON "tta_chat_turn_messages" USING btree ("turn_id","message_order");
CREATE UNIQUE INDEX IF NOT EXISTS "tta_chat_turns_chat_turn_order_idx" ON "tta_chat_turns" USING btree ("chat_id","turn_order");
CREATE UNIQUE INDEX IF NOT EXISTS "tta_images_turn_image_order_idx" ON "tta_images" USING btree ("turn_id","image_order");
```

So the "silent duplicate corruption" branch of S4 is off the table for any correctly-migrated database: a duplicate order **cannot be committed**. The question becomes what happens when the unique index *fires* — and whether the deployed databases are actually "correctly migrated" (⚠️ see §6: one of the two migration sets currently cannot reach production).

**Engine and isolation (verified):** both DBs are **PostgreSQL**, accessed via the `postgres` driver (postgres.js `3.4.8`) + `drizzle-orm/postgres-js` (`0.43.1`) — `libs/server/db/src/lib/db.ts:1-5`. Plus is Supabase (`PLUS_DATABASE.type: "supabase"`, which also sets a 30 s `statement_timeout` via the `Database` wrapper), OSS is PlanetScale-for-Postgres (`OSS_DATABASE`, `libs/global/constants/src/lib/database-constants.ts:20-27`) — same dialect, `drizzle-kit.config.ts` says `dialect: "postgresql"` for every DB. `db.db.transaction(fn)` is called **without a config** everywhere in TTA; drizzle's postgres-js session then runs plain `client.begin(...)` (`node_modules/drizzle-orm/postgres-js/session.cjs:121-134` — `setTransaction` only runs when a config is passed), i.e. plain `BEGIN` → session default isolation → **READ COMMITTED** on both managed services unless someone changes `default_transaction_isolation` cluster-side. Drizzle `0.43.1` does **not** wrap driver errors (its `errors.d.ts` exports only `DrizzleError`/`TransactionRollbackError`) — a constraint violation surfaces as a raw postgres.js `PostgresError` with string `code` (`"23505"`) and `constraint_name`; the repo already duck-types exactly this shape in `apps/api/src/routes/slideTemplates.ts:9-20`.

**M14 drive-by facts** (for the M14 owner, verified in both schemas + both migration files): every child FK cascades — `tta_chat_turns → tta_chats` CASCADE, `tta_chat_turn_messages → tta_chat_turns` CASCADE, `tta_images → tta_chat_turns` CASCADE, and `tta_errors` cascades on all three of chat/turn/message. So `truncateConversation`'s `DELETE FROM tta_chat_turns` does take messages, images **and error-forensics rows** with it. `tta_chat_turns.current_message_id` is ON DELETE SET NULL and carries a *unique* index (a message can be "current" for at most one turn). The zero-turn chat rows left behind by truncate (`tta.ts:1395-1411` only bumps `updated_at`, never deletes the chat) are confirmed.

## 2. Verified: where the race actually stands (this corrects the original finding)

`saveGenerationAttempt` (`tta.ts:1051-1222`) does compute `coalesce(max(order),0)+1` via SELECT-then-INSERT, as the finding says. But look at the **statement order** inside the transaction — every path's *first* write is on the `tta_chats` row:

```ts
// tta.ts:1073-1101 (abridged)
    await db.db.transaction(async (tx) => {
      if (chat.persisted) {
        const updatedRows = await tx
          .update(chatTable)
          .set({ updated_at: nextUpdatedAtIso })          // ← row lock on the chat row
          ...
      } else {
        const [row] = await tx.insert(chatTable).values({ id: chat.id, ... })  // ← fresh UUID, no contention
      }
      // ...only then: SELECT coalesce(max(message_order|turn_order),0)+1 → INSERTs
```

Two concurrent attempts on the same persisted chat therefore **queue on that row UPDATE**: T2 blocks until T1 commits, and — because READ COMMITTED takes a fresh snapshot per statement — T2's subsequent `max(order)+1` SELECT *sees T1's committed rows* and computes a distinct order. The same holds for `existingTurn` retries (`message_order`, `tta.ts:1104-1116`), for `saveGeneration` and for `truncateConversation` (both also lead with the chat-row UPDATE — consistent lock order, no deadlock). The brand-new-chat path can't collide at all: the chat id is generated server-side per request (`createEphemeralConversation`, `tta.ts:824-835`), so two no-`chatId` sends make two distinct chats.

**So: on a correctly-migrated, read-committed Postgres, neither duplicate orders nor 23505 errors are reachable through concurrent `saveGenerationAttempt` calls today** — including C1's double-Enter and multi-tab sends. tta.md's worry "two concurrent generations can compute the same order" does not materialize as written.

What *is* wrong — and worth a small fix — is that this safety is an accident with no safety net:

1. **The serialization is implicit and undocumented.** Nothing marks the leading `UPDATE tta_chats` as load-bearing. Move it after the inserts, batch it away, or stop bumping `updated_at` in this transaction during a refactor, and the race silently opens — at which point the unique index turns it into an unhandled error (next point), or, on a drifted DB missing the index, into silent corruption (point 4).
2. **Isolation drift converts the queue into errors.** If `default_transaction_isolation` is ever raised to `repeatable read`/`serializable` (a one-line change in managed-DB settings), the blocked chat-row UPDATE becomes `40001 could not serialize access due to concurrent update`. And under RR even an advisory-lock-first design computes `max+1` against the transaction's *stale first-statement snapshot* → `23505`. Both are transient, retryable conditions.
3. **No conflict is handled anywhere.** A `PostgresError` is not a `TtaServiceError`, so `streamTta`'s outer catch (`tta.ts:2300-2307`) → `createStreamError` → `getTtaErrorResponse` (`tta.ts:788-804`) logs `[TTA] Unexpected error` and masks it to the generic `{ code: 500, message: "An internal server error occurred. Please try again later." }` stream-error chunk. No retry, user-visible failure; on the Plus route the rate-limit charge is also rolled back (`apps/api/src/routes/ai.ts:563-571`), compounding S2.
4. **If the unique index is missing** (hand-provisioned DB, or the ⚠️ migration-journal problem in §6), duplicates commit silently, and then: `loadPersistedGenerationContext` orders by `desc(turn_order)` with `limit(turnLimit)` and **no tie-breaker** (`tta.ts:906-907, 915-916`) → which duplicate enters the model context is plan-dependent; the retry join `lte(turnTable.turn_order, targetTurnTable.turn_order)` (`tta.ts:902`) drags the duplicate sibling in; `toConversationMessages`' `turn.turnOrder >= beforeTurnOrder` break (`tta.ts:340`) arbitrarily excludes a duplicate of the retry target; and `truncateConversation`'s `gt(turn_order, keepThroughTurnOrder)` (`tta.ts:1401-1410`) keeps *both* duplicates at the boundary and deletes *both* above it — "delete after X" stops meaning anything. Duplicate `message_order` muddles retry-attempt numbering (no functional reader today — `saveGeneration` updates by `message_id` — but it is the audit trail of attempts).
5. One genuinely reachable conflict today: **retry racing a truncate**. The `existingTurn` branch INSERTs the message (`tta.ts:1113-1125`) *before* the turn-existence check (`tx.update(turnTable)…` + 409 at `tta.ts:1127-1137`), so if a concurrent truncate deleted the turn, the FK fires first → `23503` → masked generic 500 instead of the intended `409 Retry target turn could not be found.`.

## 3. Desired behavior (blast-radius table)

| Concurrent scenario | Today (verified) | After fix |
|---|---|---|
| Two sends, same persisted chat (multi-tab; or C1 double-Enter once a chatId exists) | Accidentally serialized on the chat-row UPDATE → two turns, distinct contiguous `turn_order`s, both stream (client-side chaos is C1's department) | Same outcome, but serialization is explicit (advisory lock) with a retry net behind it |
| Same, but DB defaults raised to repeatable read / serializable | `40001` → unhandled → generic 500 error chunk (+ Plus refunds the rate limit) | Conflict retried with a fresh transaction/snapshot → succeeds with distinct orders |
| Two sends, no `chatId` yet (brand-new chat) | Two server-generated chat UUIDs → two separate chats; no DB contention | Unchanged (client dedup is C1) |
| Send + retry, same chat | Serialized on the chat row; `turn_order` and `message_order` live in different tables — no conflict | Unchanged + explicit |
| Two retries, same turn | Serialized; `message_order` 2 then 3 | Unchanged + explicit |
| Send (new turn) during truncate | Serialized on the chat row; either commit order is coherent (truncate-first → new `turn_order = keepThrough + 1`; send-first → the new turn is deleted by `gt(turn_order, …)`) | Unchanged + explicit |
| Retry during a truncate that deletes the target turn | `23503` FK violation on the message INSERT (fires *before* the 409 existence check) → masked generic 500 | With optional Step 3: clean `TtaServiceError` 409 (`Retry target turn could not be found.`); without it: unchanged |
| Any write on a DB **missing the unique indexes** (drift / hand-provisioning) | Silent duplicate orders → nondeterministic context loads, ambiguous truncates (§2.4) | Ruled out operationally: §6 repairs the migration journal so `migrate`-provisioned DBs get the indexes, and gives the reviewer SQL to verify any live DB |

Non-goals: rejecting concurrent generations per chat (server-side single-flight is a product decision — and note the advisory lock below is held only for the milliseconds of the attempt INSERT, **not** for the stream duration, so it is *not* a single-flight mechanism); S1's `finally`-status accounting; retention/M14.

## 4. Design — fix selection

Three candidate mechanisms, evaluated against the verified reality:

- **(a) Unique constraint + catch-conflict-and-retry.** The constraints already exist — nothing to add. The retry loop must re-run the **whole** `db.db.transaction(...)` call (Postgres aborts the transaction on the first error — `25P02` on any further statement — and postgres.js has already rolled back and re-thrown by the time we see it), which automatically recomputes `max(order)+1` against the winner's committed rows on each attempt. Bounded (3 attempts) because conflicts are only reachable via isolation drift or future refactors — anything persistent should surface, not loop.
- **(b) Per-chat serialization via `pg_advisory_xact_lock`.** Engine verified Postgres on both DBs; the repo already uses this **exact pattern with the exact same rationale** in `libs/server/services-user-api-keys/src/lib/user-api-keys.ts:97-104` ("There may be no row to lock yet… The unique index remains the final invariant; this transaction-scoped lock only makes the … read-then-write flow deterministic"). Transaction-scoped (`_xact_`) locks are also safe behind transaction-pooling proxies (relevant for PlanetScale's pooler), unlike session-scoped ones. One subtlety that makes (b) *insufficient alone*: under repeatable read, the transaction snapshot is established by the first query — which is the lock statement itself, *before* it blocks — so after unblocking, `max(order)+1` still reads a pre-winner snapshot → `23505`. The retry from (a) covers that (the fresh transaction takes a fresh snapshot).
- **(c) Atomic `INSERT … SELECT coalesce(max(order),0)+1`.** Rejected. A single statement removes the *statement gap* but not the race: under READ COMMITTED each statement's snapshot excludes the other transaction's uncommitted row, so two concurrent `INSERT…SELECT`s still both compute `N+1`; the second then blocks on the unique-index entry and fails with `23505` after the first commits — i.e. (c) **still needs the constraint as backstop and a retry for liveness**, while adding `.returning()` plumbing for `savedTurnOrder` and a harder-to-read query. In this codebase it is also strictly weaker than what the leading chat-row UPDATE already provides.

**Recommendation: (a)+(b)** — the unique indexes remain the invariant (keep them sacred; §6 makes sure they actually reach every environment), the advisory lock becomes the *documented* serialization mechanism replacing the accidental one, and a small bounded retry wrapper provides liveness for every residual conflict (`23505`, `40001`, defensively `40P01`). This matches the in-repo precedent, requires **no schema change**, and degrades gracefully at any isolation level.

Decisions locked in (so nobody re-litigates mid-implementation):

- **Lock key**: `pg_advisory_xact_lock(hashtext('tta_chat'), hashtext(chatId))` — the two-int form with a literal namespace keeps TTA's key space disjoint from the user-api-keys locks (which use the same two-int form keyed on user/workspace). `hashtext` is 32-bit, so two different chats *can* collide — harmless: a collision only over-serializes (brief queueing), never corrupts.
- **Lock placement**: first statement of the `saveGenerationAttempt` transaction only. `saveGeneration`, `truncateConversation`, `markGenerationAttemptStatus`, `saveParseError` compute no orders; they keep their existing (and still consistent) lock ordering. No deadlock is introduced: the only multi-lock order anywhere is advisory-chat-lock → chat row → child rows, and writers that skip the advisory lock take a strict subset starting at the chat row.
- **Retry detection**: duck-type the error's string `code` like `slideTemplates.ts` does — drizzle `0.43.1` passes postgres.js `PostgresError` through unwrapped (verified above; if drizzle is ever upgraded past 0.42-style `DrizzleQueryError` wrapping, check `error.cause` too — noted in the helper comment). `TtaServiceError.code` is a **number** (`tta.ts:774-783`), so the `typeof code === "string"` check naturally lets 404/409 service errors pass straight through.
- **No backoff** between attempts: the advisory lock already provides natural pacing (a retry blocks on the lock until the winner commits); a sleep would only add latency to the eager-started provider stream (`createEagerAsyncIterable` is already running while this persists — `tta.ts:2052-2085`).

## 5. Implementation steps

All in `excalidraw-plus/libs/server/tta/src/lib/tta.ts`. `sql` is already imported from `drizzle-orm` (line 1). Line numbers are from review time — match on the snippets.

### Step 1 — add the retry helper (module scope)

Find:

```ts
  return {
    status: TTA.ERRORS.SERVER_ERROR.code,
    code: TTA.ERRORS.SERVER_ERROR.code,
    message: TTA.ERRORS.SERVER_ERROR.message,
  };
};

const plusStoreAdapter: TtaStoreAdapter<typeof plus, TtaWorkspaceOwner> = {
```

Insert between the two blocks:

```ts
/**
 * Postgres error codes meaning "this transaction lost a concurrency race and
 * is safe to re-run from scratch" — re-running recomputes
 * `coalesce(max(order), 0) + 1` against the winner's committed rows:
 * - 23505 unique_violation: duplicate (chat_id, turn_order) /
 *   (turn_id, message_order) — reachable only if the per-chat serialization
 *   in `saveGenerationAttempt` is bypassed or the isolation level is raised
 *   above read committed (stale first-statement snapshot under RR).
 * - 40001 serialization_failure: same isolation-drift scenario, surfacing at
 *   the chat-row UPDATE instead.
 * - 40P01 deadlock_detected: defensive; TTA writers take locks in a
 *   consistent order (advisory chat lock → chat row → child rows).
 * `TtaServiceError.code` is a number, so service errors never match.
 * NOTE: drizzle-orm 0.43.x re-throws the postgres.js `PostgresError`
 * unwrapped; if drizzle is upgraded to a version that wraps driver errors
 * (`DrizzleQueryError`), extend this to also inspect `error.cause`.
 */
const RETRYABLE_ORDER_CONFLICT_CODES = new Set(["23505", "40001", "40P01"]);
const ORDER_ASSIGNMENT_MAX_ATTEMPTS = 3;

const getPostgresErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const maybeError = error as { code?: unknown };
  return typeof maybeError.code === "string" ? maybeError.code : undefined;
};

const withOrderAssignmentRetry = async <T>(
  context: { chatId: string; turnId: string },
  run: () => Promise<T>,
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const code = getPostgresErrorCode(error);
      if (
        !code ||
        !RETRYABLE_ORDER_CONFLICT_CODES.has(code) ||
        attempt >= ORDER_ASSIGNMENT_MAX_ATTEMPTS
      ) {
        throw error;
      }
      console.warn("[TTA] Retrying generation-attempt transaction after conflict", {
        ...context,
        code,
        attempt,
      });
    }
  }
};
```

### Step 2 — wrap `saveGenerationAttempt`'s transaction and take the lock

Find (top of the persistence block in `saveGenerationAttempt`):

```ts
    const nextUpdatedAt = Date.now();
    const nextUpdatedAtIso = toIsoString(nextUpdatedAt);
    let savedTurnOrder: number | undefined;

    await db.db.transaction(async (tx) => {
      if (chat.persisted) {
```

Replace with:

```ts
    const nextUpdatedAt = Date.now();
    const nextUpdatedAtIso = toIsoString(nextUpdatedAt);
    let savedTurnOrder: number | undefined;

    await withOrderAssignmentRetry({ chatId: chat.id, turnId: attempt.turnId }, () =>
      db.db.transaction(async (tx) => {
        // Serialize order assignment per chat. Concurrent attempts on a
        // persisted chat already queue on the `tta_chats` row UPDATE below,
        // but that is an accident of statement order — this lock is the
        // documented mechanism (same pattern as user-api-keys.ts) and also
        // covers paths with no chat row to lock yet. The unique indexes on
        // (chat_id, turn_order) / (turn_id, message_order) remain the final
        // invariant; `withOrderAssignmentRetry` provides liveness if a
        // conflict slips through anyway (S4 in tta.md).
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('tta_chat'), hashtext(${chat.id}))`,
        );

      if (chat.persisted) {
```

Find the matching transaction close (unique by the trailing `chat.persisted` flip):

```ts
            })),
          );
        }
      }
    });

    if (!chat.persisted) {
      chat.persisted = true;
    }
```

Replace with:

```ts
            })),
          );
        }
      }
      }),
    );

    if (!chat.persisted) {
      chat.persisted = true;
    }
```

⚠️ The ~115-line transaction body keeps its old indentation on purpose (smallest reviewable diff; JS doesn't care). Run the repo formatter afterwards to normalize it: `pnpm prettier --write libs/server/tta/src/lib/tta.ts`.

Why wrapping is safe to re-run: every in-memory mutation (`chat.persisted = true`, `chat.turns.push(...)`, `targetTurn.updatedAt = ...`) happens **after** the awaited wrapper (`tta.ts:1192-1221`), and a failed attempt is fully rolled back by postgres.js before re-entry — including the not-yet-persisted chat INSERT, which simply re-inserts on the next attempt. `nextUpdatedAt` staying fixed across attempts only affects timestamps.

### Step 3 (optional, recommended — separate commit) — clean 409 for retry-vs-truncate

The `existingTurn` branch INSERTs the message before the turn-existence check, so a concurrently-truncated turn surfaces as FK `23503`, not as the prepared 409 (§2.5). Map it in the helper's catch. Find (inside `withOrderAssignmentRetry` from Step 1):

```ts
      const code = getPostgresErrorCode(error);
      if (
```

Insert directly above the `if (`:

```ts
      if (code === "23503") {
        const maybeFk = error as { constraint_name?: string; message?: string };
        const turnFk = "tta_chat_turn_messages_turn_id_tta_chat_turns_turn_id_fk";
        if (maybeFk.constraint_name === turnFk || maybeFk.message?.includes(turnFk)) {
          // A concurrent truncate deleted the retry-target turn between
          // context load and the message INSERT (the 409 existence check in
          // the existingTurn branch sits *after* the INSERT, so the FK fires
          // first). Not retryable — the turn is gone; surface the same 409
          // the existence check would have produced instead of a masked 500.
          throw new TtaServiceError("Retry target turn could not be found.", 409);
        }
      }
```

(Constraint-name-or-message matching mirrors `apps/api/src/routes/slideTemplates.ts:9-20`; the FK name is verbatim from `migrations/oss/0000_legal_newton_destine.sql:61`. The insertion point sits after the `const code` line, which it references.)

## 6. Migration plan — none needed for the constraint, but two ⚠️ hygiene findings

**No new constraint migration is required**: the unique indexes are already in both drizzle schemas and both committed migration files (§1), and the fix itself is code-only. However, S4's verification surfaced two facts that determine whether those indexes actually exist where it matters — they are the *operational* half of "the constraint is the invariant":

⚠️ **Finding 1 — the Plus TTA migration cannot reach a `migrate`-provisioned database.** `migrations/excalidraw-plus/0022_green_clint_barton.sql` (the file that creates all five TTA tables + the unique indexes) is **not registered in `migrations/excalidraw-plus/meta/_journal.json`** — the journal's idx-22 entry is `0022_mushy_expediter` (a master-side migration that landed via the `226267446` merge; two files share the 0022 number). The repo's migration runner (`nx db <project> migrate` → `tools/tooling/src/libs/db.ts` → drizzle's `migrate()`) executes **journal entries only** (`node_modules/drizzle-orm/migrator.cjs:39-43`), so CI/prod `migrate` will silently never create the Plus TTA tables. Dev DBs are unaffected because they're provisioned with `nx db … push` (schema diff, no journal).

⚠️ **Finding 2 — schema/migration column drift in both DBs.** `model`, `web_search_enabled`, `web_search_used`, `web_search_sources` exist in both schema files (`oss.ts:76-82`, `excalidraw-plus.ts:462-468`) but in **no committed migration** (zero matches for `web_search` under `migrations/`). Same root cause: columns were added after the migrations were generated; only `push`-managed dev DBs have them.

**Repair, following the repo's actual convention** (drizzle-kit driven through the Nx executor; OSS project is `oss` per `databases/oss/project.json`, Plus rides on `apps/api`'s `db` target with `"db": "excalidraw-plus"`):

```bash
# Plus: remove the journal-orphaned file so drizzle regenerates cleanly on top
# of master's journal (its content is re-derived from the schema):
rm migrations/excalidraw-plus/0022_green_clint_barton.sql
pnpm nx db api generate        # → migrations/excalidraw-plus/0023_<name>.sql

# OSS: generate the drift catch-up on top of 0000:
pnpm nx db oss generate        # → migrations/oss/0001_<name>.sql
```

Expected generated content — verify before committing (drizzle names the files randomly; the statements are what matters):

- `migrations/excalidraw-plus/0023_<name>.sql`: the full TTA DDL currently in `0022_green_clint_barton.sql` (5 tables, RLS enables, cascade FKs, **the three unique order indexes**) *plus* the four drifted columns on `tta_chat_turn_messages`.
- `migrations/oss/0001_<name>.sql`: columns only (indexes already shipped in `0000`):

```sql
ALTER TABLE "tta_chat_turn_messages" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "tta_chat_turn_messages" ADD COLUMN "web_search_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tta_chat_turn_messages" ADD COLUMN "web_search_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tta_chat_turn_messages" ADD COLUMN "web_search_sources" jsonb DEFAULT '[]'::jsonb NOT NULL;
```

⚠️ Deploy-order / backfill: **the TTA feature is unreleased everywhere** — verified against `master`: no `libs/server/db-schemas/src/lib/oss.ts`, no `migrations/oss/`, and zero `tta` matches in master's `excalidraw-plus.ts`. The tables exist only in `dwelle/tta` dev environments (push-managed, hence already index-complete and column-complete). There is **no production data that could contain duplicates and no backfill question** — the regenerated migrations are safe to apply directly, and the branch's `CREATE … IF NOT EXISTS` guard style (commit `991e0162d`) makes them idempotent against push-provisioned dev DBs.

Verification SQL — for the reviewer to hand to whoever has DB access (run on **both** DBs; all three checks should be boring):

```sql
-- 1) The unique indexes exist:
select tablename, indexname, indexdef from pg_indexes
where tablename in ('tta_chat_turns', 'tta_chat_turn_messages', 'tta_images')
order by tablename, indexname;
-- expect: …chat_turn_order_idx UNIQUE (chat_id, turn_order),
--         …turn_message_order_idx UNIQUE (turn_id, message_order),
--         …turn_image_order_idx UNIQUE (turn_id, image_order)

-- 2) No duplicates have ever been committed:
select chat_id, turn_order, count(*) from tta_chat_turns
group by chat_id, turn_order having count(*) > 1;
select turn_id, message_order, count(*) from tta_chat_turn_messages
group by turn_id, message_order having count(*) > 1;
-- expect: zero rows from both

-- 3) The isolation assumption holds:
show default_transaction_isolation;   -- expect: read committed
```

## 7. Invariants to preserve (regression watch-list)

- **`savedTurnOrder` bookkeeping**: the in-memory `chat.turns.push({ turnOrder, … })` after the transaction must reflect the order the *successful* attempt inserted. It does — `savedTurnOrder` is assigned inside the transaction body (`tta.ts:1152`), so a retry overwrites it with the recomputed value before the push runs.
- **`TtaServiceError` semantics unchanged**: 404 (`Chat not found while saving generation.`) and 409s thrown inside the transaction still propagate on the first attempt (numeric `code` never matches the retry set) — `streamTta`'s `eagerStream.cancel()` + rethrow path (`tta.ts:2082-2085`) is untouched.
- **Eager stream overlap**: `saveGenerationAttempt` still resolves before `started` is yielded (`tta.ts:2087-2094`); retries only delay it by milliseconds (one blocked lock acquisition per attempt). No protocol change.
- **Lock ordering**: the advisory lock must remain the *first* statement of the transaction (before the chat UPDATE/INSERT) — taking it later could deadlock against another attempt that holds the lock and wants the chat row.
- **`markGenerationAttemptStatus` / `saveParseError`** stay lock-free single-row writes — they touch no order columns and must not start queueing behind generations (S1's fire-and-forget finalizer depends on them being cheap).
- The Plus route's rate-limit rollback on error chunks (`apps/api/src/routes/ai.ts:563-571`) now fires strictly less often (conflicts that used to 500 now succeed) — that's the intended direction (see S2).

## 8. Edge-case walkthrough (why 3 attempts is enough)

- **Two attempts, read committed (the normal world)**: T2 blocks on the advisory lock, T1 commits, T2's per-statement snapshots see T1's rows → distinct orders on the *first* attempt. The retry loop never runs. This is also exactly today's behavior, minus the accident.
- **Two attempts, repeatable read**: T2's snapshot predates T1's commit (taken at the lock statement) → `23505` on INSERT → attempt 2 starts a fresh transaction *after* T1 committed → fresh snapshot → success. Two attempts consumed; bound of 3 leaves headroom for a three-way race.
- **Retry wrapper meets a non-conflict error** (provider down mid-persist, FK violation without Step 3, statement timeout `57014` from Supabase's 30 s cap): not in the retry set → immediate rethrow → existing `streamTta` error path. No behavior change.
- **Conflict storm** (pathological: something keeps colliding): attempts exhaust at 3 → the last `PostgresError` propagates → today's generic-500 path, now preceded by two `[TTA] Retrying…` warns that make the diagnosis trivial.
- **hashtext collision between two unrelated chats**: their attempts briefly serialize against each other; orders are still computed per-chat from `max()` — correctness unaffected, only (negligible) latency.
- **PgBouncer/PSBouncer transaction pooling**: `pg_advisory_xact_lock` is transaction-scoped — released at COMMIT/ROLLBACK on whatever backend ran the transaction; no session-affinity assumptions. (The user-api-keys lock has the same dependency profile and ships today.)

## 9. Tests

**Infrastructure reality check** (so the strategy is honest): there is **no real-DB test infra** in `excalidraw-plus` — no testcontainers, no pglite, no test-database setup anywhere; DB-touching specs fully mock the transaction object (`libs/server/services-user-api-keys/src/lib/user-api-keys.spec.ts` is the canonical pattern: a hand-rolled `tx` with chained jest mocks, `plusDb as never`). The TTA lib's three existing test files are parser-level only. A genuine two-connection concurrency test therefore **cannot** run in CI today; the unique index is the guarantee, the unit tests pin the retry/lock *wiring*, and the manual QA below exercises the real race. (Real-DB infra is a follow-up, §11.)

### 9a. New `libs/server/tta/src/lib/tta.store.test.ts`

Export `withOrderAssignmentRetry` from `tta.ts` (prefix the Step 1 declaration with `export`, matching the inline `export const getTtaErrorResponse` style). Cases for the helper:

1. **retries on 23505 and succeeds**: `run` rejects once with `Object.assign(new Error("dup"), { code: "23505" })`, then resolves → resolves; `run` called twice; `console.warn` called once with `{ code: "23505", attempt: 1 }`.
2. **passes `TtaServiceError` through untouched**: `run` rejects with `new TtaServiceError("Chat not found while saving generation.", 404)` (numeric `code`) → rejects immediately, `run` called once. (If `TtaServiceError` isn't exported, assert with `Object.assign(new Error(), { code: 404 })` — the point is the numeric code.)
3. **bounded**: `run` always rejects with code `"23505"` → rejects with that error after exactly 3 calls.
4. **40001 retries, 23503 does not** (and, with Step 3, 23503 + `constraint_name: "tta_chat_turn_messages_turn_id_tta_chat_turns_turn_id_fk"` rejects with a 409 `TtaServiceError`).

Store-level wiring test (follows the `user-api-keys.spec.ts` mock shape):

```ts
import { oss } from "@server/db-schemas";
import { createOssTtaChatStore } from "./tta";

const createTxMock = () => ({
  execute: jest.fn().mockResolvedValue(undefined),
  update: jest.fn(() => ({
    set: () => ({
      where: () => ({ returning: jest.fn().mockResolvedValue([{ id: "chat-1" }]) }),
    }),
  })),
  select: jest.fn(() => ({
    from: () => ({ where: jest.fn().mockResolvedValue([{ nextTurnOrder: 2 }]) }),
  })),
  insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
});
```

5. **advisory lock is the first statement**: build `db = { schema: oss, db: { transaction: jest.fn((cb) => cb(tx)) } } as never`, call `store.saveGenerationAttempt` with a persisted chat / `existingTurn: false` → assert `tx.execute` was called before `tx.update`/`tx.insert` (jest `mock.invocationCallOrder`) and that its `sql` argument's query text contains `pg_advisory_xact_lock`.
6. **conflict re-runs the whole transaction**: make `db.db.transaction` reject first with `{ code: "23505" }` and delegate to a fresh `tx` on the second call → resolves; `transaction` called twice; the chat's in-memory `turns` got pushed exactly once with `turnOrder: 2`.

⚠️ If `@server/db-schemas` doesn't resolve under this lib's jest config (its `moduleNameMapper` currently only maps `@excalidraw/*`; the Nx preset usually handles tsconfig paths, and `user-api-keys.spec.ts` relies on that), add the one-line mapping rather than restructuring the test.

### 9b. Commands

```bash
pnpm nx test server-tta
pnpm nx typecheck server-tta   # or the repo's lint/typecheck pipeline for the lib
```

### 9c. Manual QA — hammer the dev oss-ai-server (localhost:3016)

Run from the machine where the dev server runs (IPv4 localhost is rate-limit-exempt via `RATE_LIMIT_ALLOW_LIST = ["127.0.0.1"]`; `::1` is not — use `127.0.0.1` explicitly, see tta.md §5):

```bash
BASE=http://127.0.0.1:3016

# 1) Create + persist a chat; capture chatId from the `started` frame.
#    (saveGenerationAttempt commits *before* `started` is emitted, so killing
#    the stream right after is safe — the chat row exists.)
CHAT_ID=$(curl -sN "$BASE/ai/tta/generate/stream" -H 'content-type: application/json' \
  -d '{"prompt":"draw a small red square"}' \
  | grep -m1 '"type":"started"' | sed 's/^data: //' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["chatId"])')
echo "chatId=$CHAT_ID"

# 2) Hammer: 6 parallel follow-ups against the SAME chat.
for i in 1 2 3 4 5 6; do
  curl -sN "$BASE/ai/tta/generate/stream" -H 'content-type: application/json' \
    -d "{\"prompt\":\"add a circle labeled $i\",\"chatId\":\"$CHAT_ID\"}" \
    -o "/tmp/tta_s4_$i.log" &
done
wait

# 3) Client-side check: no error frames, 6 distinct turnIds in `started` frames.
grep -h '"type":"error"' /tmp/tta_s4_*.log && echo "FAIL: error frames" || echo "OK: no error frames"
grep -h '"type":"started"' /tmp/tta_s4_*.log | sed 's/^data: //' \
  | python3 -c 'import json,sys; ids={json.loads(l)["turnId"] for l in sys.stdin}; print(len(ids), "distinct turnIds")'
```

Then hand this SQL to whoever has access to the dev OSS DB (or run via `pnpm nx db oss studio`):

```sql
-- expect turn_order = 1..7, strictly distinct, for the hammered chat:
select turn_id, turn_order, created_at from tta_chat_turns
where chat_id = '<CHAT_ID>' order by turn_order;

-- global duplicate check (expect zero rows):
select chat_id, turn_order, count(*) from tta_chat_turns
group by chat_id, turn_order having count(*) > 1;
```

Also watch the server log: any `[TTA] Unexpected error` during the hammer is a failure; `[TTA] Retrying generation-attempt transaction after conflict` is acceptable (and on read committed should not appear at all). For the retry-vs-truncate row of §3, repeat with two parallel curls: one `POST /ai/tta/chat/truncate` (`{"chatId": "...", "keepThroughTurnId": null}`) and one generation with `retry.retryAssistantMessageId` set — without Step 3 expect the generic 500 chunk; with Step 3 expect the 409 message.

## 10. Interplay notes

- **C1 / [tta_c1.md](tta_c1.md)** (client single-flight): removes same-tab double-sends, but multi-tab/multi-device concurrency reaches the server regardless — this server-side work stands on its own. Conversely, nothing here gives whole-stream single-flight: the advisory lock spans only the attempt INSERT (milliseconds), so two tabs still stream two generations into one chat concurrently — by design, with order integrity guaranteed. If product wants "one generation per chat at a time", that's a separate server feature (see follow-ups).
- **S1 / [tta_s1.md](tta_s1.md)** (parallel proposal): touches `streamTta`'s body/`finally` only (its own interplay note agrees: "same function family, zero overlapping lines; independent"); this proposal touches `saveGenerationAttempt` + module-scope helpers — textually disjoint, either merge order is conflict-free. Conceptually complementary on the same rows: S1 finalizes attempt *status*, S4 guarantees attempt *identity* (unique orders). S1's fire-and-forget `markGenerationAttemptStatus` is a single status UPDATE with no order computation — it must **not** acquire the advisory lock (watch-list §7).
- **M14** (retention/cascade, for its owner): the §1 verification answers M14's open question — **yes, the FK cascades fire**: truncating turns cascades to `tta_chat_turn_messages`, `tta_images`, and (note!) `tta_errors`, so truncate also destroys error forensics; superseded retry messages cascade only when their *turn* dies; zero-turn chat rows are confirmed to persist (`tta.ts:1395-1411`); `current_message_id` is SET NULL with a unique index.
- **S2** (abort refunds): fewer masked-500 error chunks ⇒ fewer rate-limit rollbacks on the Plus route — strictly helps.

## 11. Acceptance criteria

- [ ] §6 verification SQL run against the dev/staging OSS **and** Plus DBs shows all three unique order indexes present, zero duplicate `(chat_id, turn_order)` / `(turn_id, message_order)` groups, and `read committed`.
- [ ] `saveGenerationAttempt`'s transaction begins with `pg_advisory_xact_lock(hashtext('tta_chat'), hashtext(<chatId>))`, before the chat UPDATE/INSERT.
- [ ] A `23505`/`40001`/`40P01` from the attempt transaction re-runs the **whole** transaction (orders recomputed) at most 3 times; `TtaServiceError`s and all other errors propagate immediately on the first attempt.
- [ ] Hammer QA (§9c): 6 parallel sends against one chat produce 6 turns with distinct contiguous `turn_order`s, zero `error` frames, zero `[TTA] Unexpected error` logs.
- [ ] Plus migration journal repaired: the TTA DDL lives in a journal-registered migration (`0023_*`), `0022_green_clint_barton.sql` removed; `pnpm nx db api migrate` against a scratch DB creates all five TTA tables **with the unique indexes**; `pnpm nx db oss generate` catch-up migration covers the drifted `model`/`web_search_*` columns.
- [ ] New unit tests (§9a) pass: `pnpm nx test server-tta`; no client/protocol/i18n changes anywhere.
- [ ] (Step 3, if taken) retry racing a truncate yields the 409 `Retry target turn could not be found.` instead of a generic 500.

## 12. Follow-ups (do not bundle)

- **S1** (attempt rows stuck `pending`) — its `try/finally` in `streamTta` is the other half of attempt-row hygiene; land separately ([tta_s1.md](tta_s1.md)).
- **Server-side single-flight per chat** (product call): a `pg_try_advisory_xact_lock`-style guard or a "pending attempt exists" check could reject the second concurrent generation with a clean 409 — explicitly *not* what the S4 lock does (it serializes, never rejects).
- **Step 3 if deferred**: the 23503→409 mapping for retry-vs-truncate.
- **Hoist the lock if other writers ever compute orders**: `saveGeneration`/`truncateConversation` currently ride the implicit chat-row serialization; any future `max()+1` in them should take the same advisory lock (consider extracting a `lockTtaChat(tx, chatId)` helper mirroring `lockUserApiKeyPair`).
- **Real-DB test infra**: pglite (in-process Postgres, supports advisory locks + unique indexes) would make the §9c concurrency scenario a CI test — two `saveGenerationAttempt` calls on separate connections asserting distinct orders. Valuable beyond TTA (user-api-keys has the same untested concurrency reasoning).
- **Migration-journal lint**: the 0022 collision was silent; a CI check that every `migrations/*/[0-9]*.sql` file is journal-registered would have caught it (cheap script over `meta/_journal.json`).
