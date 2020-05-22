import { difference, pathArrToStr } from "./path-boolop";
import { parsePathString, getTotalLength, getPointAtLength } from "./R";

export default class Path {
  path: (string | number)[][];
  isHollow: boolean = false;

  constructor(d: string) {
    this.path = parsePathString(d);
  }

  position([x, y]: number[]) {
    this.path.forEach((path) => {
      for (let i = 1; i < path.length; i += 2) {
        const newX = x + (path[i] as number);
        const newY = y + (path[i + 1] as number);
        path[i] = newX;
        path[i + 1] = newY;
      }
    });
  }

  toPathString() {
    return pathArrToStr(this.path);
  }

  /**
   * perform a difference of the two given paths
   *
   * @param object el1 (RaphaelJS element)
   * @param object el2 (RaphaelJS element)
   *
   * @returns string (path string)
   */
  difference(path: Path) {
    const result = difference(this.path, path.path);

    this.path = result.path;
    this.isHollow = result.isHollow;
  }

  getTotalLength(): number {
    return getTotalLength(this.path) as number;
  }

  getPointAtLength(length: number) {
    return getPointAtLength(this.path, length);
  }
}
