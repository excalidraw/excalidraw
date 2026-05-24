import { afterEach, describe, expect, it, vi } from "vitest";

import { postImportEvent, postSubscribe } from "./tfdrawApi";

describe("tfdrawApi", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("no-ops when telemetry is disabled", async () => {
    vi.stubEnv("VITE_TFDRAW_TELEMETRY_ENABLED", "false");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await postSubscribe("a@b.com", "landing");
    await postImportEvent("terraform_import_success");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts subscribe payload when enabled", async () => {
    vi.stubEnv("VITE_TFDRAW_TELEMETRY_ENABLED", "true");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    await postSubscribe("user@example.com", "post_import", "token");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/subscribe",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "user@example.com",
          source: "post_import",
          turnstileToken: "token",
        }),
      }),
    );
  });

  it("posts import event when enabled", async () => {
    vi.stubEnv("VITE_TFDRAW_TELEMETRY_ENABLED", "true");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    await postImportEvent("terraform_import_fail");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/event",
      expect.objectContaining({
        body: JSON.stringify({ event: "terraform_import_fail" }),
      }),
    );
  });
});
