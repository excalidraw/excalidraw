export type Point = [x: number, y: number, r: number]

export function add([ax, ay, ar]: Point, [bx, by, br]: Point): Point {
  return [ax + bx, ay + by, ar + br]
}

export function sub([ax, ay, ar]: Point, [bx, by, br]: Point): Point {
  return [ax - bx, ay - by, ar - br]
}

export function smul([x, y, r]: Point, s: number): Point {
  return [x * s, y * s, r * s]
}

export function norm([x, y, r]: Point): Point {
  return [x / Math.sqrt(x ** 2 + y ** 2), y / Math.sqrt(x ** 2 + y ** 2), r]
}

export function rot([x, y, r]: Point, rad: number): Point {
  return [Math.cos(rad) * x - Math.sin(rad) * y, Math.sin(rad) * x + Math.cos(rad) * y, r]
}

export function plerp(a: Point, b: Point, t: number): Point {
  return add(a, smul(sub(b, a), t))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function angle(p: Point, p1: Point, p2: Point) {
  return Math.atan2(p2[1] - p[1], p2[0] - p[0]) - Math.atan2(p1[1] - p[1], p1[0] - p[0])
}

export function normAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

export function mag([x, y]: Point) {
  return Math.sqrt(x ** 2 + y ** 2)
}

export function dist([ax, ay]: Point, [bx, by]: Point): number {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2)
}

export function getCircleAndPerpendicularLineIntersectionsAtPoint(
  point: Point,
  direction: Point,
  radius: number
): [Point, Point] {
  return [
    add(point, smul(norm(rot(direction, Math.PI / 2)), radius)),
    add(point, smul(norm(rot(direction, -Math.PI / 2)), radius)),
  ]
}

export function runLength(ps: Point[]): number {
  if (ps.length < 2) return 0

  let len = 0

  for (let i = 1; i <= ps.length - 1; i++) {
    len += dist(ps[i - 1], ps[i])
  }

  len += dist(ps[ps.length -2], ps[ps.length - 1])

  return len
}

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export function distancePointToSegment(p3: Point, p1: Point, p2: Point) {
  const sMag = dist(p1, p2)

  if (sMag === 0) return dist(p3, p1)

  const u = clamp(((p3[0] - p1[0]) * (p2[0] - p1[0]) + (p3[1] - p1[1]) * (p2[1] - p1[1])) / sMag ** 2, 0, 1)

  const pi: Point = [p1[0] + u * (p2[0] - p1[0]), p1[1] + u * (p2[1] - p1[1]), p3[2]]

  return dist(pi, p3)
}
