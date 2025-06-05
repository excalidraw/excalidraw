import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { trackEvent } from "../analytics";
import * as common from "@excalidraw/common";
const sa_eventMock = vi.fn();
vi.mock("@excalidraw/common", () => ({isDevEnv: vi.fn(), // mock para isDevEnv
}));

describe("trackEvent", () => {let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {// Reseta mocks e configura window.sa_event
    sa_eventMock.mockClear();
    (globalThis as any).window = { sa_event: sa_eventMock };
    // Mock padrão para import.meta.env para a maioria dos testes - Define condições que geralmente permitiriam o rastreamento
    vi.stubGlobal("import", {
      meta: {
        env: {
          VITE_APP_ENABLE_TRACKING: "true",
          VITE_WORKER_ID: undefined,
          PROD: true, },},}); // simula ambiente de produção (sem logs no console.info)
    // Mock padrão para isDevEnv - retorna false para permitir rastreamento por padrão
    vi.mocked(common.isDevEnv).mockReturnValue(false);
    // Configura spies para console.info e console.error
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
      meta: {env: {VITE_APP_ENABLE_TRACKING: "false", VITE_WORKER_ID: undefined, PROD: true,},},});
    trackEvent("command_palette", "action");
    expect(sa_eventMock).not.toHaveBeenCalled();
  });

  it("should not track if VITE_WORKER_ID is defined", () => {
    vi.stubGlobal("import", {
      meta: {env: {VITE_APP_ENABLE_TRACKING: "true",VITE_WORKER_ID: "some-worker-id",PROD: true,},},});
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
    vi.mocked(common.isDevEnv).mockReturnValue(true); // Condição testada
    trackEvent("command_palette", "action"); // Categoria "command_palette" é permitida
    expect(sa_eventMock).not.toHaveBeenCalled();
  });

  it("should not track if window.sa_event is undefined", () => {
    (globalThis as any).window = {}; // Remove sa_event de window
    trackEvent("export", "download", "png", 1); // Categoria "export" é permitida
    expect(sa_eventMock).not.toHaveBeenCalled();
  });
});
