import React from "react";

// We inline  icons in order to save on js size rather than including the font awesome react library
export const SHAPES = [
  {
    icon: (
      <svg width={24} height={24} fill="none">
        <path
          d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3zM13 13l6 6"
          stroke="currentColor"
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
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
          stroke="currentColor"
          fill="none"
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
          stroke="currentColor"
          fill="none"
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
          stroke="currentColor"
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    value: "ellipse",
    key: ["e"],
  },
  {
    icon: (
      <svg width={24} height={24} fill="none">
        <path
          d="M5 12h14M12 5l7 7-7 7"
          stroke="currentColor"
          fill="none"
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
          stroke="currentColor"
          fill="none"
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
          stroke="currentColor"
          fill="none"
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
          stroke="currentColor"
          fill="none"
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
