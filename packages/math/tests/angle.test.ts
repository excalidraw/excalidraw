import { describe, expect, it } from "vitest";
import { normalizeRadians } from "../src/angle";
import type { Radians } from "../src/types";

describe("normalizeRadians", () => {
    it("normalizes positive angles within [0, 2PI)", () => {
        expect(normalizeRadians(0 as Radians)).toBe(0);
        expect(normalizeRadians(Math.PI as Radians)).toBe(Math.PI);
        expect(normalizeRadians((1.5 * Math.PI) as Radians)).toBe(1.5 * Math.PI);
    });

    it("normalizes positive multiples of 2PI to 0", () => {
        expect(normalizeRadians((2 * Math.PI) as Radians)).toBe(0);
        expect(normalizeRadians((4 * Math.PI) as Radians)).toBe(0);
    });

    it("normalizes negative multiples of 2PI to 0", () => {
        expect(normalizeRadians((-2 * Math.PI) as Radians)).toBe(0);
        expect(normalizeRadians((-4 * Math.PI) as Radians)).toBe(0);
    });

    it("normalizes negative angles correctly into [0, 2PI)", () => {
        expect(normalizeRadians((-Math.PI / 2) as Radians)).toBeCloseTo(
            1.5 * Math.PI,
        );
        expect(normalizeRadians((-Math.PI) as Radians)).toBeCloseTo(Math.PI);
    });

    it("handles very small negative angles without returning 2PI", () => {
        expect(normalizeRadians(-1e-17 as Radians)).toBe(0);
    });
});