const {
  strokeColorForTerraformDependencyKinds,
  normalizeTerraformDependencyKindTokens,
} = require("./excalidraw-arrows");

describe("strokeColorForTerraformDependencyKinds", () => {
  it("treats a single kind string like an array of one token (not Set of chars)", () => {
    expect(strokeColorForTerraformDependencyKinds("planned_dependency")).toBe(
      "#2b8a3e",
    );
    expect(strokeColorForTerraformDependencyKinds("existing_dependency")).toBe(
      "#1971c2",
    );
  });

  it("falls back to origins when kinds is empty", () => {
    expect(
      strokeColorForTerraformDependencyKinds([], { origins: ["dot"] }),
    ).toBe("#2b8a3e");
    expect(
      strokeColorForTerraformDependencyKinds([], {
        origins: ["terraform_state"],
      }),
    ).toBe("#1971c2");
    expect(
      strokeColorForTerraformDependencyKinds([], {
        origins: ["dot", "terraform_state"],
      }),
    ).toBe("#1971c2");
  });

  it("colors existing+planned as blue (existing wins over adjacency)", () => {
    expect(
      strokeColorForTerraformDependencyKinds([
        "planned_dependency",
        "existing_dependency",
      ]),
    ).toBe("#1971c2");
  });

  it("prefers delete then replace over new/existing hues", () => {
    expect(
      strokeColorForTerraformDependencyKinds(["planned_dependency"], {
        sourceAction: "delete",
      }),
    ).toBe("#c92a2a");
    expect(
      strokeColorForTerraformDependencyKinds(["planned_dependency"], {
        targetAction: "replace",
      }),
    ).toBe("#f08c00");
  });
});

describe("normalizeTerraformDependencyKindTokens", () => {
  it("maps origins when kinds missing", () => {
    expect(normalizeTerraformDependencyKindTokens([], ["dot"])).toEqual([
      "planned_dependency",
    ]);
  });
});
