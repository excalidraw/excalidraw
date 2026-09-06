import { clamp } from "@excalidraw/math";

const positionAxis = ({
  cursorPosition,
  elementSize,
  containerSize,
  gap,
}: {
  cursorPosition: number;
  elementSize: number;
  containerSize: number;
  gap: number;
}) => {
  // flip to the other side of the cursor when overflowing the container
  const position =
    cursorPosition + gap + elementSize > containerSize
      ? cursorPosition - gap - elementSize
      : cursorPosition + gap;

  // If the element does not fit on either side, keep as much of it within the
  // container as possible.
  return clamp(position, 0, Math.max(0, containerSize - elementSize));
};

/**
 * Positions an element beside a cursor within a container, flipping the
 * element to the other side of the cursor when it would overflow the
 * container, resolved independently on each axis.
 *
 * Takes the cursor in client (viewport) coordinates and returns
 * container-local coordinates.
 */
export const positionElementBesideCursor = ({
  cursor,
  element,
  container,
  gap,
}: {
  /** client (viewport) coordinates */
  cursor: {
    x: number;
    y: number;
  };
  element: {
    width: number;
    height: number;
  };
  /** the container's bounding client rect */
  container: Pick<DOMRect, "left" | "top" | "width" | "height">;
  /** distance between the cursor and the positioned element */
  gap: number;
}) => ({
  left: positionAxis({
    cursorPosition: cursor.x - container.left,
    elementSize: element.width,
    containerSize: container.width,
    gap,
  }),
  top: positionAxis({
    cursorPosition: cursor.y - container.top,
    elementSize: element.height,
    containerSize: container.height,
    gap,
  }),
});
