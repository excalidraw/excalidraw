import {
  corsHeaders,
  errorResponse,
  handleOptions,
  jsonResponse,
  normalizeEmail,
  parseJsonBody,
  verifyTurnstile,
} from "../_shared";

type SubscribeBody = {
  email?: string;
  source?: string;
  turnstileToken?: string;
};

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;

  const body = await parseJsonBody<SubscribeBody>(request);
  if (!body) {
    return errorResponse(request, "Invalid JSON body", 400);
  }

  const email = normalizeEmail(body.email ?? "");
  if (!email) {
    return errorResponse(request, "Invalid email", 400);
  }

  const source = body.source;
  if (source !== "landing" && source !== "post_import") {
    return errorResponse(request, "Invalid source", 400);
  }

  const remoteip = request.headers.get("CF-Connecting-IP");
  const turnstileOk = await verifyTurnstile(
    body.turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    remoteip,
  );
  if (!turnstileOk) {
    return errorResponse(request, "Turnstile verification failed", 403);
  }

  try {
    await env.DB.prepare("INSERT INTO emails (email, source) VALUES (?1, ?2)")
      .bind(email, source)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("UNIQUE")) {
      return jsonResponse(request, { ok: true, duplicate: true });
    }
    console.error("subscribe insert failed", err);
    return errorResponse(request, "Failed to save email", 500);
  }

  return jsonResponse(request, { ok: true });
};

export const onRequestOptions: PagesFunction = async (context) =>
  handleOptions(context.request);
