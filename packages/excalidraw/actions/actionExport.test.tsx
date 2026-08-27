import { actionSaveToActiveFile, actionSaveFileToDisk } from "./actionExport";

const makeEvent = (
  key: string,
  modifiers: { ctrlOrCmd?: boolean; shift?: boolean } = {},
) =>
  ({
    key,
    ctrlKey: !!modifiers.ctrlOrCmd,
    metaKey: !!modifiers.ctrlOrCmd,
    shiftKey: !!modifiers.shift,
  } as unknown as KeyboardEvent);

describe("actionSaveToActiveFile.keyTest", () => {
  it("matches Ctrl/Cmd+S with lowercase key", () => {
    expect(
      actionSaveToActiveFile.keyTest!(makeEvent("s", { ctrlOrCmd: true })),
    ).toBe(true);
  });

  // CapsLock-on (or other layouts where the modifier-applied key arrives
  // uppercased) used to fall through, letting the browser's native Ctrl+S
  // dialog fire. See issue #9281.
  it("matches Ctrl/Cmd+S with uppercase key (CapsLock on)", () => {
    expect(
      actionSaveToActiveFile.keyTest!(makeEvent("S", { ctrlOrCmd: true })),
    ).toBe(true);
  });

  it("does not match Ctrl/Cmd+Shift+S (reserved for save-as)", () => {
    expect(
      actionSaveToActiveFile.keyTest!(
        makeEvent("S", { ctrlOrCmd: true, shift: true }),
      ),
    ).toBe(false);
  });

  it("does not match plain S without modifier", () => {
    expect(actionSaveToActiveFile.keyTest!(makeEvent("s"))).toBe(false);
  });
});

describe("actionSaveFileToDisk.keyTest (regression guard)", () => {
  it("matches Ctrl/Cmd+Shift+S regardless of letter case", () => {
    expect(
      actionSaveFileToDisk.keyTest!(
        makeEvent("S", { ctrlOrCmd: true, shift: true }),
      ),
    ).toBe(true);
    expect(
      actionSaveFileToDisk.keyTest!(
        makeEvent("s", { ctrlOrCmd: true, shift: true }),
      ),
    ).toBe(true);
  });
});
