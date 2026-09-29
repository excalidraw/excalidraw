import fs from "fs";
import path from "path";

// The packages scripts/release.js publishes together at one version.
const LOCKSTEP = [
  "common",
  "fractional-indexing",
  "math",
  "element",
  "excalidraw",
];

const read = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, `../../${name}/package.json`),
      "utf8",
    ),
  );

describe("package versions", () => {
  it("publishes the lockstep packages at one version, depending on each other at it", () => {
    const { version } = read("excalidraw");
    expect(version).toMatch(/^\d+\.\d+\.\d+-draw\.\d+$/);
    for (const name of LOCKSTEP) {
      const pkg = read(name);
      expect(pkg.version).toBe(version);
      for (const dependency of LOCKSTEP) {
        const range = pkg.dependencies?.[`@excalidraw/${dependency}`];
        if (range !== undefined) {
          expect(range).toBe(version);
        }
      }
    }
  });
});
