export type TelemetryType =
  | "save_failure"
  | "ws_failure"
  | "export_failure"
  | "ai_error"
  | "client_error";

const last = new Map<string, number>();
const THROTTLE_MS = 30_000;

/**
 * Best-effort failure report to our own backend (never third parties).
 * Only a failure class + short message are sent: no drawing content, no tokens.
 * Identical reports are throttled so a flapping connection can't flood the log.
 */
export const report = (
  type: TelemetryType,
  message: string,
  context?: Record<string, string | number | boolean>,
) => {
  const msg = String(message ?? "").slice(0, 380);
  const key = `${type}:${msg}`;
  const now = Date.now();
  if ((last.get(key) ?? 0) + THROTTLE_MS > now) {
    return;
  }
  last.set(key, now);
  if (last.size > 200) {
    last.clear();
  }
  try {
    void fetch("/api/v1/telemetry", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: {
        "content-type": "application/json",
        "x-requested-with": "excalidraw-workspace",
      },
      body: JSON.stringify({ type, message: msg, context }),
    }).catch(() => {});
  } catch {
    /* reporting must never throw */
  }
};

export const installGlobalErrorReporting = () => {
  window.addEventListener("error", (e) =>
    report("client_error", e.message || "window error", {
      source: (e.filename || "").split("/").pop() || "",
    }),
  );
  window.addEventListener("unhandledrejection", (e) =>
    report(
      "client_error",
      `unhandled rejection: ${
        (e.reason as Error)?.message ?? String(e.reason)
      }`,
    ),
  );
};
