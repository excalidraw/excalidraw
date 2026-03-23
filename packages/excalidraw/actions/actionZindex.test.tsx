import { vi } from "vitest";

import {
  actionBringForward,
  actionBringToFront,
  actionSendBackward,
  actionSendToBack,
} from "./actionZindex";

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();
  return {
    __esModule: true,
    ...module,
    isDarwin: false,
  };
});

const stubCtx = [{} as any, [] as any, {} as any] as const;

describe("actionZindex keyTest (non-mac)", () => {
  it("bringForward matches BracketRight and key-based ] (e.g. AltGr layouts)", () => {
    expect(
      actionBringForward.keyTest!(
        new KeyboardEvent("keydown", {
          key: "]",
          code: "BracketRight",
          ctrlKey: true,
        }),
        ...stubCtx,
      ),
    ).toBe(true);

    expect(
      actionBringForward.keyTest!(
        new KeyboardEvent("keydown", {
          key: "]",
          code: "Digit9",
          ctrlKey: true,
          altKey: true,
        }),
        ...stubCtx,
      ),
    ).toBe(true);
  });

  it("bringToFront matches BracketRight and key }", () => {
    expect(
      actionBringToFront.keyTest!(
        new KeyboardEvent("keydown", {
          key: "}",
          code: "BracketRight",
          ctrlKey: true,
          shiftKey: true,
        }),
        ...stubCtx,
      ),
    ).toBe(true);
  });

  it("sendBackward matches BracketLeft and key [", () => {
    expect(
      actionSendBackward.keyTest!(
        new KeyboardEvent("keydown", {
          key: "[",
          code: "BracketLeft",
          ctrlKey: true,
        }),
        ...stubCtx,
      ),
    ).toBe(true);
  });

  it("sendToBack matches shifted {", () => {
    expect(
      actionSendToBack.keyTest!(
        new KeyboardEvent("keydown", {
          key: "{",
          code: "BracketLeft",
          ctrlKey: true,
          shiftKey: true,
        }),
        ...stubCtx,
      ),
    ).toBe(true);
  });
});
