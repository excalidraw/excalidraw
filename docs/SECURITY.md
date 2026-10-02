# Security

The rule everywhere: **the server decides**. The UI hides things you cannot do, but every route re-checks identity, role, resource access and scope on its own.

## Threat model in one paragraph

Defended against: unauthenticated access, other users/workspaces reading or changing your scenes (IDOR), view-only users modifying scenes, stolen database dumps, stolen/rotated credentials, CSRF and cross-site WebSocket hijacking, XSS through user content, injection into MongoDB, SSRF through admin-supplied AI endpoints, secret leakage into logs, and resource exhaustion. **Out of scope:** a compromised server host, a malicious workspace _owner_ against their own workspace, and denial of service beyond the per-route limits (put a reverse proxy/CDN in front of a public deployment).

## Controls

| Area | Control | Where |
| --- | --- | --- | --- | --- | --- | --- |
| Passwords | scrypt, per-user salt, NFKC-normalised, 10–128 chars; constant-work login for unknown emails | `security/password.ts` |
| Sessions | 256-bit opaque token; only its HMAC is stored; HttpOnly + SameSite=Lax (+Secure); TTL index; revoked on password change | `repos/sessions.ts` |
| CSRF | SameSite + `Origin` allow-list + custom header, on all cookie-authenticated state changes (route-table test) | `app.ts` |
| CORS | Reflects only `ALLOWED_ORIGINS`; credentials only for those | `app.ts` |
| Authorization | Central `RBAC`, `resolveSceneAccess`, per-route checks; unauthorized == not found | `security/rbac.ts`, `access.ts` |
| Route inventory | A test enumerates every route and fails if any is reachable without auth outside an explicit allow-list | `test/security.test.ts` |
| Share links | 256-bit tokens, HMAC lookup + AES-GCM copy, expiry, revocation kicks live sockets, uniform 404, rate limited | `routes/shares.ts` |
| API keys / MCP | Hashed, scoped, workspace-confined, per-key rate limit, disabled-owner and removed-member aware | `apiKeys.ts`, `publicOps.ts` |
| Realtime | Auth at handshake, `Origin` check, view-only enforced server-side, payload/rate/connection caps | `collab/hub.ts` |
| Input validation | zod on every body/query; ids parsed to `ObjectId` or 404; regex search input escaped | `routes/*` |
| NoSQL injection | Typed values only; operator objects rejected by validation; `$`-prefixed field names refused in scenes, libraries and realtime frames | `security/objectKeys.ts` |
| Uploads | Allow-list of image types **with magic-byte verification**, 4 MB cap, id/path validation; served with `Content-Security-Policy: default-src 'none'; sandbox` + `nosniff` (so even an SVG cannot run script) | `sceneOps.ts` |
| XSS | React escaping everywhere; `http(s)`-only avatar URLs; `javascript:`/`data:` links stripped from scene and library elements | `sceneData.ts` |
| SSRF | Admin-supplied AI endpoints: `http(s)` only, no embedded credentials, metadata/link-local always blocked, private ranges optional, DNS resolved and checked | `ai/urlSafety.ts` |
| Secrets at rest | AI keys AES-256-GCM; API keys/session tokens/share tokens only as HMAC (share links also encrypted so owners can copy them) | `security/crypto.ts` |
| Secrets in logs | Cookie/authorization headers redacted; share tokens scrubbed from logged URLs; audit metadata sanitised (`pass | secret | token | key | hash…`); tool arguments and scene content are never logged | `app.ts`, `security/logScrub.ts`, `repos/audit.ts` |
| Headers | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Cross-Origin-Resource-Policy`, HSTS when cookies are Secure, `Cache-Control: no-store` on API responses | `app.ts` |
| Production guard | The server refuses to start in production with a placeholder `SESSION_SECRET`, non-Secure cookies, or localhost-only origins | `config.ts` |
| Rate limits | Global, auth (per IP + email), per-session for AI/keys/telemetry, per-key for API/MCP | `routes/*` |
| Audit log | Sign-ins, membership and role changes, scene lifecycle and sharing, API keys, AI settings — without secrets | `repos/audit.ts` |
| Privacy | `private` scenes are invisible even to workspace admins; trashed scenes visible only to owner/admin | `access.ts` |

## Deployment checklist

1. Serve over **HTTPS**; set `NODE_ENV=production` (turns on Secure cookies, HSTS, and the startup guard).
2. Generate `SESSION_SECRET` with `openssl rand -base64 48`; consider a separate `ENCRYPTION_KEY`. Back both up; losing them invalidates sessions/share links (and, for `ENCRYPTION_KEY`, stored AI keys).
3. Set `ALLOWED_ORIGINS` to your exact public origin(s) and `TRUST_PROXY` to the number of proxies in front.
4. Restrict MongoDB to the app (bind to localhost/private network, enable auth, use TLS if remote): `MONGODB_URI=mongodb://user:pass@host:27017/?authSource=admin`.
5. Terminate TLS and add a **Content-Security-Policy** at the proxy (a working starting point is in `deploy/nginx.conf`); keep `/embed/*` frameable if you use embeds.
6. Keep `AI_ALLOW_PRIVATE_BASE_URLS=false` unless a local model server is intended.
7. Enable `ENABLE_MCP` only if you use it, and issue keys with the narrowest scopes.
8. Back up MongoDB and the storage location together.

## Dependency hygiene

`yarn audit` is clean for the runtime code paths of the new workspaces except three findings that are **not reachable**, kept here so the decision is visible:

| Advisory | Why it is accepted |
| --- | --- |
| `ajv` ReDoS "when using the `$data` option" (via fastify's schema compiler) | We never enable `$data`, and route bodies are validated with zod, not user-supplied JSON schemas. |
| `image-size` JXL/HEIF/ICNS parser DoS (via `pptxgenjs`) | `pptxgenjs`' browser build does not include `image-size` (only its Node build reads image files from disk). Images here always arrive as data URLs. |

Transitive `fast-uri` and `@babel/runtime` are pinned to patched versions through root `resolutions`. Re-run `yarn audit --groups dependencies` after dependency changes. The rest of the monorepo's audit noise comes from upstream Excalidraw's own dev tooling and is unrelated to what this platform ships.

## Reporting

This is a self-hosted project: run your own review before exposing it to the internet, and report issues to whoever operates your deployment.
