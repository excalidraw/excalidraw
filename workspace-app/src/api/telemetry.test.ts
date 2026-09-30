import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { report } from "./telemetry";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("telemetry", () => {
  it("posts a compact report with the CSRF header", () => {
    report("save_failure", "boom", { status: 503 });
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe("/api/v1/telemetry");
    expect(init.headers["x-requested-with"]).toBe("excalidraw-workspace");
    expect(JSON.parse(init.body)).toEqual({
      type: "save_failure",
      message: "boom",
      context: { status: 503 },
    });
  });

  it("throttles identical reports but lets different ones (and later repeats) through", () => {
    report("ws_failure", "closed 1006");
    report("ws_failure", "closed 1006");
    report("ws_failure", "closed 1011");
    expect((fetch as any).mock.calls).toHaveLength(2);
    vi.advanceTimersByTime(31_000);
    report("ws_failure", "closed 1006");
    expect((fetch as any).mock.calls).toHaveLength(3);
  });

  it("truncates long messages and never throws if fetch does", () => {
    report("client_error", "x".repeat(2000));
    expect(
      JSON.parse((fetch as any).mock.calls[0][1].body).message.length,
    ).toBe(380);
    (fetch as any).mockImplementationOnce(() => {
      throw new Error("offline");
    });
    expect(() => report("client_error", "another")).not.toThrow();
  });
});
