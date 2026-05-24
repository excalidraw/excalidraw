export type TfdrawSubscribeSource = "landing" | "post_import";

export type TfdrawImportEvent =
  | "terraform_import_success"
  | "terraform_import_fail";

const isTelemetryEnabled = () =>
  import.meta.env.VITE_TFDRAW_TELEMETRY_ENABLED === "true";

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  if (!isTelemetryEnabled()) {
    return null;
  }
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function postSubscribe(
  email: string,
  source: TfdrawSubscribeSource,
  turnstileToken?: string,
): Promise<{ ok: boolean; duplicate?: boolean } | null> {
  return postJson("/api/subscribe", {
    email,
    source,
    turnstileToken,
  });
}

export async function postImportEvent(
  event: TfdrawImportEvent,
): Promise<{ ok: boolean } | null> {
  return postJson("/api/event", { event });
}
