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

export const SHAPES = [
  {
    icon: SelectionIcon,
    value: "selection",
    key: KEYS.V,
    codes: ["KeyV", "Digit1"],
    numericKey: KEYS["1"],
    fillable: true,
  },
  {
    icon: RectangleIcon,
    value: "rectangle",
    key: KEYS.R,
    codes: ["KeyR", "Digit2"],
    numericKey: KEYS["2"],
    fillable: true,
  },
  {
    icon: DiamondIcon,
    value: "diamond",
    key: KEYS.D,
    codes: ["KeyD", "Digit3"],
    numericKey: KEYS["3"],
    fillable: true,
  },
  {
    icon: EllipseIcon,
    value: "ellipse",
    key: KEYS.O,
    codes: ["KeyO", "Digit4"],
    numericKey: KEYS["4"],
    fillable: true,
  },
  {
    icon: ArrowIcon,
    value: "arrow",
    key: KEYS.A,
    codes: ["KeyA", "Digit5"],
    numericKey: KEYS["5"],
    fillable: true,
  },
  {
    icon: LineIcon,
    value: "line",
    key: KEYS.L,
    codes: ["KeyL", "Digit6"],
    numericKey: KEYS["6"],
    fillable: true,
  },
  {
    icon: FreedrawIcon,
    value: "freedraw",
    key: [KEYS.P, KEYS.X],
    codes: ["KeyP", "KeyX", "Digit7"],
    numericKey: KEYS["7"],
    fillable: false,
  },
  {
    icon: TextIcon,
    value: "text",
    key: KEYS.T,
    codes: ["KeyT", "Digit8"],
    numericKey: KEYS["8"],
    fillable: false,
  },
  {
    icon: ImageIcon,
    value: "image",
    key: null,
    codes: ["Digit9"],
    numericKey: KEYS["9"],
    fillable: false,
  },
  {
    icon: EraserIcon,
    value: "eraser",
    key: KEYS.E,
    codes: ["KeyE", "Digit0"],
    numericKey: KEYS["0"],
    fillable: false,
  },
] as const;

export const findShapeByKey = (key: string) => {
  const shape = SHAPES.find((shape, index) => {
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

export const findShapeByCode = (code: string) => {
  const shape = SHAPES.find((shape) =>
    (shape.codes as readonly string[]).includes(code),
  );
  return shape?.value || null;
};
