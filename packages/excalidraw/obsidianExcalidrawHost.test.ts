import {
  configureObsidianExcalidrawHost,
  getObsidianExcalidrawHost,
  hasObsidianExcalidrawHost,
  OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION,
  type ObsidianExcalidrawHostAdapter,
  type ObsidianExcalidrawHostDisposer,
} from "./obsidianExcalidrawHost";
import {
  allowDoubleTapEraser,
  attachInlineLinkSuggester,
  disableDoubleClickTextEditing,
  fetchFontFromVault,
  getMaxZoom,
  getSharedMermaidInstance,
  getZoomMax,
  getZoomMin,
  getZoomStep,
  hideFreedrawPenmodeCursor,
  isContextMenuDisabled,
  isPanWithRightMouseEnabled,
  isTouchInPenMode,
  runAction,
  syncElementLinkWithText,
  t2,
} from "./obsidianUtils";

import type { AppState } from "./types";

const createFakeHost = (): ObsidianExcalidrawHostAdapter => ({
  protocolVersion: OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION,
  isDoubleTapEraserEnabled: () => true,
  isRightClickPanEnabled: () => true,
  getZoomToFitMaxLevel: () => 2.5,
  isPenModeCrosshairVisible: () => false,
  isSingleFingerPanningEnabled: () => true,
  isDoubleClickTextEditingDisabled: () => true,
  getZoomStep: () => 0.125,
  getZoomMin: () => 0.2,
  getZoomMax: () => 42,
  isContextMenuDisabled: () => true,
  shouldSyncElementLinkWithText: () => false,
  loadFontFromFile: async () => undefined,
  getMermaid: async () => ({
    loaded: false,
    api: new Promise<never>(() => {}),
  }),
  runAction: () => {},
  getLabel: (key) => key,
  attachInlineLinkSuggester: () => ({
    isBlockingKeys: () => false,
    close: () => {},
  }),
});

describe("Obsidian Excalidraw host registry", () => {
  const disposers: ObsidianExcalidrawHostDisposer[] = [];

  afterEach(() => {
    while (disposers.length > 0) {
      disposers.pop()?.();
    }
  });

  const configure = (adapter: ObsidianExcalidrawHostAdapter) => {
    const dispose = configureObsidianExcalidrawHost(adapter);
    disposers.push(dispose);
    return dispose;
  };

  it("starts without requiring an Obsidian plugin or global app", () => {
    expect(getObsidianExcalidrawHost()).toBeNull();
    expect(hasObsidianExcalidrawHost()).toBe(false);
  });

  it("uses safe defaults or an explicit error without a configured host", async () => {
    expect(allowDoubleTapEraser()).toBe(false);
    expect(isPanWithRightMouseEnabled()).toBe(false);
    expect(getMaxZoom()).toBe(1);
    expect(hideFreedrawPenmodeCursor()).toBe(false);
    expect(disableDoubleClickTextEditing()).toBe(false);
    expect(isContextMenuDisabled()).toBe(false);
    expect(syncElementLinkWithText()).toBe(true);
    expect(t2("COMP_FRAME")).toBe("COMP_FRAME");
    expect(await fetchFontFromVault("vault/font.woff2")).toBeUndefined();
    expect(() =>
      attachInlineLinkSuggester(document.createElement("input")),
    ).toThrow("Obsidian Excalidraw host is not configured");
    await expect(getSharedMermaidInstance()).rejects.toThrow(
      "Obsidian Excalidraw host is not configured",
    );
  });

  it("routes settings production helpers through a structural fake", () => {
    configure(createFakeHost());

    expect(allowDoubleTapEraser()).toBe(true);
    expect(isPanWithRightMouseEnabled()).toBe(true);
    expect(getMaxZoom()).toBe(2.5);
    expect(hideFreedrawPenmodeCursor()).toBe(true);
    expect(disableDoubleClickTextEditing()).toBe(true);
    expect(getZoomStep()).toBe(0.125);
    expect(getZoomMin()).toBe(0.2);
    expect(getZoomMax()).toBe(42);
    expect(isContextMenuDisabled()).toBe(true);
    expect(syncElementLinkWithText()).toBe(false);
  });

  it("routes plugin services through the structural fake", async () => {
    const fontData = new ArrayBuffer(8);
    const mermaid = {
      loaded: false,
      api: new Promise<never>(() => {}),
    };
    const blocker = {
      isBlockingKeys: () => true,
      close: vi.fn(),
    };
    const loadFontFromFile = vi.fn(async () => fontData);
    const getMermaid = vi.fn(async () => mermaid);
    const hostRunAction = vi.fn();
    const getLabel = vi.fn((key: string) => `translated:${key}`);
    const hostAttachInlineLinkSuggester = vi.fn(() => blocker);
    configure({
      ...createFakeHost(),
      loadFontFromFile,
      getMermaid,
      runAction: hostRunAction,
      getLabel,
      attachInlineLinkSuggester: hostAttachInlineLinkSuggester,
    });

    expect(await fetchFontFromVault("vault/My%20Font.woff2")).toBe(fontData);
    expect(loadFontFromFile).toHaveBeenCalledWith("My Font.woff2");
    expect(await getSharedMermaidInstance()).toBe(mermaid);
    expect(getMermaid).toHaveBeenCalledOnce();

    runAction("card");
    expect(hostRunAction).toHaveBeenCalledWith("card");
    expect(t2("COMP_FRAME")).toBe("translated:COMP_FRAME");
    expect(getLabel).toHaveBeenCalledWith("COMP_FRAME");

    const input = document.createElement("textarea");
    expect(attachInlineLinkSuggester(input)).toBe(blocker);
    expect(hostAttachInlineLinkSuggester).toHaveBeenCalledWith(
      input,
      undefined,
      null,
      true,
    );
  });

  it("routes single-finger pen-mode panning through the structural fake", () => {
    configure(createFakeHost());

    expect(
      isTouchInPenMode(
        {
          penMode: true,
          activeTool: { type: "freedraw" },
        } as AppState,
        new MouseEvent("pointerdown"),
      ),
    ).toBe(true);
  });

  it("disposes registrations idempotently without clearing a newer host", () => {
    const disposeFirst = configure(createFakeHost());
    const newerHost = {
      ...createFakeHost(),
      getZoomMax: () => 84,
    };
    configure(newerHost);

    disposeFirst();
    disposeFirst();

    expect(getObsidianExcalidrawHost()).toBe(newerHost);
  });

  it("rejects an unsupported runtime protocol", () => {
    const incompatibleHost = {
      ...createFakeHost(),
      protocolVersion: 3,
    } as unknown as ObsidianExcalidrawHostAdapter;

    expect(() => configureObsidianExcalidrawHost(incompatibleHost)).toThrow(
      "Unsupported Obsidian Excalidraw host protocol: 3",
    );
    expect(getObsidianExcalidrawHost()).toBeNull();
  });
});
