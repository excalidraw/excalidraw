import { ROUNDNESS } from "@excalidraw/common";

import rough from "roughjs/bin/rough";

import { newElement } from "./newElement";
import { drawElementOnCanvas } from "./renderElement";
import { getCornerRadius } from "./utils";

describe("drawElementOnCanvas gradient fill", () => {
  it("fills a gradient-fillStyle rectangle with a CanvasGradient before stroking", () => {
    const element = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      backgroundColor: "#ff0000",
      fillStyle: "gradient",
      gradient: { color2: "#0000ff", angle: 0 },
    });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const createLinearGradientSpy = vi.spyOn(context, "createLinearGradient");

    const rc = rough.canvas(canvas);

    drawElementOnCanvas(element, rc, context, {
      canvasBackgroundColor: "#ffffff",
      embedsValidationStatus: null,
      theme: "light",
      isExporting: false,
    } as any);

    expect(createLinearGradientSpy).toHaveBeenCalledWith(0, 25, 100, 25);
  });

  it("fills a rounded rectangle's gradient using roundRect with the same corner radius as the stroke", () => {
    const element = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      backgroundColor: "#ff0000",
      fillStyle: "gradient",
      gradient: { color2: "#0000ff", angle: 0 },
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const roundRectSpy = vi.fn();
    (context as any).roundRect = roundRectSpy;

    const rc = rough.canvas(canvas);

    drawElementOnCanvas(element, rc, context, {
      canvasBackgroundColor: "#ffffff",
      embedsValidationStatus: null,
      theme: "light",
      isExporting: false,
    } as any);

    expect(roundRectSpy).toHaveBeenCalledWith(
      0,
      0,
      100,
      50,
      getCornerRadius(50, element),
    );
  });
});
