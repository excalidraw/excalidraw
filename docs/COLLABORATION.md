# Realtime collaboration

Live editing, presence, comments and presentations share one WebSocket per open scene.

```
WS  /api/v1/collab/:sceneId          session cookie (members and users the scene was shared with)
WS  /api/v1/collab/share/:token      share-link token (the scene id is never revealed to link users)
```

Implementation: `server/src/collab/hub.ts` (rooms), `server/src/routes/collab.ts` (auth), `workspace-app/src/editor/useCollab.ts` (client).

## Protocol (JSON text frames)

| Direction | Message | Meaning |
| --- | --- | --- |
| server → client | `init` `{ you, users[], elements[], presentation }` | Room snapshot when you join or reconnect. |
| both | `elements` `{ elements[] }` | **Only the elements that changed.** Server → clients adds `from`. |
| both | `cursor` `{ x, y, tool, button, selected[] }` | Pointer and selection (throttled to ~25 Hz). |
| server → client | `join` / `leave` | Presence. |
| both | `present` `{ active, frameId, index }` | Live presentation (see below). |
| server → client | `comment` `{ op, comments \| ids }` | Comment created/updated/deleted. |
| server → client | `error` `{ code }` | e.g. `forbidden` when a view-only connection sends edits. |

## Conflict handling

No whole-scene broadcasts. Each element carries Excalidraw's `version` and `versionNonce`. An incoming element is accepted when its `version` is higher, or equal with a **lower** `versionNonce` (Excalidraw's own tie-break), so every peer converges regardless of arrival order. The client merges remote deltas with the editor's `reconcileElements`. Stale updates are dropped by the server and never forwarded.

Clients keep a map of the version they last shared for each element and send only the diff, which is also how **offline edits** are re-sent after a reconnect (the map is only advanced when a frame was actually handed to an open socket).

## Persistence

The room keeps the merged scene in memory and writes it back with the same version rule:

- every `flushIntervalMs` (5 s) while dirty,
- when the last participant leaves,
- on server shutdown.

While a live session is connected the client pauses its timer-driven HTTP autosave (it would only conflict with the room) and resumes automatically if the socket drops. Local drafts are written either way.

## Permissions are enforced on the server

- The handshake resolves the user's real access (`OWNER`/`EDIT`/`VIEW`) with the same function the REST routes use, or the share link's level.
- A `VIEW` connection can watch and share its cursor; its `elements`/`present` frames are rejected.
- Changing a user's permission, revoking a share link, removing a member, making a scene private or deleting it **closes affected sockets immediately** (`4403`/`4404`). Reconnecting re-authorizes.
- Limits: 4 MB frames, 5000 elements per frame, 50 000 per room, a token bucket per connection, 10 sockets per user per room, 200 per room. Element objects with `$`-prefixed keys are refused.
- Close codes: `4401` sign-in needed · `4403` forbidden (or access changed) · `4404` not found · `4429` too many connections. The client does not retry `44xx`.

## Presence and cursors

Users are shown in the header and as coloured remote cursors with names. Guests joining through a link appear as "Guest".

## Presentations

Slides are the scene's **frames**, ordered by `customData.slide` (falls back to reading order). `Present` goes fullscreen and navigates with `←/→/Space`, `Esc` to exit, `F` for fullscreen. Editors broadcast the current slide; everyone else gets a **Follow** banner and is locked to the presenter's slide in read-only mode. One presenter at a time; if the presenter disconnects the presentation ends for followers.

## Images

Image bytes upload independently of scene saves (even while HTTP autosave is paused) and collaborators fetch missing files by id when elements referencing them arrive.

## API writes reach live editors

Changes made through the public API or MCP are applied to the live room too (`hub.applyExternal`), so connected editors see agent edits immediately and the next room flush cannot undo them.
