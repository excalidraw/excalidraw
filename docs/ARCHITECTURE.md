# Architecture

The workspace platform is an **independent, self-hosted layer built around the unmodified open-source Excalidraw editor**. It never talks to excalidraw.com, plus.excalidraw.com or any hosted Excalidraw service, and nothing in it depends on those being reachable.

```
                    ┌──────────────────────────────────────┐
                    │  workspace-app  (Vite · React 19)    │
                    │  dashboard · editor page · settings  │
                    │  embeds @excalidraw/excalidraw       │
                    └───────────────┬──────────────────────┘
                                    │  HTTPS  +  WebSocket   (same origin, /api)
                    ┌───────────────▼──────────────────────┐
                    │  server  (Fastify · TypeScript)      │
                    │  auth · RBAC · scenes · sharing      │
                    │  comments · libraries · AI · API/MCP │
                    │  realtime hub (ws)                   │
                    └───────┬──────────────────┬───────────┘
                            │                  │
                   ┌────────▼───────┐   ┌──────▼──────────────┐
                   │    MongoDB     │   │  Object storage     │
                   │ (Compass-      │   │  local fs  |  S3    │
                   │  friendly)     │   │  (images)           │
                   └────────────────┘   └─────────────────────┘
                                 ▲
        AI providers (optional, admin-configured) ── OpenAI · Anthropic · Gemini · OpenRouter · local
```

## Repository layout

| Path | What it is |
| --- | --- |
| `packages/*`, `excalidraw-app/` | Upstream Excalidraw (MIT). **Not modified.** The workspace app consumes the editor from source through the same path aliases `excalidraw-app` uses. |
| `server/` | The backend: REST API, WebSocket realtime, MCP endpoint, MongoDB access. |
| `workspace-app/` | The new web client: sign-in, dashboard, folders, sharing, comments, presentations, exports, settings. |
| `docs/` | This documentation. |
| `e2e/` | Browser end-to-end tests (Playwright). |
| `deploy/` | Dockerfiles and the nginx config used by `docker-compose.yml`. |

The upstream `excalidraw-app` still works exactly as before as an anonymous, local-first editor.

## What is reused and what is new

| Capability | Source |
| --- | --- |
| Drawing, shapes, arrows, text, images, frames, libraries, PNG/SVG/JSON export | Upstream editor, unchanged |
| Mermaid → canvas (dialog) | Upstream `@excalidraw/mermaid-to-excalidraw`, runs in the browser, **no AI** |
| Element reconciliation (`version` / `versionNonce`) | Upstream `reconcileElements`, reused for realtime merging and conflict resolution |
| Accounts, workspaces, RBAC, scenes, folders, trash, search | New (`server/src/routes`, `workspace-app/src`) |
| Autosave engine (debounce, retry, offline drafts, optimistic concurrency) | New (`workspace-app/src/editor/AutosaveEngine.ts`) |
| Realtime rooms, presence, live presentations | New (`server/src/collab/hub.ts`, `workspace-app/src/editor/useCollab.ts`) |
| Comments, sharing, share links | New |
| Personal / workspace libraries | New, stored in the editor's native library-item format |
| Vector PDF export, editable PPTX export | New (`workspace-app/src/export`) |
| AI provider layer, limits, BYOK | New (`server/src/ai`) |
| Public REST API, API keys, MCP server | New |

## Scene data model

Scenes are stored in Excalidraw's own format: `{ elements, appState }`, where `appState` is reduced to document-level settings (background colour, grid). Viewport, zoom, selected tool and other per-user state stay in the browser. Because the format is unchanged:

- a scene can be exported as a normal `.excalidraw` file and opened in any Excalidraw;
- collaboration reuses the editor's element versioning instead of inventing a new CRDT;
- frames double as **slides** (order lives in each frame's `customData.slide`).

Images are not embedded in the scene document. Bytes go to object storage under `scenes/<sceneId>/<fileId>`; the scene only references `fileId`s.

## Saving: two paths, one truth

```
 editor change ─▶ local draft (IndexedDB) ─▶ debounce ─▶ PUT /scenes/:id/data   (optimistic version check)
                                                   └───▶ 409? merge with server copy, retry
 live session  ─▶ WebSocket delta ─▶ room ─▶ flushed to MongoDB (every 5 s and when the last editor leaves)
```

- Alone (or offline): the autosave engine writes the scene over HTTP with `baseVersion`. A concurrent save gets `409 version_conflict` **with the server copy**, the client merges with `reconcileElements` and retries. Failures back off exponentially and retry when the browser is back online. The local draft is only cleared after the server confirmed _that exact content_.
- In a live session the room owns persistence, so timer-driven HTTP saves pause (they would only fight the room with 409s) and resume automatically if the socket drops. Local drafts keep being written either way, so nothing is lost if the server or network disappears.
- Image bytes upload immediately and independently of scene saves (collaborators fetch them by id).

## Authorization model

Every route re-checks authorization on the server; nothing relies on hidden UI.

- **Workspace roles** (`OWNER`, `ADMIN`, `MEMBER`) are permission sets (`server/src/security/rbac.ts`). Adding a role means adding one entry.
- **Scene access** is the maximum of: scene owner → `OWNER`; workspace member on a `workspace`-visible scene → `EDIT` (workspace admins get delete/share rights); an explicit per-user grant → `VIEW` or `EDIT`. `private` scenes are visible only to their owner and explicit grants — not even workspace admins.
- **Share links** are 256-bit random tokens, stored as an HMAC (lookup) plus an AES-GCM ciphertext (so owners can copy the link again). They can be `VIEW` or `EDIT`, expire, and be revoked; revoking disconnects live guests immediately.
- **API keys / MCP** are scoped bearer credentials confined to a workspace. See [API.md](API.md).
- Unknown and unauthorized resources both return `404`, so ids can't be probed.

## Feature flags

`ENABLE_WORKSPACES`, `ENABLE_COMMENTS`, `ENABLE_PRESENTATIONS`, `ENABLE_AI`, `ENABLE_MCP`, `ENABLE_PPTX_EXPORT`. A disabled feature is **not registered** on the server (its routes return 404) and its UI is hidden. `ENABLE_WORKSPACES=false` gives single-user mode: every account keeps its personal workspace but cannot create shared ones or manage members.

## Design decisions worth knowing

- **MongoDB, not a relational schema.** Collections are validated with `$jsonSchema`, indexed for the dashboard queries, and sessions / AI usage expire through TTL indexes. See [DATABASE.md](DATABASE.md).
- **Server-authoritative realtime instead of the upstream E2E-encrypted rooms.** The upstream relay has no notion of users, so it cannot enforce "view-only". Our rooms authenticate every socket and drop edits from view-only connections on the server. The trade-off: the server can read scene content (like any workspace product with server-side persistence and search).
- **No editor forks.** Workspace UI lives around the editor (header bar, side panels, overlays). The few upstream affordances that point at hosted services (the library "Browse" button) are hidden with CSS.
- **PDF via glyph outlines.** Text is converted to real vector outlines from the editor's own font files so the PDF looks identical anywhere, and an invisible text layer keeps it searchable.
- **Providers via plain `fetch`.** No vendor SDKs for AI: fewer dependencies, one streaming implementation to audit, and the server controls exactly what leaves the machine.
