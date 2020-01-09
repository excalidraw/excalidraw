// https://stackoverflow.com/a/6853926/232122
export function distanceBetweenPointAndSegment(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSquare = C * C + D * D;
  let param = -1;
  if (lenSquare !== 0) {
    // in case of 0 length line
    param = dot / lenSquare;
  }

  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.hypot(dx, dy);
}

export function rotate(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  angle: number
) {
  // 𝑎′𝑥=(𝑎𝑥−𝑐𝑥)cos𝜃−(𝑎𝑦−𝑐𝑦)sin𝜃+𝑐𝑥
  // 𝑎′𝑦=(𝑎𝑥−𝑐𝑥)sin𝜃+(𝑎𝑦−𝑐𝑦)cos𝜃+𝑐𝑦.
  // https://math.stackexchange.com/questions/2204520/how-do-i-rotate-a-line-segment-in-a-specific-point-on-the-line
  return [
    (x1 - x2) * Math.cos(angle) - (y1 - y2) * Math.sin(angle) + x2,
    (x1 - x2) * Math.sin(angle) + (y1 - y2) * Math.cos(angle) + y2
  ];
}

interface Line {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

interface Point {
  x: number;
  y: number;
}

const vcp = (a: Point, b: Point) => {
  return a.x * b.y - a.y * b.x;
};

//https://stackoverflow.com/a/565282/816116
export const testLineSegmentIntersect = (l1: Line, l2: Line) => {
  const r: Point = { x: l1.x2 - l1.x1, y: l1.y2 - l1.y1 };
  const s: Point = { x: l2.x2 - l2.x1, y: l2.y2 - l2.y1 };

  // r x s
  const div = vcp(r, s);

  // q - p
  const sub = { x: l2.x1 - l1.x1, y: l2.y1 - l1.y1 };

  // t = (q - p) x s / (r x s)
  const t = vcp(sub, s) / div;

  // u = (q - p) x r / (r x s)
  const u = vcp(sub, r) / div;

  if (div === 0 && vcp(sub, s) === 0) {
    return true;
  } else if (div !== 0 && t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return true;
  }

  return false;
};
