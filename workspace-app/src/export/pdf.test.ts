import { describe, expect, it } from "vitest";

import { pageSizeFromSvg, safeFileName } from "./pdfUtils";

describe("safeFileName", () => {
  it("strips path separators, reserved and control characters", () => {
    expect(safeFileName('a/b\\c:d*e?f"g<h>i|j', "pdf")).toBe(
      "a-b-c-d-e-f-g-h-i-j.pdf",
    );
    expect(safeFileName("tab\tname\u0007", "pdf")).toBe("tab-name-.pdf");
    expect(safeFileName("../../etc/passwd", "pdf")).toBe(
      "..-..-etc-passwd.pdf",
    );
  });
  it("falls back for empty names and caps the length", () => {
    expect(safeFileName("   ", "pdf")).toBe("scene.pdf");
    expect(safeFileName("", "pptx")).toBe("scene.pptx");
    expect(safeFileName("x".repeat(500), "pdf").length).toBe(104);
  });
});

describe("pageSizeFromSvg", () => {
  const svg = (attrs: string) =>
    new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}/>`,
      "image/svg+xml",
    ).documentElement;
  it("uses the unscaled viewBox, not the export-scaled width/height", () => {
    expect(
      pageSizeFromSvg(svg('width="2560" height="1440" viewBox="0 0 1280 720"')),
    ).toEqual({ widthPx: 1280, heightPx: 720 });
  });
  it("falls back to width/height, then to 1x1", () => {
    expect(pageSizeFromSvg(svg('width="300" height="200"'))).toEqual({
      widthPx: 300,
      heightPx: 200,
    });
    expect(pageSizeFromSvg(svg(""))).toEqual({ widthPx: 1, heightPx: 1 });
  });
});
