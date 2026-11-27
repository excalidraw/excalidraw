import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { trackEvent } from "../analytics";
import * as common from "@excalidraw/common";
const sa_eventMock = vi.fn();
vi.mock("@excalidraw/common", () => ({
  isDevEnv: vi.fn(), // mock for isDevEnv
}));

describe("trackEvent", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset mocks and set up window.sa_event
    sa_eventMock.mockClear();
    (globalThis as any).window = { sa_event: sa_eventMock };

    // Default mock for import.meta.env for most tests – simulates conditions that normally allow tracking
    vi.stubGlobal("import", {
      meta: {
        env: {
          VITE_APP_ENABLE_TRACKING: "true",
          VITE_WORKER_ID: undefined,
          PROD: true,
        },
      },
    }); // simulate production environment (no console.info logs)

    // Default mock for isDevEnv – returns false to allow tracking by default
    vi.mocked(common.isDevEnv).mockReturnValue(false);

    // Set up spies for console.info and console.error
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(common.isDevEnv).mockReset();
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should not track if VITE_APP_ENABLE_TRACKING is not 'true'", () => {
    vi.stubGlobal("import", {
      meta: {
        env: {
          VITE_APP_ENABLE_TRACKING: "false",
          VITE_WORKER_ID: undefined,
          PROD: true,
        },
      },
    });
    trackEvent("command_palette", "action");
    expect(sa_eventMock).not.toHaveBeenCalled();
  });

  it("should not track if VITE_WORKER_ID is defined", () => {
    vi.stubGlobal("import", {
      meta: {
        env: {
          VITE_APP_ENABLE_TRACKING: "true",
          VITE_WORKER_ID: "some-worker-id",
          PROD: true,
        },
      },
    });
    trackEvent("command_palette", "action");
    expect(sa_eventMock).not.toHaveBeenCalled();
  });

  it("should not track if window is undefined", () => {
    const originalWindow = (globalThis as any).window;
    delete (globalThis as any).window;
    trackEvent("command_palette", "action");
    expect(sa_eventMock).not.toHaveBeenCalled();
    (globalThis as any).window = originalWindow;
  });

  it("should not track if category is not allowed", () => {
    trackEvent("menu", "open");
    expect(sa_eventMock).not.toHaveBeenCalled();
  });

  it("should not track if category is not in ALLOWED_CATEGORIES_TO_TRACK", () => {
    trackEvent("unknown_category", "action");
    expect(sa_eventMock).not.toHaveBeenCalled();
  });

  it("should not track if isDevEnv returns true", () => {
    vi.mocked(common.isDevEnv).mockReturnValue(true); // Test condition
    trackEvent("command_palette", "action"); // "command_palette" is an allowed category
    expect(sa_eventMock).not.toHaveBeenCalled();
  });

  it("should not track if window.sa_event is undefined", () => {
    (globalThis as any).window = {}; // Remove sa_event from window
    trackEvent("export", "download", "png", 1); // "export" is an allowed category
    expect(sa_eventMock).not.toHaveBeenCalled();
  });
});
