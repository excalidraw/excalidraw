import { restoreAppState } from "../data/restore";

describe("restore appState.colorTopPicks", () => {
  it("dedupes notation variants and drops non-strings", () => {
    const restored = restoreAppState(
      {
        colorTopPicks: {
          elementStroke: null,
          elementBackground: [
            "#FFF",
            "#ffffff",
            "white",
            "#a5d8ff",
            "rgb(165, 216, 255)",
            "#eebefa",
            42,
            "transparent",
            "rgba(0, 0, 0, 0)",
          ],
        },
      } as any,
      null,
    );
    expect(restored.colorTopPicks.elementBackground).toEqual([
      "#FFF",
      "#a5d8ff",
      "#eebefa",
      "transparent",
    ]);
    expect(restored.colorTopPicks.elementStroke).toBe(null);
  });

  it("retains more than five picks and nulls malformed input", () => {
    const many = Array.from(
      { length: 20 },
      (_, i) => `#0000${String(i).padStart(2, "0")}`,
    );
    const restored = restoreAppState(
      {
        colorTopPicks: { elementStroke: many, elementBackground: "junk" },
      } as any,
      null,
    );
    expect(restored.colorTopPicks.elementStroke).toEqual(many);
    expect(restored.colorTopPicks.elementBackground).toBe(null);
  });

  it("retains distinct presets for one color and skips invalid presets", () => {
    const preset = {
      color: "#7950f2",
      strokeWidthKey: "medium",
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      fillStyle: "hachure",
      strokeVariability: "constant",
    } as const;
    const bold = { ...preset, strokeWidthKey: "bold" } as const;

    const restored = restoreAppState(
      {
        colorTopPicks: {
          elementStroke: [
            preset,
            bold,
            { ...preset, color: "#7950F2" },
            { ...preset, opacity: 200 },
          ],
        },
      } as any,
      null,
    );

    expect(restored.colorTopPicks.elementStroke).toEqual([preset, bold]);
  });
});
