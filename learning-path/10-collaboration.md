# Module 10 — Collaboration

**Time:** 15-20 hours
**Goal:** Understand real-time sync, element reconciliation, and fractional indexing.
**Key files:** `excalidraw-app/collab/`, `packages/excalidraw/data/reconcile.ts`, `packages/element/src/fractionalIndex.ts`

---

## Architecture Overview

```
User A draws rectangle
  → Store detects change (delta)
  → Delta encrypted
  → Sent via Socket.io to server
  → Server broadcasts to all other users
  → User B receives encrypted delta
  → Decrypts and deserializes
  → Reconciles with local state (conflict resolution)
  → Applies to local Scene
  → Canvas re-renders
```

**Stack:**
- **Socket.io** — real-time WebSocket communication
- **Firebase Realtime Database** — persistent scene storage + presence
- **AES-GCM encryption** — end-to-end encryption (server can't read scenes)

---

## Conflict Resolution

**File:** `packages/excalidraw/data/reconcile.ts`

**The problem:** User A changes element X's color to red. User B changes element X's position to (100, 200). Both changes arrive at the server. Which wins?

**The answer:** Last-write-wins, using version numbers.

```typescript
function shouldDiscardRemoteElement(
  localAppState: AppState,
  local: ExcalidrawElement,
  remote: ExcalidrawElement,
): boolean {
  // If we created the element locally and it hasn't been synced yet, keep local
  if (local && isLocallyCreated(local, localAppState)) {
    return true;
  }

  // Higher version wins
  if (local.version > remote.version) {
    return true;   // local is newer
  }

  if (local.version < remote.version) {
    return false;  // remote is newer
  }

  // Same version — deterministic tie-break using nonce
  if (local.versionNonce <= remote.versionNonce) {
    return true;   // lower nonce wins (arbitrary but consistent)
  }

  return false;    // remote wins
}
```

**Why this works:**
- `version` is incremented on every mutation → higher version = more recent
- `versionNonce` is random → when versions are equal (simultaneous edits), both users deterministically pick the same winner (the one with the lower nonce)
- No coordination needed — every client independently reaches the same conclusion

**Limitation:** This is *last-write-wins*, not *merge*. If User A changes color and User B changes position simultaneously with the same version, one change is lost. In practice this is rare because version numbers differ by the time changes propagate.

---

## Fractional Indexing

**File:** `packages/element/src/fractionalIndex.ts`

### The problem

Elements are drawn in order. When User A moves element from position 5 to position 2, every element after position 2 needs to shift. That's O(n) version bumps broadcast to all users.

### The solution: string-based indices

Instead of array indices (0, 1, 2, 3...), use string indices that allow insertion between any two values:

```
Initial state:
  element[0].index = "a0"
  element[1].index = "a1"
  element[2].index = "a2"

Insert between a0 and a1:
  newElement.index = "a0V"    ← sorts between "a0" and "a1"

Result:
  "a0" < "a0V" < "a1" < "a2"  ← string comparison gives correct order
```

### How insertion works

```typescript
import { generateNKeysBetween } from "fractional-indexing";

// Generate 1 key between "a0" and "a1":
generateNKeysBetween("a0", "a1", 1);  // → ["a0V"]

// Generate 3 keys between "a0" and "a1":
generateNKeysBetween("a0", "a1", 3);  // → ["a08", "a0G", "a0V"]

// Append at end (after "a2", before nothing):
generateNKeysBetween("a2", null, 1);  // → ["a3"]
```

### Why strings?

- **No reindexing:** Inserting between two elements only creates one new index, not shifts
- **Infinite precision:** You can always insert between any two strings
- **Deterministic ordering:** String comparison gives total order
- **Collaboration-safe:** No conflicts from concurrent inserts at different positions

### Validation

`fractionalIndex.ts` has ~300 lines of validation because invalid indices break the entire z-ordering system:

```typescript
function validateFractionalIndices(elements: ExcalidrawElement[]) {
  for (let i = 1; i < elements.length; i++) {
    if (elements[i].index <= elements[i - 1].index) {
      // FATAL: indices out of order
      throw new Error("Invalid fractional index order");
    }
  }
}
```

Set `window.DEBUG_FRACTIONAL_INDICES = true` in the running app to enable validation.

### syncMovedIndices

When elements are reordered (drag to front/back, or bulk operations), `syncMovedIndices()` recalculates fractional indices for moved elements:

```typescript
function syncMovedIndices(elements: ExcalidrawElement[], movedElements: Map) {
  // For each moved element:
  //   Find its new neighbors
  //   Generate a fractional index between them
  //   Mutate the element with the new index
}
```

---

## The Collab System

**Files:**
- `excalidraw-app/collab/Collab.tsx` — main collaboration component
- `excalidraw-app/collab/Portal.tsx` — WebSocket abstraction

### Connection lifecycle

```
1. User opens shared link (URL contains room ID + encryption key)
2. Collab.tsx initializes:
   a. Connect to Socket.io server
   b. Connect to Firebase room
   c. Load existing scene from Firebase
   d. Join room (announce presence)
3. Ongoing:
   a. Local changes → encrypt → send via Socket.io
   b. Receive remote changes → decrypt → reconcile → apply
   c. Presence updates (cursor position, selected elements)
4. Disconnect:
   a. Clean up Socket.io connection
   b. Remove presence from Firebase
```

### Data flow for outgoing changes

```
User mutates element
  → Store detects delta
  → Collab batches changes (debounced)
  → Serialize to JSON
  → Encrypt with AES-GCM (key from URL hash)
  → Send via Portal (Socket.io)
  → Also persist to Firebase (for new joiners)
```

### Data flow for incoming changes

```
Socket.io message received
  → Decrypt with AES-GCM
  → Deserialize from JSON
  → reconcileElements(local, remote)
    → For each remote element:
      → shouldDiscardRemoteElement()?
        → Yes: keep local version
        → No: adopt remote version
  → replaceAllElements(reconciledElements)
  → Canvas re-renders
```

### Portal.tsx — WebSocket abstraction

The Portal manages the Socket.io connection and provides:

```typescript
class Portal {
  socket: Socket;
  roomId: string;
  roomKey: string;  // encryption key

  broadcastScene(updateType: "SCENE_INIT" | "SCENE_UPDATE", elements): void;
  broadcastIdleChange(userState: UserIdleState): void;
  broadcastMouseLocation(payload: { pointer, button, selectedElementIds }): void;
}
```

**Message types:**
- `SCENE_INIT` — full scene (sent when joining room)
- `SCENE_UPDATE` — incremental change (sent on mutations)
- `IDLE_STATE` — user's idle/active status
- `MOUSE_LOCATION` — cursor position + selection (for remote cursors)

---

## Encryption

**File:** `packages/excalidraw/data/encryption.ts`

All scene data is encrypted end-to-end:

```typescript
async function encryptData(key: string, data: Uint8Array): Promise<{
  iv: Uint8Array;
  encrypted: Uint8Array;
}> {
  const cryptoKey = await getCryptoKey(key);       // derive AES key
  const iv = crypto.getRandomValues(new Uint8Array(12));  // random IV
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    data,
  );
  return { iv, encrypted };
}
```

The encryption key is in the URL **hash** (after `#`), which is never sent to the server. This means the server stores encrypted blobs it cannot read.

---

## Presence and Remote Cursors

Each collaborator broadcasts their state periodically:

```typescript
{
  pointer: { x: number, y: number },    // scene coordinates
  button: "up" | "down",                // mouse button state
  selectedElementIds: string[],          // what they have selected
  username: string,
  color: { background: string, stroke: string },
}
```

The interactive canvas renders this as:
- A colored cursor at their pointer position
- Their username as a label
- Colored selection outlines on their selected elements

---

## Reading Strategy

### Pass 1: Reconciliation (3 hours)
1. Read `packages/excalidraw/data/reconcile.ts` — it's short (~200 lines)
2. Understand `shouldDiscardRemoteElement()` completely
3. Understand how `reconcileElements()` merges two element arrays

### Pass 2: Fractional indexing (4 hours)
1. Read `packages/element/src/fractionalIndex.ts`
2. Focus on `syncMovedIndices()` and `validateFractionalIndices()`
3. Experiment in console: `generateNKeysBetween("a0", "a1", 3)`

### Pass 3: Collaboration flow (6+ hours)
1. Read `excalidraw-app/collab/Collab.tsx` — focus on `initializeRoom()` and the onChange handler
2. Read `excalidraw-app/collab/Portal.tsx` — understand message types
3. Read `packages/excalidraw/data/encryption.ts`

### Pass 4: Remote cursors (2 hours)
1. Search for `remotePointerViewportCoords` in `InteractiveCanvas.tsx`
2. Find where remote cursors are rendered in `interactiveScene.ts`

---

## Exercises

1. Read `reconcile.ts`. Write out the conflict resolution rules in your own words. Create a table of scenarios: "User A version 5, User B version 5 — who wins?"
2. In the running app (if you have a second browser tab), open the same shared link in both tabs. Draw in one — watch the other update. Open DevTools Network tab — observe the WebSocket messages.
3. Read `fractionalIndex.ts`. Find `syncMovedIndices()`. Draw 5 elements, then move one from the back to the front. Check `index` values before and after.
4. Read `encryption.ts`. Understand the encrypt/decrypt cycle. Note that `crypto.subtle` is the Web Crypto API (browser built-in, not a library).
5. Open a shared link URL. Find the encryption key in the URL hash. Note how it's separate from the room ID.

---

**Next:** [Module 11 — Data Persistence](11-data-persistence.md)
