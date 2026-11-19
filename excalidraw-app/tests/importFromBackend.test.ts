import { vi } from "vitest";
import { importFromBackend } from "../data";

describe("importFromBackend", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty object and alerts when server responds with an error status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);

    const result = await importFromBackend("test-id", "test-key");

    expect(window.alert).toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it("returns empty object and alerts when network fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network connection lost"),
    );

    const result = await importFromBackend("test-id", "test-key");

    expect(window.alert).toHaveBeenCalled();
    expect(result).toEqual({});
  });
});
