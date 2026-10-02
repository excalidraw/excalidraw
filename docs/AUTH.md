# Authentication and sessions

Authentication is entirely local: there is no external identity provider and nothing calls Excalidraw's production auth. (`server/src/routes/auth.ts`, `server/src/repos/sessions.ts`, `server/src/security/`)

## Accounts

`POST /api/v1/auth/register` — `{ email, password, displayName }`

- Email is trimmed, lower-cased for uniqueness (`emailLower` has a unique index) and validated.
- Passwords are 10–128 characters and hashed with **scrypt** (`N=2^15, r=8, p=1`, 16-byte random salt, Unicode NFKC-normalised) using Node's built-in `crypto`, so there is no native addon to compile. The stored form is `scrypt$N$salt$hash`, which lets parameters be raised later without a migration. The plaintext password is never stored or logged.
- Each new account gets a personal workspace so the dashboard is usable immediately.
- Duplicate emails return `409 email_taken`.

## Sessions

`POST /api/v1/auth/login` → `200` + `Set-Cookie: ew_session=…`

| Property | Value |
| --- | --- |
| Token | 256 random bits, base64url. Opaque: it carries no data. |
| At rest | Only `HMAC-SHA256(token, SESSION_SECRET)` is stored, so a database leak alone cannot be replayed as cookies. |
| Cookie | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when `COOKIE_SECURE`/production. |
| Lifetime | `SESSION_TTL_DAYS` (default 14). MongoDB's TTL index removes expired rows; expiry is also re-checked on every request. |
| Login | Every login creates a fresh session (no fixation). Wrong password and unknown email are indistinguishable in both response and timing (a dummy scrypt is run). |
| Logout | `POST /auth/logout` deletes the server-side session and clears the cookie. |
| Password change | `POST /me/password` requires the current password and **revokes every other session**. |
| Disabled users | `status: "disabled"` invalidates existing sessions and blocks login. |

Other endpoints: `GET /auth/me`, `PATCH /me` (display name, avatar URL — `http(s)` only).

## CSRF and origin protection

Cookie-authenticated, state-changing requests must pass all of:

1. `SameSite=Lax` cookie (browsers withhold it on cross-site POSTs),
2. `Origin` (when present) is in `ALLOWED_ORIGINS`,
3. a custom header `x-requested-with: excalidraw-workspace`, which a cross-site form cannot send and a cross-site `fetch` can only send after a CORS preflight that the API refuses.

The WebSocket handshake checks `Origin` as well (cross-site WebSocket hijacking). A test walks the route table and asserts that **every** state-changing cookie route rejects requests without the header.

## Rate limiting

- Global: 300 requests/minute per client IP.
- `register` / `login`: `AUTH_RATE_LIMIT_MAX` per minute (default 10) per IP **and email** for login.
- Expensive routes (AI, key management, telemetry) are limited **per session**, the public API and MCP **per API key**. Set `TRUST_PROXY` correctly behind a reverse proxy or every client will look like one IP.

## Authorization

Authentication only establishes _who_. What they may do is decided per resource on the server: workspace roles (`OWNER`/`ADMIN`/`MEMBER`), scene ownership and grants, share-link levels, and API-key scopes. See [ARCHITECTURE.md](ARCHITECTURE.md#authorization-model) and [SECURITY.md](SECURITY.md).

## Audit trail

Login success/failure, registration, logout, profile and password changes are written to `audit_logs` without secrets. Workspace-level actions (members, roles, scenes, sharing, API keys, AI settings) are visible to admins under **Settings → Audit log**.
