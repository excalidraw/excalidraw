import { positionElementBesideCursor } from "./positionElementBesideCursor";

const element = {
  width: 48,
  height: 48,
};

const container = {
  left: 100,
  top: 50,
  width: 400,
  height: 300,
};

describe("positionElementBesideCursor", () => {
  it("positions the element after the cursor when it fits", () => {
    expect(
      positionElementBesideCursor({
        cursor: { x: 200, y: 100 },
        element,
        container,
        gap: 20,
      }),
    ).toEqual({ left: 120, top: 70 });
  });

  it("flips an overflowing element to the other side of the cursor", () => {
    expect(
      positionElementBesideCursor({
        cursor: { x: 480, y: 330 },
        element,
        container,
        gap: 20,
      }),
    ).toEqual({ left: 312, top: 212 });
  });

  it("keeps a flipped element within the container", () => {
    expect(
      positionElementBesideCursor({
        cursor: { x: 160, y: 90 },
        element,
        container: { left: 100, top: 50, width: 100, height: 80 },
        gap: 20,
      }),
    ).toEqual({ left: 0, top: 0 });
  });

  it("pins an oversized element to the container origin", () => {
    expect(
      positionElementBesideCursor({
        cursor: { x: 130, y: 80 },
        element,
        container: { left: 100, top: 50, width: 40, height: 40 },
        gap: 0,
      }),
    ).toEqual({ left: 0, top: 0 });
  });
});
