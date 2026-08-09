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

  it("caps at 10 and nulls malformed input", () => {
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
    expect(restored.colorTopPicks.elementStroke).toHaveLength(10);
    expect(restored.colorTopPicks.elementBackground).toBe(null);
  });
});
