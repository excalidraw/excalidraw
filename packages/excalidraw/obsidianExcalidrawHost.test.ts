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
  disableDoubleClickTextEditing,
  getMaxZoom,
  getZoomMax,
  getZoomMin,
  getZoomStep,
  hideFreedrawPenmodeCursor,
  isContextMenuDisabled,
  isPanWithRightMouseEnabled,
  isTouchInPenMode,
  syncElementLinkWithText,
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

  it("routes settings-only production helpers through a structural fake", () => {
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
      protocolVersion: 2,
    } as unknown as ObsidianExcalidrawHostAdapter;

    expect(() => configureObsidianExcalidrawHost(incompatibleHost)).toThrow(
      "Unsupported Obsidian Excalidraw host protocol: 2",
    );
    expect(getObsidianExcalidrawHost()).toBeNull();
  });
});
