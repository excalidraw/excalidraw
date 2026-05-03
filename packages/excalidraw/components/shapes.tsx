import { KEYS, capitalizeString } from "@excalidraw/common";

import { t } from "../i18n";

import {
  SelectionIcon,
  LassoIcon,
  RectangleIcon,
  DiamondIcon,
  EllipseIcon,
  ArrowIcon,
  LineIcon,
  FreedrawIcon,
  TextIcon,
  ImageIcon,
  EraserIcon,
  laserPointerToolIcon,
  handIcon,
} from "./icons";

import type { AppClassProperties } from "../types";

export const SELECTION_TOOLS = [
  { type: "selection", icon: SelectionIcon },
  { type: "lasso", icon: LassoIcon },
] as const;

export const getSelectionToolOptions = () =>
  SELECTION_TOOLS.map(({ type, icon }) => ({
    type,
    icon,
    title: capitalizeString(
      t(type === "selection" ? "toolBar.selection" : "toolBar.lasso"),
    ),
  }));

export const SHAPES = [
  {
    icon: handIcon,
    value: "hand",
    key: KEYS.H,
    numericKey: null,
    fillable: false,
    toolbar: true,
  },
  {
    icon: SelectionIcon,
    value: "selection",
    key: KEYS.V,
    numericKey: KEYS["1"],
    fillable: true,
    toolbar: true,
  },
  {
    icon: RectangleIcon,
    value: "rectangle",
    key: KEYS.R,
    numericKey: KEYS["2"],
    fillable: true,
    toolbar: true,
  },
  {
    icon: DiamondIcon,
    value: "diamond",
    key: KEYS.D,
    numericKey: KEYS["3"],
    fillable: true,
    toolbar: true,
  },
  {
    icon: EllipseIcon,
    value: "ellipse",
    key: KEYS.O,
    numericKey: KEYS["4"],
    fillable: true,
    toolbar: true,
  },
  {
    icon: ArrowIcon,
    value: "arrow",
    key: KEYS.A,
    numericKey: KEYS["5"],
    fillable: true,
    toolbar: true,
  },
  {
    icon: LineIcon,
    value: "line",
    key: KEYS.L,
    numericKey: KEYS["6"],
    fillable: true,
    toolbar: true,
  },
  {
    icon: FreedrawIcon,
    value: "freedraw",
    key: [KEYS.P, KEYS.X],
    numericKey: KEYS["7"],
    fillable: false,
    toolbar: true,
  },
  {
    icon: TextIcon,
    value: "text",
    key: KEYS.T,
    numericKey: KEYS["8"],
    fillable: false,
    toolbar: true,
  },
  {
    icon: ImageIcon,
    value: "image",
    key: null,
    numericKey: KEYS["9"],
    fillable: false,
    toolbar: true,
  },
  {
    icon: EraserIcon,
    value: "eraser",
    key: KEYS.E,
    numericKey: KEYS["0"],
    fillable: false,
    toolbar: true,
  },
  {
    icon: laserPointerToolIcon,
    value: "laser",
    key: KEYS.K,
    numericKey: null,
    fillable: false,
    toolbar: false,
  },
] as const;

export const getToolbarTools = (app: AppClassProperties) => {
  const selectionType = app.state.preferredSelectionTool.type;

  if (selectionType === "selection") {
    return SHAPES;
  }

  const selectionTool = SELECTION_TOOLS.find((t) => t.type === selectionType);

  if (!selectionTool) {
    return SHAPES;
  }

  return SHAPES.map((shape) =>
    shape.value === "selection"
      ? ({ ...shape, value: selectionType, icon: selectionTool.icon } as const)
      : shape,
  );
};

export const findShapeByKey = (key: string, app: AppClassProperties) => {
  const shape = getToolbarTools(app).find((shape, index) => {
    return (
      (shape.numericKey != null && key === shape.numericKey.toString()) ||
      (shape.key &&
        (typeof shape.key === "string"
          ? shape.key === key
          : (shape.key as readonly string[]).includes(key)))
    );
  });
  return shape?.value || null;
};
