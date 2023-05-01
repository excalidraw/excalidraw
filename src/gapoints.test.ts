import * as GA from "./gapoints";
import * as GALine from "./galines";

describe("Test gapoints", () => {
  describe('toTuple', () => {
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

  describe('intersect', () => {
    it('should intersect pairs of points', () => {
      expect(GA.toTuple(GA.intersect(
        GALine.through(GA.from([1, 1]), GA.from([1, 2])), 
        GALine.through(GA.from([1, 1]), GA.from([2, 1])), 
      ))).toEqual([1, 1]);
    });
  });
});



