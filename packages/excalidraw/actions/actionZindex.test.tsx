import {
  actionBringForward,
  actionBringToFront,
  actionSendBackward,
  actionSendToBack,
} from "./actionZindex";

// The z-order keyTests only read from the event, so the remaining
// (appState, elements, app) arguments can be stubbed.
const runKeyTest = (
  action: { keyTest?: (...args: any[]) => boolean | undefined },
  init: KeyboardEventInit,
) =>
  action.keyTest?.(
    new KeyboardEvent("keydown", init),
    {} as any,
    [] as any,
    {} as any,
  ) ?? false;

// On non-US layouts the `[` / `]` characters live on a different physical key,
// so `event.code` no longer reports `Bracket*`, but `event.key` still holds the
// produced character. These tests are written for the non-mac (Ctrl) bindings,
// which is what the test environment resolves `CTRL_OR_CMD` to.
describe("actionZindex keyboard shortcuts (regression for #9535)", () => {
  describe("bringForward — Ctrl+]", () => {
    it("matches on a US layout (BracketRight physical key)", () => {
      expect(
        runKeyTest(actionBringForward, {
          key: "]",
          code: "BracketRight",
          ctrlKey: true,
        }),
      ).toBe(true);
    });

    it("matches when `]` is produced by another physical key (non-US layout)", () => {
      expect(
        runKeyTest(actionBringForward, {
          key: "]",
          code: "Digit9",
          ctrlKey: true,
        }),
      ).toBe(true);
    });

    it("does not match the shifted `}` (reserved for bringToFront)", () => {
      expect(
        runKeyTest(actionBringForward, {
          key: "}",
          code: "BracketRight",
          ctrlKey: true,
          shiftKey: true,
        }),
      ).toBe(false);
    });

    it("does not match without the Ctrl modifier", () => {
      expect(
        runKeyTest(actionBringForward, { key: "]", code: "BracketRight" }),
      ).toBe(false);
    });
  });

  describe("sendBackward — Ctrl+[", () => {
    it("matches across layouts", () => {
      expect(
        runKeyTest(actionSendBackward, {
          key: "[",
          code: "BracketLeft",
          ctrlKey: true,
        }),
      ).toBe(true);
      expect(
        runKeyTest(actionSendBackward, {
          key: "[",
          code: "Digit8",
          ctrlKey: true,
        }),
      ).toBe(true);
    });
  });

  describe("bringToFront — Ctrl+Shift+]", () => {
    it("matches the shifted `}` across layouts", () => {
      expect(
        runKeyTest(actionBringToFront, {
          key: "}",
          code: "BracketRight",
          ctrlKey: true,
          shiftKey: true,
        }),
      ).toBe(true);
      expect(
        runKeyTest(actionBringToFront, {
          key: "}",
          code: "Digit9",
          ctrlKey: true,
          shiftKey: true,
        }),
      ).toBe(true);
    });
  });

  describe("sendToBack — Ctrl+Shift+[", () => {
    it("matches the shifted `{` across layouts", () => {
      expect(
        runKeyTest(actionSendToBack, {
          key: "{",
          code: "BracketLeft",
          ctrlKey: true,
          shiftKey: true,
        }),
      ).toBe(true);
      expect(
        runKeyTest(actionSendToBack, {
          key: "{",
          code: "Digit8",
          ctrlKey: true,
          shiftKey: true,
        }),
      ).toBe(true);
    });
  });
});
