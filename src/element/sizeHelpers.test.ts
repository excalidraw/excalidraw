import { getPerfectElementSize } from "./sizeHelpers";
import * as constants from "../constants";

describe("getPerfectElementSize", () => {
  it("should return height:0 if `elementType` is line and locked angle is 0", () => {
    const { height, width } = getPerfectElementSize("line", 149, 10);
    expect(width).toEqual(149);
    expect(height).toEqual(0);
  });
  it("should return width:0 if `elementType` is line and locked angle is 90 deg (Math.PI/2)", () => {
    const { height, width } = getPerfectElementSize("line", 10, 140);
    expect(width).toEqual(0);
    expect(height).toEqual(140);
  });
  it("should return height:0 if `elementType` is arrow and locked angle is 0", () => {
    const { height, width } = getPerfectElementSize("arrow", 200, 20);
    expect(width).toEqual(200);
    expect(height).toEqual(0);
  });
  it("should return width:0 if `elementType` is arrow and locked angle is 90 deg (Math.PI/2)", () => {
    const { height, width } = getPerfectElementSize("arrow", 10, 100);
    expect(width).toEqual(0);
    expect(height).toEqual(100);
  });
  it("should return adjust height to be width * tan(locked angle)", () => {
    const { height, width } = getPerfectElementSize("arrow", 120, 185);
    expect(width).toEqual(120);
    expect(height).toEqual(208);
  });
  it("should return height equals to width if locked angle is 45 deg", () => {
    const { height, width } = getPerfectElementSize("arrow", 135, 145);
    expect(width).toEqual(135);
    expect(height).toEqual(135);
  });
  it("should return height:0 and width:0 when width and heigh are 0", () => {
    const { height, width } = getPerfectElementSize("arrow", 0, 0);
    expect(width).toEqual(0);
    expect(height).toEqual(0);
  });

  describe("should respond to SHIFT_LOCKING_ANGLE constant", () => {
    it("should have only 2 locking angles per section if SHIFT_LOCKING_ANGLE = 45 deg (Math.PI/4)", () => {
      (constants as any).SHIFT_LOCKING_ANGLE = Math.PI / 4;
      const { height, width } = getPerfectElementSize("arrow", 120, 185);
      expect(width).toEqual(120);
      expect(height).toEqual(120);
    });
  });
});
