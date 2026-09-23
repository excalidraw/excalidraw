import type { EditorInterface } from "@excalidraw/common";

import { canResizeFromSides } from "../src/transformHandles";

const createEditorInterface = (
  overrides: Partial<{
    formFactor: EditorInterface["formFactor"];
    isMobileDevice: boolean;
    isTouchScreen: boolean;
  }>,
) =>
  ({
    formFactor: overrides.formFactor ?? "desktop",
    isTouchScreen: overrides.isTouchScreen ?? false,
    userAgent: {
      isMobileDevice: overrides.isMobileDevice ?? false,
      platform: "unknown",
    },
  } as EditorInterface);

describe("canResizeFromSides", () => {
  it("should allow resizing from sides on desktop", () => {
    expect(canResizeFromSides(createEditorInterface({}))).toBe(true);
    expect(
      canResizeFromSides(createEditorInterface({ isTouchScreen: true })),
    ).toBe(true);
    expect(
      canResizeFromSides(createEditorInterface({ formFactor: "phone" })),
    ).toBe(true);
  });

  it("should not allow resizing from sides on mobile phones", () => {
    expect(
      canResizeFromSides(
        createEditorInterface({ formFactor: "phone", isMobileDevice: true }),
      ),
    ).toBe(false);
  });

  it("should not allow resizing from sides on touch tablets", () => {
    expect(
      canResizeFromSides(
        createEditorInterface({
          formFactor: "tablet",
          isMobileDevice: true,
          isTouchScreen: true,
        }),
      ),
    ).toBe(false);
    expect(
      canResizeFromSides(
        createEditorInterface({
          formFactor: "desktop",
          isMobileDevice: true,
          isTouchScreen: true,
        }),
      ),
    ).toBe(false);
  });

  it("should allow resizing from sides on tablets before touch input", () => {
    expect(
      canResizeFromSides(
        createEditorInterface({ formFactor: "tablet", isMobileDevice: true }),
      ),
    ).toBe(true);
  });
});
