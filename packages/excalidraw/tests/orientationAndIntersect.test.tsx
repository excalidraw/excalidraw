import { orderedColinearOrientation, doSegmentsIntersect } from "../math";
import { initializeCoverage } from "./coverageTool";
import { outputCoverageInfo } from "./coverageTool";

initializeCoverage('orderedColinearOrientation', 3);
initializeCoverage('doSegmentsIntersect', 6);

describe("orderedColinearOrientation and doSegmentsIntersect test", () => {

  it("Should return the correct orientation of points", () => {
    outputCoverageInfo();
  })

  it("Should return the correct orientation of points", () => {
    expect(orderedColinearOrientation([1, 1], [2, 2], [3, 3])).toEqual(0);
    expect(orderedColinearOrientation([1, 0], [2, 0], [3, 0])).toEqual(0);
    expect(orderedColinearOrientation([1, 1], [2, 0], [0, -1])).toEqual(1);
    expect(orderedColinearOrientation([1, 1], [-2, 0], [0, -1])).toEqual(2);
  }),

  it("Should correctly detect if segments intersect or not", () => {
    expect(doSegmentsIntersect([0, 0], [4, 4], [0, 4], [4, 0])).toBe(true);
    expect(doSegmentsIntersect([0, 0], [4, 4], [2, 2], [2, 2])).toBe(true);
    expect(doSegmentsIntersect([0, 0], [4, 4], [3, 3], [3, 3])).toBe(true);
    expect(doSegmentsIntersect([0, 0], [4, 4], [2, 2], [2, 2])).toBe(true);
    expect(doSegmentsIntersect([0, 0], [4, 4], [3, 3], [3, 3])).toBe(true);
    expect(doSegmentsIntersect([0, 0], [2, 2], [3, 3], [5, 5])).toBe(false);
    expect(doSegmentsIntersect([1, 1], [3, 3], [4, 4], [2, 2])).toBe(true);
    expect(doSegmentsIntersect([1, 0], [2, 0], [0, 0], [3, 0])).toBe(true);
  })

});

afterAll(() => {
  outputCoverageInfo();
});