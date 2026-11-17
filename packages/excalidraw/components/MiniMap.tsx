
import React, { useMemo, useState } from "react";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { getCommonBounds } from "@excalidraw/element";
import "./MiniMap.scss";

interface MiniMapProps {
  elements: readonly ExcalidrawElement[];
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
  theme: "light" | "dark";
  onNavigate: (x: number, y: number) => void;
}

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 140;
const PADDING = 12;

// Draw arrowheads while preserving their original direction.
const renderArrowhead = (
  tip: { x: number; y: number },
  previous: { x: number; y: number },
  type: string | null | undefined,
  color: string,
  key: string,
) => {
  if (!type) {
    return null;
  }

  const dx = tip.x - previous.x;
  const dy = tip.y - previous.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 0.001) {
    return null;
  }

  const ux = dx / length;
  const uy = dy / length;

  const size = 5;
  const baseX = tip.x - ux * size;
  const baseY = tip.y - uy * size;

  const perpX = -uy;
  const perpY = ux;

  const leftX = baseX + perpX * size * 0.6;
  const leftY = baseY + perpY * size * 0.6;

  const rightX = baseX - perpX * size * 0.6;
  const rightY = baseY - perpY * size * 0.6;

  switch (type) {
    case "arrow":
      return (
        <path
          key={key}
          d={`M ${leftX} ${leftY} L ${tip.x} ${tip.y} L ${rightX} ${rightY}`}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );

    case "triangle":
      return (
        <polygon
          key={key}
          points={`${tip.x},${tip.y} ${leftX},${leftY} ${rightX},${rightY}`}
          fill={color}
          stroke={color}
          strokeWidth={0.5}
        />
      );

    case "dot":
      return (
        <circle
          key={key}
          cx={tip.x}
          cy={tip.y}
          r={2.2}
          fill={color}
        />
      );

    case "bar":
      return (
        <line
          key={key}
          x1={baseX + perpX * size * 0.6}
          y1={baseY + perpY * size * 0.6}
          x2={baseX - perpX * size * 0.6}
          y2={baseY - perpY * size * 0.6}
          stroke={color}
          strokeWidth={1}
        />
      );

    default:
      return null;
  }
};

