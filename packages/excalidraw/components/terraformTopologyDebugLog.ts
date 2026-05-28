/** Debug-mode NDJSON ingest (session b3f9b8). Remove after verification. */
export function debugTopologyLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = "pre-fix",
): void {
  // #region agent log
  fetch("http://127.0.0.1:7923/ingest/de798ee9-b1d9-4571-a526-b10e653d3365", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "b3f9b8",
    },
    body: JSON.stringify({
      sessionId: "b3f9b8",
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}
