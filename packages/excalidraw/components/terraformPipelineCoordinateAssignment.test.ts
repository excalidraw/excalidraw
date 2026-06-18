import { describe, expect, it } from "vitest";

import {
  hubCenteringOverBoxes,
  median,
} from "./terraformPipelineCoordinateAssignment";

describe("terraformPipelineCoordinateAssignment", () => {
  describe("median", () => {
    it("odd length → middle element", () => {
      expect(median([3, 1, 2])).toBe(2);
    });
    it("even length → midpoint average (true centering)", () => {
      expect(median([10, 20, 30, 40])).toBe(25);
      expect(median([0, 200])).toBe(100);
    });
    it("empty → 0 (numeric convenience, callers guard)", () => {
      expect(median([])).toBe(0);
    });
    it("does not mutate input", () => {
      const input = [3, 1, 2];
      median(input);
      expect(input).toEqual([3, 1, 2]);
    });
  });

  describe("hubCenteringOverBoxes", () => {
    const eps = 36; // PIPELINE_CLUSTER_GAP_Y

    it("counts a fan-out hub centered on its targets' median", () => {
      // S → A,B,C with centre-Ys 20/120/220 → median 120; S at 120 ⇒ centered.
      const centers = new Map([
        ["S", 120],
        ["A", 20],
        ["B", 120],
        ["C", 220],
      ]);
      const fanout = new Map<string, string[]>([["S", ["A", "B", "C"]]]);
      const r = hubCenteringOverBoxes(centers, fanout, new Map(), eps);
      expect(r.hubCount).toBe(1);
      expect(r.hubCentered).toBe(1);
      expect(r.rate).toBe(1);
    });

    it("an off-median hub beyond ε is not centered", () => {
      const centers = new Map([
        ["S", 220],
        ["A", 20],
        ["B", 120],
        ["C", 220],
      ]);
      const fanout = new Map<string, string[]>([["S", ["A", "B", "C"]]]);
      const r = hubCenteringOverBoxes(centers, fanout, new Map(), eps);
      expect(r.hubCount).toBe(1);
      expect(r.hubCentered).toBe(0);
      expect(r.rate).toBe(0);
    });

    it("counts convergence (fan-in) hubs too, once per direction", () => {
      // A,B → T : T converges 2 sources (20 + 220 → median 120). T at 120 centered.
      const centers = new Map([
        ["A", 20],
        ["B", 220],
        ["T", 120],
      ]);
      const fanin = new Map<string, string[]>([["T", ["A", "B"]]]);
      const r = hubCenteringOverBoxes(centers, new Map(), fanin, eps);
      expect(r.hubCount).toBe(1);
      expect(r.hubCentered).toBe(1);
    });

    it("ignores sets with < 2 resolvable neighbours (not a hub)", () => {
      const centers = new Map([
        ["S", 0],
        ["A", 50],
      ]);
      const fanout = new Map<string, string[]>([["S", ["A", "MISSING"]]]);
      const r = hubCenteringOverBoxes(centers, fanout, new Map(), eps);
      expect(r.hubCount).toBe(0);
      expect(r.rate).toBe(0);
    });

    it("skips a self-loop neighbour and an unresolved node", () => {
      const centers = new Map([["A", 0]]); // S itself unresolved
      const fanout = new Map<string, string[]>([["S", ["S", "A", "B"]]]);
      const r = hubCenteringOverBoxes(centers, fanout, new Map(), eps);
      expect(r.hubCount).toBe(0);
    });

    it("is deterministic + empty-safe", () => {
      const empty = hubCenteringOverBoxes(new Map(), new Map(), new Map(), eps);
      expect(empty).toEqual({ hubCount: 0, hubCentered: 0, rate: 0 });
    });
  });
});
