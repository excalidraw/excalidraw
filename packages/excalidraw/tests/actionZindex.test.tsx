import { vi } from "vitest";

import { CODES, KEYS } from "@excalidraw/common";

import {
  actionSendBackward,
  actionBringForward,
  actionSendToBack,
  actionBringToFront,
} from "../actions/actionZindex";

// Simulate macOS, where the "send to back" / "bring to front" shortcuts use
// CtrlOrCmd+Alt+[ / CtrlOrCmd+Alt+] (see https://github.com/excalidraw/excalidraw/issues/9535).
vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();
  return {
    __esmodule: true,
    ...module,
    isDarwin: true,
    KEYS: {
      ...module.KEYS,
      CTRL_OR_CMD: "metaKey",
    },
  };
});

const zIndexActions = [
  actionSendBackward,
  actionBringForward,
  actionSendToBack,
  actionBringToFront,
];

// names of z-index actions whose keyTest matches the given event
const matchingActionNames = (event: Partial<KeyboardEvent>) =>
  zIndexActions
    .filter((action) => (action.keyTest as any)?.(event))
    .map((action) => action.name);

describe("z-index keyboard shortcuts", () => {
  // The manager dispatches a shortcut only when *exactly one* action matches it
  // (manager.tsx: `if (data.length !== 1) return false`). If two match, both are
  // canceled and the shortcut does nothing — the #9535 bug on macOS, where
  // CtrlOrCmd+Alt+[ also satisfied the plain CtrlOrCmd+[ (send backward) test.
  it("CtrlOrCmd+Alt+[ matches only sendToBack", () => {
    const event = {
      [KEYS.CTRL_OR_CMD]: true,
      altKey: true,
      shiftKey: false,
      code: CODES.BRACKET_LEFT,
    } as Partial<KeyboardEvent>;
    expect(matchingActionNames(event)).toEqual(["sendToBack"]);
  });

  it("CtrlOrCmd+Alt+] matches only bringToFront", () => {
    const event = {
      [KEYS.CTRL_OR_CMD]: true,
      altKey: true,
      shiftKey: false,
      code: CODES.BRACKET_RIGHT,
    } as Partial<KeyboardEvent>;
    expect(matchingActionNames(event)).toEqual(["bringToFront"]);
  });

  it("plain CtrlOrCmd+[ / CtrlOrCmd+] still match send backward / bring forward", () => {
    expect(
      matchingActionNames({
        [KEYS.CTRL_OR_CMD]: true,
        altKey: false,
        shiftKey: false,
        code: CODES.BRACKET_LEFT,
      } as Partial<KeyboardEvent>),
    ).toEqual(["sendBackward"]);

    expect(
      matchingActionNames({
        [KEYS.CTRL_OR_CMD]: true,
        altKey: false,
        shiftKey: false,
        code: CODES.BRACKET_RIGHT,
      } as Partial<KeyboardEvent>),
    ).toEqual(["bringForward"]);
  });
});
