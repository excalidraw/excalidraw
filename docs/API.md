# Public API, API keys and MCP

Two audiences, two doors:

|  | Browser app | Integrations and agents |
| --- | --- | --- |
| Base path | `/api/v1` | `/public/v1`, `/mcp` |
| Auth | session cookie + CSRF header | `Authorization: Bearer ewk_…` (cookies are ignored) |
| Surface | everything the UI does | scenes, diagrams, export — explicitly scoped |

## API keys

Create them in **Settings → API keys** (or `POST /me/api-keys`, `POST /workspaces/:id/api-keys`).

- Format: `ewk_<10 chars>_<43 chars>` (256-bit secret). **Shown once**, at creation or rotation.
- Stored as `HMAC-SHA256(secret, ENCRYPTION_KEY)` plus the public prefix; compared in constant time.
- **Personal keys** act as you (your permissions, including private scenes you own). Optionally locked to one workspace.
- **Workspace keys** (admins only) are service principals: they can only reach _that_ workspace's _workspace-visible_ scenes — never private ones — and die if their creator leaves the workspace.
- Scopes: `workspace:read` `scene:read` `scene:create` `scene:write` `scene:delete` `scene:export` `diagram:create`. Presets are offered in the UI.
- Optional expiry; **rotate** (same id, new secret, old one dead immediately) and **revoke**. Max 25 active keys per owner. `lastUsedAt` is tracked. Everything is audited (`API_KEY_CREATED/ROTATED/REVOKED`) without secrets.
- A key is only as strong as its owner: disabled users' keys stop working.
- Missing, malformed, unknown, expired and revoked keys all return the **same** `401 invalid_api_key`.
- Rate limit: `API_RATE_LIMIT_PER_MINUTE` (default 120) **per key**.

## REST (`/public/v1`)

```bash
KEY=ewk_…    # base URL: your server
curl -H "Authorization: Bearer $KEY" $BASE/public/v1/me
```

| Method & path | Scope | Notes |
| --- | --- | --- |
| `GET /me` | any | Key metadata; handy for checking a key. |
| `GET /workspace` | `workspace:read` | Workspace + folders. `?workspaceId=` for multi-workspace personal keys. |
| `GET /scenes` | `scene:read` | `?q=&folderId=&limit=&offset=`. Metadata only. |
| `POST /scenes` | `scene:create` | `{ name?, folderId?, data?: {elements, appState} }` |
| `GET /scenes/:id` | `scene:read` | Full scene incl. elements. |
| `PUT /scenes/:id/data` | `scene:write` | **Replace** elements. Needs `baseVersion`; `409 version_conflict` returns the current `version`. Elements you omit become tombstones so live editors see the removal. |
| `POST /scenes/:id/elements` | `scene:write` | **Add/update** elements without knowing the version (retries internally). Never lets an older version overwrite a newer one. |
| `POST /scenes/:id/diagram` | `diagram:create` + `scene:write` | `{ mermaid }` (no AI) **or** `{ prompt }` (workspace AI, its limits apply). Placed below existing content. |
| `GET /scenes/:id/export` | `scene:export` | Native `.excalidraw` JSON; `?includeFiles=true` embeds images. |
| `DELETE /scenes/:id` | `scene:delete` | Moves to trash. |
| `POST /diagrams/mermaid` | `diagram:create` | Convert only; nothing is saved. |

Errors are `{ "error": "<code>", "message": "…" }`. `403 insufficient_scope` names the missing scope; resources you cannot access are `404`, never `403`.

Images and PDFs/PNGs are produced by the browser (`Export` in the editor); the API exports the native document, which any Excalidraw can render.

## MCP

Enable with `ENABLE_MCP=true`. The server speaks MCP over Streamable HTTP (JSON responses):

```
POST $BASE/mcp        Authorization: Bearer ewk_…      Content-Type: application/json
```

Supported: `initialize`, `ping`, `tools/list`, `tools/call`, notifications, JSON-RPC batches. `tools/list` shows only the tools the key's scopes allow; `tools/call` re-checks.

| Tool | Scopes | Does |
| --- | --- | --- |
| `get_workspace` | `workspace:read` | Workspace and folders |
| `list_scenes` / `get_scene` | `scene:read` | Browse and read (large scenes are truncated with a note) |
| `create_scene` | `scene:create` | New scene, optional initial elements |
| `update_scene` | `scene:write` | Replace elements (needs `baseVersion`) |
| `add_elements` | `scene:write` | Add/update elements safely |
| `convert_mermaid` | `diagram:create` | Mermaid → elements, nothing saved |
| `create_diagram` | `diagram:create` `scene:write` | Mermaid or natural-language prompt → diagram in a scene |
| `create_wireframe` | `diagram:create` `scene:write` | UI wireframe from blocks (header, nav, hero, input, button, card, list, …) |
| `export_scene` | `scene:export` | Native `.excalidraw` document |
| `delete_scene` | `scene:delete` | Move to trash |

Tool failures come back inside the result (`isError: true`) so the model can react; protocol problems are JSON-RPC errors. Tool arguments and results are never logged.

### Claude Desktop / stdio clients

`server/bin/mcp-stdio.mjs` bridges stdio to the HTTP endpoint:

```json
{
  "mcpServers": {
    "excalidraw-workspace": {
      "command": "node",
      "args": ["/path/to/repo/server/bin/mcp-stdio.mjs"],
      "env": { "EW_URL": "https://draw.example.com", "EW_API_KEY": "ewk_…" }
    }
  }
}
```

Use a **workspace key with only the scopes the agent needs**. It can never reach another workspace or any private scene, whatever it asks for.

## Internal REST (`/api/v1`) at a glance

Cookie-authenticated; used by the web app. Main groups: `auth`, `me`, `workspaces` (+ `members`, `audit`, `folders`, `scenes`, `library`, `ai`, `api-keys`), `scenes/:id` (`data`, `files`, `thumbnail`, `duplicate`, `restore`, `permanent`, `shares`, `permissions`, `links`, `comments`), `share/:token` (public capability URLs), `libraries/personal`, `telemetry`, `config`. The route table is enumerated by a test that asserts every route requires authentication unless it is on a short, explicit allow-list.
