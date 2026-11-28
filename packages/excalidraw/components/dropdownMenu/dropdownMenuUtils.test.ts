import { shouldShiftSubMenu } from "./dropdownMenuUtils";

describe("shouldShiftSubMenu", () => {
  const menuWidth = 220;
  const viewportWidth = 1200;

  it("does not shift when there is room on the left (RTL, menu stuck to the right edge)", () => {
    expect(
      shouldShiftSubMenu({
        parentRect: { left: 900, right: 1190 },
        viewportWidth,
        menuWidth,
      }),
    ).toBe(false);
  });

  it("does not shift when there is room on the right (LTR)", () => {
    expect(
      shouldShiftSubMenu({
        parentRect: { left: 10, right: 300 },
        viewportWidth,
        menuWidth,
      }),
    ).toBe(false);
  });

  it("shifts when there is no room on either side", () => {
    expect(
      shouldShiftSubMenu({
        parentRect: { left: 50, right: 290 },
        viewportWidth: 300,
        menuWidth,
      }),
    ).toBe(true);
  });
});
