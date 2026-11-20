
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../data/firebaseSDK", () => {
  throw new Error("Firebase SDK intentionally unavailable in this test");
});

describe("Firebase configuration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const loadFirebase = async () => {
    return await import("../data/firebase");
  };

  it(
    "should handle valid Firebase configuration",
    async () => {
      const config = {
        apiKey: "test-api-key",
        projectId: "test-project",
        storageBucket: "test-bucket",
      };

      vi.stubEnv(
        "VITE_APP_FIREBASE_CONFIG",
        JSON.stringify(config),
      );

      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      await loadFirebase();

      expect(consoleWarn).not.toHaveBeenCalled();
    },
    15000,
  );

  it("should handle invalid Firebase configuration", async () => {
    vi.stubEnv("VITE_APP_FIREBASE_CONFIG", "invalid-json");

    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    await loadFirebase();

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining("Error JSON parsing firebase config"),
    );
  });

  it("should handle missing Firebase configuration", async () => {
    vi.stubEnv("VITE_APP_FIREBASE_CONFIG", undefined);

    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    await loadFirebase();

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining("Error JSON parsing firebase config"),
    );
  });
});
