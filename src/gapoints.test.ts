import * as GA from "./gapoints";

describe("Test gapoints", () => {
  it("should extract coords from a NVector representing the origin", () => {
    expect(GA.toTuple([0, 0, 0, 0, 0, 0, 1, 0])).toEqual([0,0]);
  });

  it("should extract coords from a NVector representing a nonorigin point", () => {
    expect(GA.toTuple([0, 0, 0, 0, 1, 1, 1, 0])).toEqual([1,1]);
  });

  it("should extract coords from an unnormalized NVector representing a nonorigin point", () => {
    expect(GA.toTuple([0, 0, 0, 0, 2, 2, 2, 0])).toEqual([1,1]);
  });

  it("should extract coords from a unnormalized negated NVector representing a nonorigin point", () => {
    expect(GA.toTuple([0, 0, 0, 0, -6, -8, -2, 0])).toEqual([4,3]);
  });
  it("should extract coords from a normalized negated NVector representing a nonorigin point", () => {
    expect(GA.toTuple([0, 0, 0, 0, 1, 0, -1, 0])).toEqual([-0,-1]);
  });
});



