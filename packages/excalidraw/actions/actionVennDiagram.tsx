import { getNonDeletedElements, newElementWith } from "@excalidraw/element";

import { KEYS, randomId } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawRectangleElement,
  ExcalidrawFreeDrawElement,
} from "@excalidraw/element/types";

import polygonClipping from "polygon-clipping";

import { ToolButton } from "../components/ToolButton";
import { VennIcon } from "../components/icons";

import { t } from "../i18n";

import { isSomeElementSelected } from "../scene";

import { getShortcutKey } from "../shortcut";

import { register } from "./register";

import type { AppClassProperties, AppState } from "../types";

/**
 * Subdivide a line segment into multiple points
 */
const subdivideLine = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  segments: number,
): [number, number][] => {
  const points: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    points.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
  }
  return points;
};

/**
 * Converts an Excalidraw element to a polygon representation for boolean operations
 */
const elementToPolygon = (
  element: ExcalidrawElement,
): [number, number][][] => {
  if (element.type === "rectangle") {
    const rect = element as ExcalidrawRectangleElement;
    // Rectangle as polygon with subdivided edges for smoother shrinking
    const segmentsPerSide = 8;
    const points: [number, number][] = [
      ...subdivideLine(element.x, element.y, element.x + rect.width, element.y, segmentsPerSide),
      ...subdivideLine(element.x + rect.width, element.y, element.x + rect.width, element.y + rect.height, segmentsPerSide),
      ...subdivideLine(element.x + rect.width, element.y + rect.height, element.x, element.y + rect.height, segmentsPerSide),
      ...subdivideLine(element.x, element.y + rect.height, element.x, element.y, segmentsPerSide),
      [element.x, element.y], // Close the polygon
    ];
    return [points];
  } else if (element.type === "ellipse") {
    const ellipse = element as ExcalidrawEllipseElement;
    // Approximate ellipse as polygon with 32 points
    const segments = 32;
    const points: [number, number][] = [];
    const centerX = element.x + ellipse.width / 2;
    const centerY = element.y + ellipse.height / 2;
    const radiusX = ellipse.width / 2;
    const radiusY = ellipse.height / 2;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      const x = centerX + radiusX * Math.cos(angle);
      const y = centerY + radiusY * Math.sin(angle);
      points.push([x, y]);
    }

    return [points];
  } else if (element.type === "diamond") {
    // Diamond as polygon with subdivided edges for smoother shrinking
    const halfWidth = element.width / 2;
    const halfHeight = element.height / 2;
    const segmentsPerSide = 8;
    const points: [number, number][] = [
      ...subdivideLine(element.x + halfWidth, element.y, element.x + element.width, element.y + halfHeight, segmentsPerSide), // top to right
      ...subdivideLine(element.x + element.width, element.y + halfHeight, element.x + halfWidth, element.y + element.height, segmentsPerSide), // right to bottom
      ...subdivideLine(element.x + halfWidth, element.y + element.height, element.x, element.y + halfHeight, segmentsPerSide), // bottom to left
      ...subdivideLine(element.x, element.y + halfHeight, element.x + halfWidth, element.y, segmentsPerSide), // left to top
      [element.x + halfWidth, element.y], // Close
    ];
    return [points];
  } else if (element.type === "line" && element.points.length > 2) {
    // Freehand or multi-point line - treat as polygon
    const points: [number, number][] = element.points.map((p) => [
      element.x + p[0],
      element.y + p[1],
    ]);
    // Close the polygon if not already closed
    if (
      points[0][0] !== points[points.length - 1][0] ||
      points[0][1] !== points[points.length - 1][1]
    ) {
      points.push(points[0]);
    }
    return [points];
  }

  // Unsupported shape type - return empty polygon
  return [[[0, 0]]];
};

/**
 * Shrinks a polygon inward by a given distance (negative buffer)
 * This prevents regions from overlapping with outlines
 */
