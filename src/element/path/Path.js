import { difference } from "./path-boolop";

const pathCommand = /([cmz])[\s,]*((-?\d*\.?\d*(?:e[-+]?\d+)?[\s]*,?[\s]*)+)/gi;
const pathValues = /(-?\d*\.?\d*(?:e[-+]?\d+)?)[\s]*,?[\s]*/gi;

export default class Path {
  constructor(d, options) {
    this.path = this.parsePathString(d);
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

  parsePathString(pathString) {
    const paramCounts = {
      c: 6,
      m: 2,
      z: 0,
    };
    const data = [];

    if (!data.length) {
      pathString.replace(pathCommand, function (a, b, c) {
        var params = [],
          name = b.toLowerCase();
        c.replace(pathValues, function (a, b) {
          b && params.push(+b);
        });
        while (params.length >= paramCounts[name]) {
          data.push([b].concat(params.splice(0, paramCounts[name])));
          if (!paramCounts[name]) {
            break;
          }
        }
      });
    }

    return data;
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
