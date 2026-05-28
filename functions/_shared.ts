const MAX_BODY_BYTES = 1024;

const ALLOWED_ORIGIN_SUFFIXES = [".pages.dev", ".pages.cloudflare.com"];

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) {
    return false;
  }
  if (origin === "https://tfdraw.dev" || origin === "http://localhost:8788") {
    return true;
  }
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:" && protocol !== "http:") {
      return false;
    }
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }
    return ALLOWED_ORIGIN_SUFFIXES.some(
      (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix),
    );
  } catch {
    return false;
  }
}

export function corsHeaders(
  request: Request,
  methods = "POST, OPTIONS",
): HeadersInit {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request),
      ...extraHeaders,
    },
  });
}

export function errorResponse(
  request: Request,
  message: string,
  status: number,
): Response {
  return jsonResponse(request, { ok: false, error: message }, status);
}

export async function parseJsonBody<T extends Record<string, unknown>>(
  request: Request,
): Promise<T | null> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function handleOptions(
  request: Request,
  methods = "POST, OPTIONS",
): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, methods),
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > 254 || !EMAIL_RE.test(normalized)) {
    return null;
  }
  return normalized;
}

export async function verifyTurnstile(
  token: string | undefined,
  secret: string | undefined,
  remoteip: string | null,
): Promise<boolean> {
  if (!secret) {
    return true;
  }
  if (!token) {
    return false;
  }
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteip) {
    body.set("remoteip", remoteip);
  }
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  if (!res.ok) {
    return false;
  }
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}

export async function incrementStat(
  stats: KVNamespace,
  key: string,
): Promise<void> {
  const currentRaw = await stats.get(key);
  const current = currentRaw ? parseInt(currentRaw, 10) : 0;
  const next = Number.isFinite(current) ? current + 1 : 1;
  await stats.put(key, String(next));
}