const shrinkPolygon = (
  polygon: [number, number][],
  shrinkAmount: number = 8,
): [number, number][] => {
  // Calculate centroid
  const n = polygon.length;
  let cx = 0,
    cy = 0;
  for (const [x, y] of polygon) {
    cx += x;
    cy += y;
  }
  cx /= n;
  cy /= n;

  // Move each point toward centroid
  return polygon.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return [x, y] as [number, number];

    const ratio = Math.max(0, dist - shrinkAmount) / dist;
    return [cx + dx * ratio, cy + dy * ratio] as [number, number];
  });
};

/**
 * Creates a new Excalidraw freedraw element from a polygon
 */
const polygonToFreeDrawElement = (
  polygon: [number, number][],
  color: string,
  fillStyle: "hachure" | "cross-hatch" | "solid" = "hachure",
  shrinkAmount: number = 0,
): ExcalidrawFreeDrawElement => {
  // Optionally shrink polygon to avoid overlapping outlines
  const processedPolygon =
    shrinkAmount > 0 ? shrinkPolygon(polygon, shrinkAmount) : polygon;
  // Find top-left corner
  const xs = processedPolygon.map((p) => p[0]);
  const ys = processedPolygon.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  // Convert absolute coordinates to relative points
  const points: [number, number][] = processedPolygon.map((p) => [
    p[0] - minX,
    p[1] - minY,
  ]);

  return {
    id: randomId(),
    type: "freedraw",
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    angle: 0 as any,
    strokeColor: color,
    backgroundColor: color,
    fillStyle,
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 80,
    groupIds: [],
    frameId: null,
    index: null,
    roundness: null,
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1,
    versionNonce: 0,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points,
    pressures: [],
    simulatePressure: true,
    lastCommittedPoint: null,
    customData: undefined,
  } as unknown as ExcalidrawFreeDrawElement;
};

/**
 * Generate distinct colors for Venn diagram regions
 */
const generateVennColors = (count: number): string[] => {
  const colors = [
    "#ff6b6b", // red
    "#4ecdc4", // cyan
    "#45b7d1", // blue
    "#f9ca24", // yellow
    "#6c5ce7", // purple
    "#00b894", // green
    "#fdcb6e", // orange
    "#e17055", // coral
  ];

  return colors.slice(0, Math.min(count, colors.length));
};

/**
 * Check if Venn diagram action should be enabled
 */
const enableVennDiagram = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  app: AppClassProperties,
): boolean => {
  const selectedElements = app.scene.getSelectedElements({
    selectedElementIds: appState.selectedElementIds,
    includeBoundTextElement: false,
  });

  // Need 2 or 3 elements
  if (selectedElements.length < 2 || selectedElements.length > 3) {
    return false;
  }

  // Check if all selected elements are supported shape types
  return selectedElements.every(
    (el) =>
      el.type === "rectangle" ||
      el.type === "ellipse" ||
      el.type === "diamond" ||
      (el.type === "line" && el.points.length > 2),
  );
};

