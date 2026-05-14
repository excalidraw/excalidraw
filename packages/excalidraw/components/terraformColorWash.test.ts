import { describe, expect, it } from "vitest";

import {
  dimmedTerraformElementOverrides,
  hasStashedTerraformOriginals,
  parseHexColor,
  restoredTerraformElementOverrides,
  washHexColor,
} from "./terraformColorWash";

describe("terraformColorWash", () => {
  describe("parseHexColor", () => {
    it.each([
      ["#abc", { r: 170, g: 187, b: 204 }],
      ["#AABBCC", { r: 170, g: 187, b: 204 }],
      ["#aabbccdd", { r: 170, g: 187, b: 204 }],
      ["transparent", null],
      ["", null],
      ["rgb(1,2,3)", null],
    ])("%s", (input, expected) => {
      expect(parseHexColor(input)).toEqual(expected);
    });
  });

  describe("washHexColor", () => {
    it("returns original color when factor is 0", () => {
      expect(washHexColor("#ff0000", 0, "#ffffff")).toBe("#ff0000");
    });
    it("blends toward background", () => {
      expect(washHexColor("#ff0000", 1, "#ffffff")).toBe("#ffffff");
      expect(washHexColor("#ff0000", 0.5, "#ffffff")).toBe("#ff8080");
    });
  });

  describe("dim / restore round-trip", () => {
    const base = {
      strokeColor: "#111111",
      backgroundColor: "transparent",
      fillStyle: "solid" as const,
      customData: {},
    };

    it("dimmedTerraformElementOverrides stashes originals and washes colors", () => {
      const dim = dimmedTerraformElementOverrides(base, 50, "#ffffff");
      expect(dim).not.toBeNull();
      expect(dim!.customData.terraformDimmedOriginals).toEqual({
        strokeColor: "#111111",
        backgroundColor: "transparent",
        fillStyle: "solid",
      });
      expect(dim!.fillStyle).toBe("solid");
      expect(dim!.strokeColor).not.toBe("#111111");
    });

    it("restoredTerraformElementOverrides clears stash when colors match dimmed state", () => {
      const dim = dimmedTerraformElementOverrides(base, 50, "#ffffff")!;
      const dimmedEl = { ...base, ...dim };
      const restored = restoredTerraformElementOverrides(dimmedEl);
      expect(restored).not.toBeNull();
      expect(restored!.customData.terraformDimmedOriginals).toBeUndefined();
      expect(hasStashedTerraformOriginals(dimmedEl)).toBe(true);
      expect(hasStashedTerraformOriginals({ ...dimmedEl, ...restored! })).toBe(
        false,
      );
    });

    it("returns null from dim when level is full visibility", () => {
      expect(dimmedTerraformElementOverrides(base, 100, "#fff")).toBeNull();
    });
  });
});
