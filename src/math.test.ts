import {getPointOnAPath, rotate} from "./math";
import {point} from "./ga";

describe("rotate", () => {
  it("should rotate over (x2, y2) and return the rotated coordinates for (x1, y1)", () => {
    const x1 = 10;
    const y1 = 20;
    const x2 = 20;
    const y2 = 30;
    const angle = Math.PI / 2;
    const [rotatedX, rotatedY] = rotate(x1, y1, x2, y2, angle);
    expect([rotatedX, rotatedY]).toEqual([30, 20]);
    const res2 = rotate(rotatedX, rotatedY, x2, y2, -angle);
    expect(res2).toEqual([x1, x2]);
  });
});

describe('point',()=>{
  it("should return the point coordinate  the index of segment",()=>{
    const x1 = 10;
    const y1 = 20;
    const x2 = 50;
    const y2 = 60;
    const point1 = [x1,y1];
    const point2 = [x2,y2];
    const point3 = [20,30];
    const kLine = (y2 - y1) / (x2 - x1);
    const idx = 0;
    // @ts-ignore
    expect(getPointOnAPath(point3,[point1,point2])).toStrictEqual({ x: point3[0], y: kLine * point3[0], segment: idx});
  })
  it("if a point is away from two ends should return null",()=>{
    const x1 = 10;
    const y1 = 20;
    const x2 = 50;
    const y2 = 60;
    const point1 = [x1,y1];
    const point2 = [x2,y2];
    const point3 = [2000,3000];
    // @ts-ignore
    expect(getPointOnAPath(point3,[point1,point2])).toBe(null);
  })
  it("if a point is not in the line should return null",()=>{
    const x1 = 10;
    const y1 = 20;
    const x2 = 50;
    const y2 = 60;
    const point1 = [x1,y1];
    const point2 = [x2,y2];
    const point3 = [25,320];

    // @ts-ignore
    expect(getPointOnAPath(point3,[point1,point2])).toBe(null);
  })
  it(" should return coordinate that is always on the line segment and the segment",()=>{
    const x1 = 10;
    const y1 = 20;
    const x2 = 50;
    const y2 = 60;
    const x3 = 100;
    const y3 = 0;
    const point1 = [x1,y1];
    const point2 = [x2,y2];
    const point3 = [x3,y3];
    const point4 = [99,0];

    // @ts-ignore
    expect(getPointOnAPath(point4,[point1,point2,point3])).toStrictEqual({ x: 99, y: -118.8, segment: 1 });

  })
})