export const actionVennDiagram = register({
  name: "vennDiagram",
  label: "labels.vennDiagram",
  icon: (appState) => <VennIcon theme={appState.theme} />,
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: false,
    });

    if (selectedElements.length < 2) {
      return {
        appState,
        elements,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const colors = generateVennColors(selectedElements.length);
    const fillStyles: Array<"hachure" | "cross-hatch" | "solid"> = [
      "hachure",
      "cross-hatch",
      "solid",
    ];
    let nextElements = [...elements];

    // Remove original elements
    const selectedIds = new Set(selectedElements.map((el) => el.id));
    nextElements = nextElements.filter((el) => !selectedIds.has(el.id));

    // Automatically position shapes in overlapping Venn pattern
    const repositionedElements = [...selectedElements];

    if (selectedElements.length === 2) {
      // For 2 shapes: horizontal overlap
      const first = selectedElements[0];
      const second = selectedElements[1];

      // Keep first shape at its position, move second to overlap
      const overlapAmount = first.width * 0.65; // 35% overlap
      repositionedElements[1] = newElementWith(second, {
        x: first.x + overlapAmount,
        y: first.y,
      }) as any;
    } else if (selectedElements.length === 3) {
      // For 3 shapes: triangle pattern with overlaps
      const first = selectedElements[0];
      const second = selectedElements[1];
      const third = selectedElements[2];

      // Position in triangle: first at top-left, second at top-right, third at bottom-center
      const overlapAmount = first.width * 0.65;
      const verticalOffset = first.height * 0.55;

      repositionedElements[1] = newElementWith(second, {
        x: first.x + overlapAmount,
        y: first.y,
      }) as any;

      repositionedElements[2] = newElementWith(third, {
        x: first.x + overlapAmount * 0.5,
        y: first.y + verticalOffset,
      }) as any;
    }

    try {

      // Convert all shapes to polygons (using repositioned elements)
      const polygons = repositionedElements.map((el) => elementToPolygon(el));

      // Add outlines first (bottom layer) - using repositioned elements
      repositionedElements.forEach((el) => {
        const outline = newElementWith(el, {
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 2,
        }) as any;
        nextElements.push(outline);
      });

      // For 2 shapes: calculate all regions
      if (selectedElements.length === 2) {
        // A only (not B)
        try {
          const aOnly = polygonClipping.difference(polygons[0], polygons[1]);
          if (aOnly && aOnly.length > 0) {
            aOnly.forEach((multiPolygon) => {
              multiPolygon.forEach((ring) => {
                const region = polygonToFreeDrawElement(
                  ring,
                  "#ffffff",
                  "solid",
                  8, // shrink white regions to avoid outline overlap
                );
                nextElements.push(region as any);
              });
            });
          }
        } catch (err) {
          console.warn("Failed to calculate A only:", err);
        }

        // B only (not A)
        try {
          const bOnly = polygonClipping.difference(polygons[1], polygons[0]);
          if (bOnly && bOnly.length > 0) {
            bOnly.forEach((multiPolygon) => {
              multiPolygon.forEach((ring) => {
                const region = polygonToFreeDrawElement(
                  ring,
                  "#ffffff",
                  "solid",
                  8, // shrink white regions to avoid outline overlap
                );
                nextElements.push(region as any);
              });
            });
          }
        } catch (err) {
          console.warn("Failed to calculate B only:", err);
        }

        // A∩B
        try {
          const intersection = polygonClipping.intersection(
            polygons[0],
            polygons[1],
          );

          if (intersection && intersection.length > 0) {
            intersection.forEach((multiPolygon) => {
              multiPolygon.forEach((ring) => {
                const region = polygonToFreeDrawElement(
                  ring,
                  colors[0],
                  "hachure",
                  8, // shrink to match white regions and avoid outline overlap
                );
                nextElements.push(region as any);
              });
            });
          }
        } catch (err) {
          console.warn("Failed to calculate intersection:", err);
        }
      }

      // For 3 shapes: calculate all regions
      else if (selectedElements.length === 3) {
        // A only (not B, not C)
        try {
          const aNotB = polygonClipping.difference(polygons[0], polygons[1]);
          const aOnly = polygonClipping.difference(aNotB, polygons[2]);
          if (aOnly && aOnly.length > 0) {
            aOnly.forEach((multiPolygon) => {
              multiPolygon.forEach((ring) => {
                const region = polygonToFreeDrawElement(
                  ring,
                  "#ffffff",
                  "solid",
                  8, // shrink to avoid outline overlap
                );
                nextElements.push(region as any);
              });
            });
          }
        } catch (err) {
          console.warn("Failed to calculate A only:", err);
        }

        // B only (not A, not C)
        try {
          const bNotA = polygonClipping.difference(polygons[1], polygons[0]);
          const bOnly = polygonClipping.difference(bNotA, polygons[2]);
          if (bOnly && bOnly.length > 0) {
            bOnly.forEach((multiPolygon) => {
              multiPolygon.forEach((ring) => {
                const region = polygonToFreeDrawElement(
                  ring,
                  "#ffffff",
                  "solid",
                  8, // shrink to avoid outline overlap
                );
                nextElements.push(region as any);
              });
            });
          }
        } catch (err) {
          console.warn("Failed to calculate B only:", err);
        }

        // C only (not A, not B)
        try {
          const cNotA = polygonClipping.difference(polygons[2], polygons[0]);
          const cOnly = polygonClipping.difference(cNotA, polygons[1]);
          if (cOnly && cOnly.length > 0) {
            cOnly.forEach((multiPolygon) => {
              multiPolygon.forEach((ring) => {
                const region = polygonToFreeDrawElement(
                  ring,
                  "#ffffff",
                  "solid",
                  8, // shrink to avoid outline overlap
                );
                nextElements.push(region as any);
              });
            });
          }
        } catch (err) {
          console.warn("Failed to calculate C only:", err);
        }

        // A∩B (not C)
        try {
          const ab = polygonClipping.intersection(polygons[0], polygons[1]);
          const abNotC = polygonClipping.difference(ab, polygons[2]);

          if (abNotC && abNotC.length > 0) {
            abNotC.forEach((multiPolygon) => {
              multiPolygon.forEach((ring) => {
                const region = polygonToFreeDrawElement(
                  ring,
                  colors[0],
                  "hachure",
                  8, // shrink to match white regions and avoid outline overlap
                );
                nextElements.push(region as any);
              });
            });
          }
        } catch (err) {
          console.warn("Failed to calculate A∩B region:", err);
        }

        // B∩C (not A)
        try {
          const bc = polygonClipping.intersection(polygons[1], polygons[2]);
          const bcNotA = polygonClipping.difference(bc, polygons[0]);

          if (bcNotA && bcNotA.length > 0) {
            bcNotA.forEach((multiPolygon) => {
              multiPolygon.forEach((ring) => {
                const region = polygonToFreeDrawElement(
                  ring,
                  colors[1],
                  "hachure",
                  8, // shrink to match white regions and avoid outline overlap
                );
                nextElements.push(region as any);
              });
            });
          }
        } catch (err) {
          console.warn("Failed to calculate B∩C region:", err);
        }

        // A∩C (not B)
        try {
          const ac = polygonClipping.intersection(polygons[0], polygons[2]);
          const acNotB = polygonClipping.difference(ac, polygons[1]);

          if (acNotB && acNotB.length > 0) {
            acNotB.forEach((multiPolygon) => {
              multiPolygon.forEach((ring) => {
                const region = polygonToFreeDrawElement(
                  ring,
                  colors[2],
                  "hachure",
                  8, // shrink to match white regions and avoid outline overlap
                );
                nextElements.push(region as any);
              });
            });
          }
        } catch (err) {
          console.warn("Failed to calculate A∩C region:", err);
        }

        // A∩B∩C (center)
        try {
          const ab = polygonClipping.intersection(polygons[0], polygons[1]);
          const abc = polygonClipping.intersection(ab, polygons[2]);

          if (abc && abc.length > 0) {
            abc.forEach((multiPolygon) => {
              multiPolygon.forEach((ring) => {
                const region = polygonToFreeDrawElement(
                  ring,
                  "#2c3e50",
                  "cross-hatch",
                  8, // shrink to match white regions and avoid outline overlap
                );
                nextElements.push(region as any);
              });
            });
          }
        } catch (err) {
          console.warn("Failed to calculate A∩B∩C region:", err);
        }
      }
    } catch (error) {
      console.error("Error creating Venn diagram:", error);
      // Fallback: just show the repositioned shapes
      repositionedElements.forEach((el) => {
        nextElements.push(el as any);
      });
    }

    return {
      appState: {
        ...appState,
        selectedElementIds: {},
      },
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState, _, app) =>
    enableVennDiagram(elements, appState, app),
  keyTest: (event) =>
    event.shiftKey && event[KEYS.CTRL_OR_CMD] && event.key === KEYS.D,
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <ToolButton
      hidden={!enableVennDiagram(elements, appState, app)}
      type="button"
      icon={<VennIcon theme={appState.theme} />}
      onClick={() => updateData(null)}
      title={`${t("labels.vennDiagram")} — ${getShortcutKey("CtrlOrCmd+Shift+D")}`}
      aria-label={t("labels.vennDiagram")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    ></ToolButton>
  ),
});
