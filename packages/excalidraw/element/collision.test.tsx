import { intersectElementWithLine } from "./collision";
import { newElement } from "./newElement";
import { pointFrom } from "../../math";
import { ROUNDNESS } from "..";

describe("intersection with element", () => {
  // it("intersect with rectangle", () => {
  //   expect(
  //     intersectElementWithLine(
  //       newElement({
  //         type: "rectangle",
  //         x: -5,
  //         y: -5,
  //         width: 10,
  //         height: 10,
  //         roundness: null,
  //       }),
  //       pointFrom(1, 1),
  //       pointFrom(10, 10),
  //     ),
  //   ).toEqual([pointFrom(5, 5), pointFrom(-5, -5)]);
  //   expect(
  //     intersectElementWithLine(
  //       newElement({
  //         type: "rectangle",
  //         x: -5,
  //         y: -5,
  //         width: 10,
  //         height: 10,
  //         roundness: null,
  //       }),
  //       pointFrom(-1, -1),
  //       pointFrom(-10, -10),
  //     ),
  //   ).toEqual([pointFrom(-5, -5), pointFrom(5, 5)]);
  //   expect(
  //     intersectElementWithLine(
  //       newElement({
  //         type: "rectangle",
  //         x: -5,
  //         y: -5,
  //         width: 10,
  //         height: 10,
  //         roundness: {
  //           type: ROUNDNESS.ADAPTIVE_RADIUS,
  //         },
  //       }),
  //       pointFrom(1, 1),
  //       pointFrom(10, 10),
  //     ).map((p) =>
  //       pointFrom(Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100),
  //     ),
  //   ).toEqual([pointFrom(4.27, 4.27), pointFrom(-4.27, -4.27)]);
  //   expect(
  //     intersectElementWithLine(
  //       newElement({
  //         type: "rectangle",
  //         x: -5,
  //         y: -5,
  //         width: 10,
  //         height: 10,
  //         roundness: {
  //           type: ROUNDNESS.ADAPTIVE_RADIUS,
  //         },
  //       }),
  //       pointFrom(-1, -1),
  //       pointFrom(-10, -10),
  //     ).map((p) =>
  //       pointFrom(Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100),
  //     ),
  //   ).toEqual([pointFrom(-4.27, -4.27), pointFrom(4.27, 4.27)]);
  // });

  it("intersect with diamond", () => {
    // expect(
    //   intersectElementWithLine(
    //     newElement({
    //       type: "diamond",
    //       x: -20,
    //       y: -20,
    //       width: 40,
    //       height: 40,
    //       roundness: null,
    //     }),
    //     pointFrom(-30, 0),
    //     pointFrom(-25, 0),
    //   ),
    // ).toEqual([pointFrom(-20, 0), pointFrom(20, 0)]);
    // expect(
    //   intersectElementWithLine(
    //     newElement({
    //       type: "diamond",
    //       x: -20,
    //       y: -20,
    //       width: 40,
    //       height: 40,
    //       roundness: null,
    //     }),
    //     pointFrom(0, -30),
    //     pointFrom(0, -25),
    //   ),
    // ).toEqual([pointFrom(0, -20), pointFrom(0, 20)]);
    // expect(
    //   intersectElementWithLine(
    //     newElement({
    //       type: "diamond",
    //       x: -20,
    //       y: -20,
    //       width: 40,
    //       height: 40,
    //       roundness: {
    //         type: ROUNDNESS.PROPORTIONAL_RADIUS,
    //       },
    //     }),
    //     pointFrom(-30, 0),
    //     pointFrom(-25, 0),
    //   ).map((p) =>
    //     pointFrom(Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100),
    //   ),
    // ).toEqual([pointFrom(-21.46, 0), pointFrom(21.46, 0)]);

    // console.log(
    //   intersectElementWithLine(
    //     newElement({
    //       type: "diamond",
    //       x: -20,
    //       y: -20,
    //       width: 40,
    //       height: 40,
    //       roundness: {
    //         type: ROUNDNESS.PROPORTIONAL_RADIUS,
    //       },
    //     }),
    //     pointFrom(0, -30),
    //     pointFrom(0, -25),
    //   ).map((p) =>
    //     pointFrom(Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100),
    //   ),
    // );

    expect(
      intersectElementWithLine(
        newElement({
          type: "diamond",
          x: -20,
          y: -20,
          width: 40,
          height: 40,
          roundness: {
            type: ROUNDNESS.PROPORTIONAL_RADIUS,
          },
        }),
        pointFrom(0, -30),
        pointFrom(0, -25),
      ).map((p) =>
        pointFrom(Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100),
      ),
    ).toEqual([pointFrom(0, -17.93), pointFrom(0, 17.93)]);

    expect(
      intersectElementWithLine(
        newElement({
          type: "diamond",
          x: -20,
          y: -20,
          width: 40,
          height: 40,
          roundness: {
            type: ROUNDNESS.PROPORTIONAL_RADIUS,
          },
        }),
        pointFrom(-30, 0),
        pointFrom(-25, 0),
      ).map((p) =>
        pointFrom(Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100),
      ),
    ).toEqual([pointFrom(-17.93, 0), pointFrom(17.93, 0)]);
  });
});
