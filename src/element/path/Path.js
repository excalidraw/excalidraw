import { difference } from "./path-boolop";
import { parsePathString } from "./R";

export default class Path {
  constructor(d, options) {
    this.path = parsePathString(d);
  }

  position([x, y]) {
    this.path.forEach((path) => {
      for (let i = 1; i < path.length; i += 2) {
        const newX = x + path[i];
        const newY = y + path[i + 1];
        path[i] = newX;
        path[i + 1] = newY;
      }
    });
  }

  /**
   * perform a difference of the two given paths
   *
   * @param object el1 (RaphaelJS element)
   * @param object el2 (RaphaelJS element)
   *
   * @returns string (path string)
   */
  difference({ path }) {
    return difference(this.path, path);
  }
}
