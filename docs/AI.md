# AI: text-to-diagram, providers and limits

Nothing here calls Excalidraw's services. AI is **off until a workspace admin (or the server environment) configures a provider**, and even then a request only goes from _your server_ to _the provider you chose_. Converting Mermaid to a diagram never uses AI.

## What members get

- In the editor: **⋮ More tools → Mermaid to Excalidraw** opens the editor's dialog.
  - **Mermaid** tab — paste Mermaid, see a live preview, insert. Works with no AI, no key, no server round trip.
  - **Text to diagram** tab (only when AI is available to you) — describe a diagram, refine it in a chat, insert editable shapes. A counter shows how many requests are left today.
- Over the API / MCP: `create_diagram` with a `prompt` (see [API.md](API.md)).

## Provider layer

`server/src/ai/providers.ts` — one interface, implemented with plain `fetch` (no vendor SDKs):

| Provider | Wire format | Notes |
| --- | --- | --- |
| `openai` | Chat Completions (streaming) | Fixed endpoint. |
| `anthropic` | Messages API (streaming) | `x-api-key` header, `anthropic-version`. |
| `gemini` | `streamGenerateContent?alt=sse` | Key sent in `x-goog-api-key`, never in the URL. |
| `openrouter` | OpenAI-compatible | Custom endpoint allowed. |
| `local` | OpenAI-compatible | Ollama, LM Studio, vLLM… No key required. Custom endpoint. |

`createProvider()` is the single place that maps a configured id to an implementation. Adding a provider means one class and one registry entry.

Upstream errors are mapped to a short, sanitised message (credentials are never echoed back) and `401/403` from a provider become `502 provider_error`, not `401` for your user.

## Configuration

**Per workspace (Settings → AI, admins only)**: enable/disable, provider, model, endpoint (custom-endpoint providers only), API key (bring your own), daily limits, and who may use it.

**Instance defaults (environment)** — used when a workspace has no settings of its own:

```
AI_PROVIDER=openai            # openai | anthropic | gemini | openrouter | local
AI_MODEL=gpt-4o-mini
AI_API_KEY=…                  # never committed; .env is git-ignored
AI_BASE_URL=http://127.0.0.1:11434/v1   # custom-endpoint providers
AI_DEFAULT_WORKSPACE_LIMIT=200          # requests / day (0 = unlimited)
AI_DEFAULT_USER_LIMIT=50
AI_ALLOW_PRIVATE_BASE_URLS=true         # default: true outside production
```

An instance key is only ever used for the **same provider it was issued for**: a workspace that switches to another provider without its own key becomes "not configured" instead of leaking the instance key.

## Keys

- Keys are **write-only**: the UI shows the last four characters; the API never returns them.
- Stored AES-256-GCM encrypted (`ENCRYPTION_KEY`, default `SESSION_SECRET`) in `ai_settings.apiKeyEnc`.
- Changing provider drops the previous provider's stored key.
- Audit entries (`AI_SETTINGS_CHANGED`) record _that_ a key changed, never the key.

## Limits

Two independent daily budgets (UTC day): per workspace and per member. Both are configurable per workspace; empty means "server default", `0` means unlimited. They are our own settings, not anyone's commercial quota.

- Consumption is atomic (conditional `$inc` upsert), so concurrent requests cannot overshoot; a test fires 8 parallel requests at a limit of 3 and exactly 3 succeed.
- A request that fails before producing output (provider down, bad key, no diagram returned) is **refunded**.
- Responses carry `X-Ratelimit-Limit` / `X-Ratelimit-Remaining`, which the editor's dialog displays.
- Usage rows expire by TTL index.

## Safety

- The system prompt is ours. `system` messages sent by the browser are dropped, and a conversation must start with a user turn. History is capped (30 messages / 24 000 characters).
- **SSRF guard** (`urlSafety.ts`) for admin-supplied endpoints: only `http(s)`, no credentials in the URL, cloud-metadata and link-local addresses always blocked, private ranges blocked when `AI_ALLOW_PRIVATE_BASE_URLS=false` (hostnames are resolved and every address checked). Fixed-endpoint providers cannot be given a custom URL at all.
- Client disconnects abort the upstream request.
- Provider output is treated as data: the streaming filter extracts only the Mermaid source (models love wrapping it in code fences and chatty prose, and the editor feeds the reply straight into its parser).

## Endpoints

| Route | Who | Purpose |
| --- | --- | --- |
| `GET /ai/providers` | signed-in | Provider catalogue. |
| `GET /workspaces/:id/ai/status` | members | `{ available, reason?, remaining }`. |
| `GET/PUT /workspaces/:id/ai/settings` | owner/admin | Read/change configuration (key write-only). |
| `POST /workspaces/:id/ai/test` | owner/admin | One tiny request to check credentials (free of quota). |
| `GET /workspaces/:id/ai/usage` | owner/admin | Today's counters. |
| `POST /workspaces/:id/ai/text-to-diagram/chat-streaming` | permitted members | SSE stream used by the editor dialog. |
| `POST /workspaces/:id/ai/generate-diagram` | permitted members | Prompt → Mermaid + elements (non-streaming). |
| `POST /diagrams/mermaid` | signed-in | Mermaid flowchart → elements, **no AI, no quota**. |

## Server-side Mermaid conversion

`server/src/diagram/mermaid.ts` converts **flowcharts** (`flowchart`/`graph`, all node shapes, labelled and styled links, `&` fan-out, subgraph bodies) to fully bound Excalidraw elements with a layered layout. Sequence, class, ER and other diagram types are converted by the editor's own dialog in the browser (`422 unsupported_diagram` from the API says so).
