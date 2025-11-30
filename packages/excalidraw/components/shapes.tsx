import { KEYS } from "@excalidraw/common";

import {
  SelectionIcon,
  RectangleIcon,
  DiamondIcon,
  EllipseIcon,
  ArrowIcon,
  LineIcon,
  FreedrawIcon,
  TextIcon,
  ImageIcon,
  EraserIcon,
} from "./icons";

import type { AppClassProperties } from "../types";

export const SHAPES = [
  {
    icon: SelectionIcon,
    value: "selection",
    key: KEYS.V,
    numericKey: KEYS["1"],
    fillable: true,
  },
  {
    icon: RectangleIcon,
    value: "rectangle",
    key: KEYS.R,
    numericKey: KEYS["2"],
    fillable: true,
  },
  {
    icon: DiamondIcon,
    value: "diamond",
    key: KEYS.D,
    numericKey: KEYS["3"],
    fillable: true,
  },
  {
    icon: EllipseIcon,
    value: "ellipse",
    key: KEYS.O,
    numericKey: KEYS["4"],
    fillable: true,
  },
  {
    icon: ArrowIcon,
    value: "arrow",
    key: KEYS.A,
    numericKey: KEYS["5"],
    fillable: true,
  },
  {
    icon: LineIcon,
    value: "line",
    key: KEYS.L,
    numericKey: KEYS["6"],
    fillable: true,
  },
  {
    icon: FreedrawIcon,
    value: "freedraw",
    key: [KEYS.P, KEYS.X],
    numericKey: KEYS["7"],
    fillable: false,
  },
  {
    icon: TextIcon,
    value: "text",
    key: KEYS.T,
    numericKey: KEYS["8"],
    fillable: false,
  },
  {
    icon: ImageIcon,
    value: "image",
    key: null,
    numericKey: KEYS["9"],
    fillable: false,
  },
  {
    icon: EraserIcon,
    value: "eraser",
    key: KEYS.E,
    numericKey: KEYS["0"],
    fillable: false,
  },
] as const;

export const getToolbarTools = (app: AppClassProperties) => {
  return app.state.preferredSelectionTool.type === "lasso"
    ? ([
        {
          value: "lasso",
          icon: SelectionIcon,
          key: KEYS.V,
          numericKey: KEYS["1"],
          fillable: true,
        },
        ...SHAPES.slice(1),
      ] as const)
    : SHAPES;
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
