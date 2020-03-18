import { getElementAbsoluteCoords } from "./bounds";
import { ExcalidrawElement } from "./types";

const _ce = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) =>
  ({
    type: "rectangle",
    strokeColor: "#000",
    backgroundColor: "#000",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 1,
    opacity: 1,
    x,
    y,
    width: w,
    height: h,
  } as ExcalidrawElement);

describe("getElementAbsoluteCoords", () => {
  it("test x1 coordinate", () => {
    const [x1] = getElementAbsoluteCoords(_ce({ x: 10, y: 0, w: 10, h: 0 }));
    expect(x1).toEqual(10);
  });

  it("test x2 coordinate", () => {
    const [, , x2] = getElementAbsoluteCoords(
      _ce({ x: 10, y: 0, w: 10, h: 0 }),
    );
    expect(x2).toEqual(20);
  });

  it("test y1 coordinate", () => {
    const [, y1] = getElementAbsoluteCoords(_ce({ x: 0, y: 10, w: 0, h: 10 }));
    expect(y1).toEqual(10);
  });

  it("test y2 coordinate", () => {
    const [, , , y2] = getElementAbsoluteCoords(
      _ce({ x: 0, y: 10, w: 0, h: 10 }),
    );
    expect(y2).toEqual(20);
  });
});
