//
// All icons are imported from https://feathericons.com/ Made by @colebemis
// github: https://github.com/feathericons/feather
// Feather is a collection of simply beautiful open source icons.
// Each icon is designed on a 24x24 grid with an emphasis on simplicity, consistency, and flexibility.
// Icons are under the license https://github.com/feathericons/feather/blob/master/LICENSE
// Small adjusments and additions by @tomfejer
//
import React from "react";
import oc from "open-color";

// We inline icons in order to save on js size rather than including the font awesome react library
export const SHAPES = [
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 11L22 2L13 21L11 13L3 11Z"
          stroke={oc.black}
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    ),
    value: "selection",
    key: ["v", "s"],
  },
  {
    icon: (
      <svg width={24} height={24} fill="none">
        <path
          d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z"
          stroke={oc.black}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    value: "rectangle",
    key: "r",
  },
  {
    icon: (
      <svg width={24} height={24} fill="none">
        <path
          d="M12.5 2.5L6 12l6.5 9.5L19 12l-6.5-9.5z"
          stroke={oc.black}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    value: "diamond",
    key: "d",
  },
  {
    icon: (
      <svg width={24} height={24} fill="none">
        <path
          d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
          stroke={oc.black}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    value: "ellipse",
    key: "e",
  },
  {
    icon: (
      <svg width={24} height={24} fill="none">
        <path
          d="M5 12h14M12 5l7 7-7 7"
          stroke={oc.black}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    value: "arrow",
    key: "a",
  },
  {
    icon: (
      <svg width={24} height={24} fill="none">
        <path
          d="M5 12h14"
          stroke={oc.black}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    value: "line",
    key: ["p", "l"],
  },
  {
    icon: (
      <svg width={24} height={24} fill="none">
        <path
          d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"
          stroke={oc.black}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    value: "draw",
    key: ["P", "x"],
  },
  {
    icon: (
      <svg width={24} height={24} fill="none">
        <path
          d="M4 7V4h16v3M9 20h6M12 4v16"
          stroke={oc.black}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    value: "text",
    key: "t",
  },
] as const;

export const findShapeByKey = (key: string) => {
  const shape = SHAPES.find((shape, index) => {
    return (
      key === (index + 1).toString() ||
      (typeof shape.key === "string"
        ? shape.key === key
        : (shape.key as readonly string[]).includes(key))
    );
  });
  return shape?.value || null;
};
