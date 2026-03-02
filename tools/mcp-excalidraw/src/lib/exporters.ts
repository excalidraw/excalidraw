import type { ExcalidrawScene } from "./types";

export const exportSceneAsJson = (scene: ExcalidrawScene): string => {
  return `${JSON.stringify(scene, null, 2)}\n`;
};

interface PointLike {
  0: number;
  1: number;
}

interface ElementLike {
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  opacity?: number;
  points?: PointLike[];
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  isDeleted?: boolean;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const SVG_PADDING = 16;

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const pickStroke = (element: ElementLike): string => {
  const color = element.strokeColor;
  return typeof color === "string" && color.trim() ? color : "#1f1f1f";
};

const pickFill = (element: ElementLike): string => {
  const color = element.backgroundColor;
  return typeof color === "string" && color.trim() && color !== "transparent"
    ? color
    : "none";
};

const pickOpacity = (element: ElementLike): string => {
  const opacity = asNumber(element.opacity, 100);
  return `${Math.min(1, Math.max(0, opacity / 100))}`;
};

const pickStrokeWidth = (element: ElementLike): number =>
  Math.max(1, asNumber(element.strokeWidth, 1));

const normalizeLinePoints = (element: ElementLike): Array<{ x: number; y: number }> => {
  const baseX = asNumber(element.x);
  const baseY = asNumber(element.y);

  if (!Array.isArray(element.points) || element.points.length === 0) {
    const width = asNumber(element.width, 1);
    const height = asNumber(element.height, 1);
    return [
      { x: baseX, y: baseY },
      { x: baseX + width, y: baseY + height },
    ];
  }

  return element.points.map((point) => ({
    x: baseX + asNumber(point?.[0]),
    y: baseY + asNumber(point?.[1]),
  }));
};

const elementBounds = (element: ElementLike): Bounds => {
  const x = asNumber(element.x);
  const y = asNumber(element.y);

  if (element.type === "line" || element.type === "arrow" || element.type === "draw") {
    const points = normalizeLinePoints(element);
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  const width = Math.abs(asNumber(element.width));
  const height = Math.abs(asNumber(element.height));
  return {
    minX: Math.min(x, x + width),
    minY: Math.min(y, y + height),
    maxX: Math.max(x, x + width),
    maxY: Math.max(y, y + height),
  };
};

const sceneBounds = (elements: ElementLike[]): Bounds => {
  if (elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  return elements.reduce<Bounds>(
    (acc, element) => {
      const bounds = elementBounds(element);
      return {
        minX: Math.min(acc.minX, bounds.minX),
        minY: Math.min(acc.minY, bounds.minY),
        maxX: Math.max(acc.maxX, bounds.maxX),
        maxY: Math.max(acc.maxY, bounds.maxY),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
};

const applyRotation = (element: ElementLike, body: string): string => {
  const angleRad = asNumber(element.angle);
  if (!angleRad) {
    return body;
  }

  const centerX = asNumber(element.x) + asNumber(element.width) / 2;
  const centerY = asNumber(element.y) + asNumber(element.height) / 2;
  const angleDeg = (angleRad * 180) / Math.PI;
  return `<g transform="rotate(${angleDeg} ${centerX} ${centerY})">${body}</g>`;
};

const renderText = (element: ElementLike): string => {
  const x = asNumber(element.x);
  const y = asNumber(element.y);
  const fontSize = Math.max(10, asNumber(element.fontSize, 20));
  const text = typeof element.text === "string" ? element.text : "";
  const lines = text.split("\n");
  const fontFamily =
    element.fontFamily === 3 ? "Virgil, sans-serif" : "Helvetica, Arial, sans-serif";

  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? "0" : `${fontSize * 1.2}`;
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text x="${x}" y="${y}" fill="${pickStroke(
    element,
  )}" font-family="${fontFamily}" font-size="${fontSize}" dominant-baseline="hanging" opacity="${pickOpacity(
    element,
  )}">${tspans}</text>`;
};

const renderElement = (element: ElementLike): string => {
  const type = element.type || "";
  const x = asNumber(element.x);
  const y = asNumber(element.y);
  const width = Math.max(1, Math.abs(asNumber(element.width, 1)));
  const height = Math.max(1, Math.abs(asNumber(element.height, 1)));
  const stroke = pickStroke(element);
  const fill = pickFill(element);
  const strokeWidth = pickStrokeWidth(element);
  const opacity = pickOpacity(element);

  if (type === "rectangle") {
    return applyRotation(
      element,
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />`,
    );
  }

  if (type === "ellipse") {
    return applyRotation(
      element,
      `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${
        width / 2
      }" ry="${height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />`,
    );
  }

  if (type === "diamond") {
    const points = `${x + width / 2},${y} ${x + width},${y + height / 2} ${
      x + width / 2
    },${y + height} ${x},${y + height / 2}`;
    return applyRotation(
      element,
      `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />`,
    );
  }

  if (type === "line" || type === "draw" || type === "arrow") {
    const points = normalizeLinePoints(element);
    const commands = points
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
      )
      .join(" ");
    const marker = type === "arrow" ? ' marker-end="url(#arrowhead)"' : "";
    return `<path d="${commands}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"${marker} />`;
  }

  if (type === "text") {
    return renderText(element);
  }

  if (type === "image") {
    const frame = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#f4f4f4" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />`;
    const label = `<text x="${x + width / 2}" y="${
      y + height / 2
    }" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="${stroke}" opacity="${opacity}">image</text>`;
    return applyRotation(element, `${frame}${label}`);
  }

  if (type === "frame") {
    return applyRotation(
      element,
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="8 6" opacity="${opacity}" />`,
    );
  }

  return applyRotation(
    element,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />`,
  );
};

export const exportSceneAsSvg = async (scene: ExcalidrawScene): Promise<string> => {
  const elements = (Array.isArray(scene.elements) ? scene.elements : [])
    .filter((element) => typeof element === "object" && element !== null)
    .map((element) => element as ElementLike)
    .filter((element) => !element.isDeleted);

  const bounds = sceneBounds(elements);
  const minX = bounds.minX - SVG_PADDING;
  const minY = bounds.minY - SVG_PADDING;
  const width = Math.max(1, bounds.maxX - bounds.minX + SVG_PADDING * 2);
  const height = Math.max(1, bounds.maxY - bounds.minY + SVG_PADDING * 2);
  const viewBackgroundColor =
    typeof scene.appState?.viewBackgroundColor === "string"
      ? scene.appState.viewBackgroundColor
      : "#ffffff";

  const body = elements.map((element) => renderElement(element)).join("");

  return `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}"><!-- svg-source:excalidraw --><defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#1f1f1f" /></marker></defs><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${escapeXml(
    viewBackgroundColor,
  )}" />${body}</svg>`;
};