const MiniMap = ({
  elements,
  scrollX,
  scrollY,
  zoom,
  width,
  height,
  theme,
  onNavigate,
}: MiniMapProps) => {
  const [isDragging, setIsDragging] = useState(false);

  // Calculate canvas boundaries, including the visible viewport.
  const bounds = useMemo(() => {
    const visibleElements = elements.filter(
      (element) => !element.isDeleted,
    );

    const safeZoom = Math.max(zoom, 0.01);

    const viewMinX = -scrollX;
    const viewMinY = -scrollY;
    const viewMaxX = viewMinX + width / safeZoom;
    const viewMaxY = viewMinY + height / safeZoom;

    if (!visibleElements.length) {
      return {
        minX: viewMinX,
        minY: viewMinY,
        maxX: viewMaxX,
        maxY: viewMaxY,
      };
    }

    const [elementMinX, elementMinY, elementMaxX, elementMaxY] =
      getCommonBounds(visibleElements);

    const minX = Math.min(elementMinX, viewMinX);
    const minY = Math.min(elementMinY, viewMinY);
    const maxX = Math.max(elementMaxX, viewMaxX);
    const maxY = Math.max(elementMaxY, viewMaxY);

    const extraX = Math.max((maxX - minX) * 0.05, 30);
    const extraY = Math.max((maxY - minY) * 0.05, 30);

    return {
      minX: minX - extraX,
      minY: minY - extraY,
      maxX: maxX + extraX,
      maxY: maxY + extraY,
    };
  }, [elements, scrollX, scrollY, zoom, width, height]);

  // Dynamic scaling.
  const scale = Math.min(
    (MINIMAP_WIDTH - PADDING * 2) /
      Math.max(bounds.maxX - bounds.minX, 1),
    (MINIMAP_HEIGHT - PADDING * 2) /
      Math.max(bounds.maxY - bounds.minY, 1),
  );

  const offsetX =
    (MINIMAP_WIDTH -
      (bounds.maxX - bounds.minX) * scale) / 2;

  const offsetY =
    (MINIMAP_HEIGHT -
      (bounds.maxY - bounds.minY) * scale) / 2;

  const getX = (x: number) =>
    offsetX + (x - bounds.minX) * scale;

  const getY = (y: number) =>
    offsetY + (y - bounds.minY) * scale;

  // Navigate to a position on the minimap.
  const handleNavigate = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();

    const sceneX =
      (event.clientX - rect.left - offsetX) / scale +
      bounds.minX;

    const sceneY =
      (event.clientY - rect.top - offsetY) / scale +
      bounds.minY;

    onNavigate(sceneX, sceneY);
  };

  // Render each Excalidraw element.
  const renderElement = (element: ExcalidrawElement) => {
    const x = getX(element.x);
    const y = getY(element.y);

    const elementWidth = Math.max(element.width * scale, 1);
    const elementHeight = Math.max(element.height * scale, 1);

    const fill = element.backgroundColor || "none";

    const stroke =
      theme === "dark"
        ? "#ffffff"
        : element.strokeColor || "#64748b";

    const centerX = x + elementWidth / 2;
    const centerY = y + elementHeight / 2;

    const rotation = element.angle
      ? `rotate(${(element.angle * 180) / Math.PI} ${centerX} ${centerY})`
      : undefined;

    switch (element.type) {
      // Circle / ellipse.
      case "ellipse":
        return (
          <ellipse
            key={element.id}
            cx={centerX}
            cy={centerY}
            rx={elementWidth / 2}
            ry={elementHeight / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.7}
            transform={rotation}
          />
        );

      // Diamond.
      case "diamond":
        return (
          <polygon
            key={element.id}
            points={`
              ${centerX},${y}
              ${x + elementWidth},${centerY}
              ${centerX},${y + elementHeight}
              ${x},${centerY}
            `}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.7}
            transform={rotation}
          />
        );

      // Lines and arrows.
      case "line":
      case "arrow": {
        const points = element.points.map(([px, py]) => ({
          x: getX(element.x + px),
          y: getY(element.y + py),
        }));

        if (points.length < 2) {
          return null;
        }

        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];

        const startArrowhead =
          element.type === "arrow"
            ? element.startArrowhead
            : null;

        const endArrowhead =
          element.type === "arrow"
            ? element.endArrowhead
            : null;

        return (
          <g
            key={element.id}
            transform={rotation}
          >
            <polyline
              points={points
                .map((point) => `${point.x},${point.y}`)
                .join(" ")}
              fill="none"
              stroke={stroke}
              strokeWidth={0.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {renderArrowhead(
              firstPoint,
              points[1],
              startArrowhead,
              stroke,
              `${element.id}-start`,
            )}

            {renderArrowhead(
              lastPoint,
              points[points.length - 2],
              endArrowhead,
              stroke,
              `${element.id}-end`,
            )}
          </g>
        );
      }

      // Freehand drawings.
      case "freedraw": {
        const points = element.points.map(([px, py]) => ({
          x: getX(element.x + px),
          y: getY(element.y + py),
        }));

        if (!points.length) {
          return null;
        }

        return (
          <polyline
            key={element.id}
            points={points
              .map((point) => `${point.x},${point.y}`)
              .join(" ")}
            fill="none"
            stroke={stroke}
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform={rotation}
          />
        );
      }

      // Rectangles and other elements.
      default:
        return (
          <rect
            key={element.id}
            x={x}
            y={y}
            width={elementWidth}
            height={elementHeight}
            rx={element.type === "rectangle" ? 2 : 0}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.7}
            transform={rotation}
          />
        );
    }
  };

  return (
    <div
      className="excalidraw-minimap"
      onClick={handleNavigate}
      onMouseDown={() => setIsDragging(true)}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onMouseMove={(event) => {
        if (isDragging) {
          handleNavigate(event);
        }
      }}
    >
      <svg
  width={MINIMAP_WIDTH}
  height={MINIMAP_HEIGHT}
  viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`}
>
  {/* Current viewport indicator - render behind shapes */}
  <rect
    x={getX(-scrollX)}
    y={getY(-scrollY)}
    width={(width / Math.max(zoom, 0.01)) * scale}
    height={(height / Math.max(zoom, 0.01)) * scale}
    fill="rgba(99, 102, 241, 0.08)"
    stroke="#6366f1"
    strokeWidth={1.2}
    pointerEvents="none"
  />

  {/* Render all canvas elements above viewport */}
  {elements
    .filter((element) => !element.isDeleted)
    .map(renderElement)}
</svg>
    </div>
  );
};

export default MiniMap;
