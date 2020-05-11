import React from "react";
import oc from "open-color";

// We inline font-awesome icons in order to save on js size rather than including the font awesome react library
export const SHAPES = [
  {
    icon: (
      // fa-mouse-pointer
      <svg viewBox="0 0 320 512" className="">
        <path d="M302.189 329.126H196.105l55.831 135.993c3.889 9.428-.555 19.999-9.444 23.999l-49.165 21.427c-9.165 4-19.443-.571-23.332-9.714l-53.053-129.136-86.664 89.138C18.729 472.71 0 463.554 0 447.977V18.299C0 1.899 19.921-6.096 30.277 5.443l284.412 292.542c11.472 11.179 3.007 31.141-12.5 31.141z" />
      </svg>
    ),
    value: "selection",
    key: "s",
  },
  {
    icon: (
      // fa-square
      <svg viewBox="0 0 448 512">
        <path d="M400 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48z" />
      </svg>
    ),
    value: "rectangle",
    key: "r",
  },
  {
    icon: (
      // fa-draw-polygon
      <svg viewBox="0 0 448 512">
        <path
          fill="currentColor"
          d="M384 352c-.35 0-.67.1-1.02.1l-39.2-65.32c5.07-9.17 8.22-19.56 8.22-30.78s-3.14-21.61-8.22-30.78l39.2-65.32c.35.01.67.1 1.02.1 35.35 0 64-28.65 64-64s-28.65-64-64-64c-23.63 0-44.04 12.95-55.12 32H119.12C108.04 44.95 87.63 32 64 32 28.65 32 0 60.65 0 96c0 23.63 12.95 44.04 32 55.12v209.75C12.95 371.96 0 392.37 0 416c0 35.35 28.65 64 64 64 23.63 0 44.04-12.95 55.12-32h209.75c11.09 19.05 31.49 32 55.12 32 35.35 0 64-28.65 64-64 .01-35.35-28.64-64-63.99-64zm-288 8.88V151.12A63.825 63.825 0 0 0 119.12 128h208.36l-38.46 64.1c-.35-.01-.67-.1-1.02-.1-35.35 0-64 28.65-64 64s28.65 64 64 64c.35 0 .67-.1 1.02-.1l38.46 64.1H119.12A63.748 63.748 0 0 0 96 360.88zM272 256c0-8.82 7.18-16 16-16s16 7.18 16 16-7.18 16-16 16-16-7.18-16-16zM400 96c0 8.82-7.18 16-16 16s-16-7.18-16-16 7.18-16 16-16 16 7.18 16 16zM64 80c8.82 0 16 7.18 16 16s-7.18 16-16 16-16-7.18-16-16 7.18-16 16-16zM48 416c0-8.82 7.18-16 16-16s16 7.18 16 16-7.18 16-16 16-16-7.18-16-16zm336 16c-8.82 0-16-7.18-16-16s7.18-16 16-16 16 7.18 16 16-7.18 16-16 16z"
        ></path>
      </svg>
    ),
    value: "draw",
    key: "x",
  },
  {
    icon: (
      // custom
      <svg viewBox="0 0 223.646 223.646">
        <path d="M111.823 0L16.622 111.823 111.823 223.646 207.025 111.823z" />
      </svg>
    ),
    value: "diamond",
    key: "d",
  },
  {
    icon: (
      // fa-circle
      <svg viewBox="0 0 512 512">
        <path d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z" />
      </svg>
    ),
    value: "ellipse",
    key: "e",
  },
  {
    icon: (
      // fa-long-arrow-alt-right
      <svg viewBox="0 0 448 512" className="rtl-mirror">
        <path d="M313.941 216H12c-6.627 0-12 5.373-12 12v56c0 6.627 5.373 12 12 12h301.941v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.569 0-33.941l-86.059-86.059c-15.119-15.119-40.971-4.411-40.971 16.971V216z" />
      </svg>
    ),
    value: "arrow",
    key: "a",
  },
  {
    icon: (
      // custom
      <svg viewBox="0 0 6 6">
        <line
          x1="0"
          y1="3"
          x2="6"
          y2="3"
          stroke={oc.black}
          strokeLinecap="round"
        />
      </svg>
    ),
    value: "line",
    key: "l",
  },
  {
    icon: (
      // fa-font
      <svg viewBox="0 0 448 512">
        <path d="M432 416h-23.41L277.88 53.69A32 32 0 0 0 247.58 32h-47.16a32 32 0 0 0-30.3 21.69L39.41 416H16a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16v-32a16 16 0 0 0-16-16h-19.58l23.3-64h152.56l23.3 64H304a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16v-32a16 16 0 0 0-16-16zM176.85 272L224 142.51 271.15 272z" />
      </svg>
    ),
    value: "text",
    key: "t",
  },
] as const;

export const shapesShortcutKeys = SHAPES.map((shape, index) => [
  shape.key,
  (index + 1).toString(),
]).flat(1);

export function findShapeByKey(key: string) {
  return (
    SHAPES.find((shape, index) => {
      return shape.key === key.toLowerCase() || key === (index + 1).toString();
    })?.value || "selection"
  );
}
