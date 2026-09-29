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
    // A prerelease sorts below its own release, so the fork's release core
    // must be above upstream 0.18.1 for installs to prefer it.
    const [major, minor, patch] = version
      .split("-")[0]
      .split(".")
      .map(Number);
    expect(major * 1e6 + minor * 1e3 + patch).toBeGreaterThan(18_001);
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
