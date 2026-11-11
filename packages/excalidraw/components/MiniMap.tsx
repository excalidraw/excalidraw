import React, { useMemo, useState } from "react";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import "./MiniMap.scss";
import { getCommonBounds } from "@excalidraw/element";

interface MiniMapProps {
  elements: readonly ExcalidrawElement[];
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
  onNavigate: (x: number, y: number) => void;
}

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 140;
const PADDING = 12;

const MiniMap = ({
  elements,
  scrollX,
  scrollY,
  zoom,
  width,
  height,
  onNavigate,
}: MiniMapProps) => {
  const [isDragging, setIsDragging] = useState(false);

  


const bounds = useMemo(() => {
  const visibleElements = elements.filter(
    (element) => !element.isDeleted,
  );

  const safeZoom = Math.max(zoom, 0.01);

  // Current visible area in scene coordinates
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


  
const handleNavigate = (
  event: React.MouseEvent<HTMLDivElement>,
) => {
  const rect =
    event.currentTarget.getBoundingClientRect();

  const sceneX =
    (event.clientX - rect.left - offsetX) / scale +
    bounds.minX;

  const sceneY =
    (event.clientY - rect.top - offsetY) / scale +
    bounds.minY;

  onNavigate(sceneX, sceneY);
};


  const renderElement = (element: ExcalidrawElement) => {
    const x = getX(element.x);
    const y = getY(element.y);
    const width = Math.max(element.width * scale, 1);
    const height = Math.max(element.height * scale, 1);

    const fill = element.backgroundColor || "none";
    const stroke = element.strokeColor || "#64748b";

    switch (element.type) {
      case "ellipse":
        return (
          <ellipse
            key={element.id}
            cx={x + width / 2}
            cy={y + height / 2}
            rx={width / 2}
            ry={height / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.5}
          />
        );

      case "diamond":
        return (
          <polygon
            key={element.id}
            points={`
              ${x + width / 2},${y}
              ${x + width},${y + height / 2}
              ${x + width / 2},${y + height}
              ${x},${y + height / 2}
            `}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.5}
          />
        );

      case "line":
      case "arrow":
        return (
          <line
            key={element.id}
            x1={x}
            y1={y}
            x2={x + width}
            y2={y + height}
            stroke={stroke}
            strokeWidth={0.8}
          />
        );

      case "freedraw":
        return (
          <rect
            key={element.id}
            x={x}
            y={y}
            width={width}
            height={height}
            fill="none"
            stroke={stroke}
            strokeWidth={0.8}
          />
        );

      default:
        return (
          <rect
            key={element.id}
            x={x}
            y={y}
            width={width}
            height={height}
            rx={element.type === "rectangle" ? 2 : 0}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.5}
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
        {elements
          .filter((element) => !element.isDeleted)
          .map(renderElement)}
          {/* Current viewport indicator */}
<rect
  x={getX(-scrollX)}
  y={getY(-scrollY)}
  width={(width / Math.max(zoom, 0.01)) * scale}
  height={(height / Math.max(zoom, 0.01)) * scale}
  fill="rgba(99, 102, 241, 0.10)"
  stroke="#6366f1"
  strokeWidth={1.2}
  pointerEvents="none"
/>
      </svg>
    </div>
  );
};

export default MiniMap;
