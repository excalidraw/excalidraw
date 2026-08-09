import { THEME } from "@excalidraw/common";

import { strokeBackgroundPattern } from "./staticScene";

import type { Zoom } from "../types";

const zoom = { value: 1 } as Zoom;

const setup = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 100;
  const context = canvas.getContext("2d")!;
  const fill = vi.spyOn(context, "fill");
  const stroke = vi.spyOn(context, "stroke");
  const arc = vi.spyOn(context, "arc");
  return { context, fill, stroke, arc };
};

const paint = (
  style: Parameters<typeof strokeBackgroundPattern>[1],
  spies: ReturnType<typeof setup>,
) => {
  strokeBackgroundPattern(
    spies.context,
    style,
    20,
    0,
    0,
    zoom,
    THEME.LIGHT,
    200,
    100,
  );
};

describe("strokeBackgroundPattern", () => {
  it("does nothing for blank", () => {
    const spies = setup();
    paint("blank", spies);
    expect(spies.fill).not.toHaveBeenCalled();
    expect(spies.stroke).not.toHaveBeenCalled();
    expect(spies.arc).not.toHaveBeenCalled();
  });

  it("draws dots for dot style", () => {
    const spies = setup();
    paint("dot", spies);
    expect(spies.arc).toHaveBeenCalled();
    expect(spies.fill).toHaveBeenCalled();
    expect(spies.stroke).not.toHaveBeenCalled();
  });

  it("strokes vertical and horizontal lines for square style", () => {
    const spies = setup();
    paint("square", spies);
    expect(spies.stroke).toHaveBeenCalled();
    expect(spies.arc).not.toHaveBeenCalled();
  });

  it("strokes horizontal lines for lined style", () => {
    const spies = setup();
    paint("lined", spies);
    expect(spies.stroke).toHaveBeenCalled();
    expect(spies.arc).not.toHaveBeenCalled();
  });
});
