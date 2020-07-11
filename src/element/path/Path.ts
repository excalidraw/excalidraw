import { ExcalidrawElement } from "../types";
import {
  difference,
  union,
  intersection,
  exclusion,
  pathArrToStr,
} from "./raphaelBools";
import {
  parsePathString,
  getTotalLength,
  getPointAtLength,
  normalizePath,
  pathDimensions,
} from "./raphael";
import Matrix from "./Matrix";
import { Point } from "../../types";

function isHollow(path: (string | number)[][]) {
  const index = path.findIndex(
    ([c], i) => i > 0 && (c as string).toLowerCase() === "m",
  );

  const head = path[0];
  const tail = path[index - 1];

  return !!(
    tail &&
    tail[tail.length - 1] === head[head.length - 1] &&
    tail[tail.length - 2] === head[head.length - 2]
  );
}

interface Transform {
  translate?: number[];
  scale?: number[];
  rotate?: number;
}

function toMarix(transform: Transform, centerPoint: Point) {
  const matrix = new Matrix();

  if (transform.translate) {
    matrix.translate(...(transform.translate as [number, number]));
  }

  if (transform.rotate) {
    matrix.rotate(transform.rotate as number, ...centerPoint);
  }

  if (transform.scale) {
    const [scaleX, scaleY] = transform.scale;

    matrix.scale(scaleX, scaleY, 0, 0);
  }

  return matrix;
}

export default class Path {
  data: (string | number)[][];
  isHollow: boolean = false;

  constructor(d: string | ExcalidrawElement) {
    this.data = typeof d === "string" ? parsePathString(d) : this.toPath(d);
  }

  mapPath(matrix: Matrix) {
    this.data.forEach((path) => {
      for (let i = 1; i < path.length; i += 2) {
        const n1 = path[i] as number;
        const n2 = path[i + 1] as number;
        const newX = matrix.x(n1, n2);
        const newY = matrix.y(n1, n2);
        path[i] = newX;
        path[i + 1] = newY;
      }
    });
  }

  getBoundingBox() {
    return pathDimensions(this.data);
  }

  getCenterPoint(): Point {
    const box = this.getBoundingBox();

    return [box.x + box.width / 2, box.y + box.height / 2];
  }

  transformPoint(point: Point, transform: Transform = {}): Point {
    const matrix = toMarix(transform, this.getCenterPoint());

    const newX = matrix.x(...point);
    const newY = matrix.y(...point);

    return [newX, newY];
  }

  transform(transform: Transform = {}) {
    const matrix = toMarix(transform, this.getCenterPoint())

    this.mapPath(matrix);
  }

  toPathString() {
    return pathArrToStr(this.data);
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
    const { data, intersections } = difference(this.data, path.data);

    this.data = data;
    this.isHollow = isHollow(this.data);

    return intersections;
  }

  /**
   * perform a union of the two given paths
   *
   * @param object el1 (RaphaelJS element)
   * @param object el2 (RaphaelJS element)
   *
   * @returns string (path string)
   */
  union(path: Path) {
    const { data, intersections } = union(this.data, path.data);
    this.data = data;
    this.isHollow = isHollow(this.data);

    return intersections;
  }

  /**
   * perform a intersection of the two given paths
   *
   * @param object el1 (RaphaelJS element)
   * @param object el2 (RaphaelJS element)
   *
   * @returns string (path string)
   */
  intersection(path: Path) {
    const { data, intersections } = intersection(this.data, path.data);

    this.data = data;
    this.isHollow = isHollow(this.data);

    return intersections;
  }

  /**
   * perform a exclusion of the two given paths
   *
   * @param object el1 (RaphaelJS element)
   * @param object el2 (RaphaelJS element)
   *
   * @returns string (path string)
   */
  exclusion(path: Path) {
    const { data, intersections } = exclusion(this.data, path.data);

    this.data = data;
    this.isHollow = isHollow(this.data);

    return intersections;
  }

  getTotalLength(): number {
    return getTotalLength(this.data) as number;
  }

  getPointAtLength(length: number) {
    return getPointAtLength(this.data, length);
  }

  toPath(element: ExcalidrawElement) {
    const path = [];
    const x = element.width / 2;
    const y = element.height / 2;
    let cornerPoints: [number, number][] = [];
    let rx = 0;
    let ry = 0;

    if (element.type === "ellipse") {
      rx = element.width / 2;
      ry = element.height / 2;
      cornerPoints = [
        [x - rx, y - ry],
        [x + rx, y - ry],
        [x + rx, y + ry],
        [x - rx, y + ry],
      ];
    }

    const radiusShift = [
      [
        [0, 1],
        [1, 0],
      ],
      [
        [-1, 0],
        [0, 1],
      ],
      [
        [0, -1],
        [-1, 0],
      ],
      [
        [1, 0],
        [0, -1],
      ],
    ];
    //iterate all corners
    for (let i = 0; i <= 3; i++) {
      //insert starting point
      if (i === 0) {
        path.push(["M", cornerPoints[0][0], cornerPoints[0][1] + ry]);
      }

      //insert "curveto" (radius factor .446 is taken from Inkscape)
      if (rx > 0) {
        path.push([
          "C",
          cornerPoints[i][0] + radiusShift[i][0][0] * rx * 0.446,
          cornerPoints[i][1] + radiusShift[i][0][1] * ry * 0.446,
          cornerPoints[i][0] + radiusShift[i][1][0] * rx * 0.446,
          cornerPoints[i][1] + radiusShift[i][1][1] * ry * 0.446,
          cornerPoints[i][0] + radiusShift[i][1][0] * rx,
          cornerPoints[i][1] + radiusShift[i][1][1] * ry,
        ]);
      }

      if (i === 3) {
        path.push(["Z"]);
      }
    }

    return normalizePath(pathArrToStr(path));
  }

  static clone(path: Path): Path {
    const clone = new Path(path.toPathString());

    clone.isHollow = path.isHollow;

    return clone;
  }
}
