import {
  COLOR_PALETTE,
  DEFAULT_ELEMENT_STROKE_PICKS,
  DEFAULT_STICKY_NOTE_BG,
  STICKY_NOTE_BACKGROUND_PICKS,
} from "@excalidraw/common";

import {
  getColorTargetAppStateUpdates,
  resolveColorTarget,
} from "../actions/colorTargets";
import { getDefaultAppState } from "../appState";

import { API } from "./helpers/api";

import type { AppState } from "../types";

const appState = (overrides: Partial<AppState> = {}): AppState =>
  ({
    ...getDefaultAppState(),
    selectedElementIds: {},
    editingTextElement: null,
    ...overrides,
  } as AppState);

describe("resolveColorTarget", () => {
  const note = API.createElement({ type: "stickynote", id: "note" });
  const label = API.createElement({
    type: "text",
    id: "label",
    containerId: "note",
  });
  const rectangle = API.createElement({ type: "rectangle", id: "rectangle" });
  const elements = [note, label, rectangle];

  it("follows the active tool when nothing is targeted", () => {
    const regular = resolveColorTarget(appState(), elements, "strokeColor");
    expect(regular.kind).toBe("regular");
    expect(regular.appStateKeys).toEqual(["currentItemStrokeColor"]);
    expect(regular.topPicks).toBe(DEFAULT_ELEMENT_STROKE_PICKS);
    expect(regular.excludedColors).toBeUndefined();

    const sticky = resolveColorTarget(
      appState({
        activeTool: {
          ...getDefaultAppState().activeTool,
          type: "stickynote" as const,
          customType: null,
        },
      }),
      elements,
      "backgroundColor",
    );
    expect(sticky.kind).toBe("sticky");
    expect(sticky.appStateKeys).toEqual([
      "currentItemStickynoteBackgroundColor",
    ]);
    expect(sticky.topPicks).toBe(STICKY_NOTE_BACKGROUND_PICKS);
    expect(sticky.customizableTopPicks).toBe("stickyNoteBackground");
    expect(sticky.excludedColors).toContain(COLOR_PALETTE.transparent);
  });

  it("classifies a note (and its label) as the sticky domain", () => {
    const target = resolveColorTarget(
      appState({ selectedElementIds: { note: true } }),
      elements,
      "strokeColor",
    );
    expect(target.kind).toBe("sticky");
    expect(target.appStateKeys).toEqual(["currentItemStickynoteStrokeColor"]);
  });

  it("writes both domains for a mixed selection but shows the regular picker", () => {
    const target = resolveColorTarget(
      appState({ selectedElementIds: { note: true, rectangle: true } }),
      elements,
      "strokeColor",
    );
    expect(target.kind).toBe("mixed");
    expect(target.appStateKeys).toEqual([
      "currentItemStrokeColor",
      "currentItemStickynoteStrokeColor",
    ]);
    expect(target.topPicks).toBe(DEFAULT_ELEMENT_STROKE_PICKS);
    expect(target.excludedColors).toBeUndefined();
  });

  it("treats the sticky label being edited as a sticky target even with no selection", () => {
    // `handleTextWysiwyg` deselects while editing; `changeProperty` still
    // targets the edited text explicitly
    const target = resolveColorTarget(
      appState({ editingTextElement: label }),
      elements,
      "strokeColor",
    );
    expect(target.kind).toBe("sticky");
  });

  it("normalizes transparent for the sticky defaults only", () => {
    const stickyStroke = resolveColorTarget(
      appState({ selectedElementIds: { note: true } }),
      elements,
      "strokeColor",
    );
    expect(
      getColorTargetAppStateUpdates(stickyStroke, COLOR_PALETTE.transparent),
    ).toEqual({ currentItemStickynoteStrokeColor: COLOR_PALETTE.black });

    const stickyBackground = resolveColorTarget(
      appState({ selectedElementIds: { note: true } }),
      elements,
      "backgroundColor",
    );
    expect(
      getColorTargetAppStateUpdates(
        stickyBackground,
        COLOR_PALETTE.transparent,
      ),
    ).toEqual({ currentItemStickynoteBackgroundColor: DEFAULT_STICKY_NOTE_BG });

    const regular = resolveColorTarget(
      appState({ selectedElementIds: { rectangle: true } }),
      elements,
      "backgroundColor",
    );
    expect(
      getColorTargetAppStateUpdates(regular, COLOR_PALETTE.transparent),
    ).toEqual({ currentItemBackgroundColor: COLOR_PALETTE.transparent });
  });
});
