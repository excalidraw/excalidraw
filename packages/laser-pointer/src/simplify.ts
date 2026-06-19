import { Point, distancePointToSegment } from './math'

export function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (epsilon === 0) {
    return points
  }

  if (points.length <= 2) {
    return points
  }

  const first = points[0]
  const last = points[points.length - 1]

  const [maxDistance, maxIndex] = points.reduce(
    ([maxDistance, maxIndex], point, index) => {
      const distance = distancePointToSegment(point, first, last)

      return distance > maxDistance ? [distance, index] : [maxDistance, maxIndex]
    },
    [0, -1]
  )

  if (maxDistance >= epsilon) {
    const maxIndexPoint = points[maxIndex]

    return [
      ...douglasPeucker([first, ...points.slice(1, maxIndex), maxIndexPoint], epsilon).slice(0, -1),
      maxIndexPoint,
      ...douglasPeucker([maxIndexPoint, ...points.slice(maxIndex, -1), last], epsilon).slice(1),
    ]
  } else {
    return [first, last]
  }
}
