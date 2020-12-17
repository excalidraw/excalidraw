//
// All icons are imported from https://fontawesome.com/icons?d=gallery
// Icons are under the license https://fontawesome.com/license
//

import React from "react";

import oc from "open-color";
import clsx from "clsx";

const activeElementColor = (appearance: "light" | "dark") =>
  appearance === "light" ? oc.orange[4] : oc.orange[9];
const iconFillColor = (appearance: "light" | "dark") =>
  appearance === "light" ? oc.black : oc.gray[4];
const handlerColor = (appearance: "light" | "dark") =>
  appearance === "light" ? oc.white : "#1e1e1e";

type Opts = { width?: number; height?: number; mirror?: true } & React.SVGProps<
  SVGSVGElement
>;

const createIcon = (d: string | React.ReactNode, opts: number | Opts = 512) => {
  const { width = 512, height = width, mirror, style } =
    typeof opts === "number" ? ({ width: opts } as Opts) : opts;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      className={clsx({ "rtl-mirror": mirror })}
      style={style}
    >
      {typeof d === "string" ? <path fill="currentColor" d={d} /> : d}
    </svg>
  );
};

export const link = createIcon(
  "M326.612 185.391c59.747 59.809 58.927 155.698.36 214.59-.11.12-.24.25-.36.37l-67.2 67.2c-59.27 59.27-155.699 59.262-214.96 0-59.27-59.26-59.27-155.7 0-214.96l37.106-37.106c9.84-9.84 26.786-3.3 27.294 10.606.648 17.722 3.826 35.527 9.69 52.721 1.986 5.822.567 12.262-3.783 16.612l-13.087 13.087c-28.026 28.026-28.905 73.66-1.155 101.96 28.024 28.579 74.086 28.749 102.325.51l67.2-67.19c28.191-28.191 28.073-73.757 0-101.83-3.701-3.694-7.429-6.564-10.341-8.569a16.037 16.037 0 0 1-6.947-12.606c-.396-10.567 3.348-21.456 11.698-29.806l21.054-21.055c5.521-5.521 14.182-6.199 20.584-1.731a152.482 152.482 0 0 1 20.522 17.197zM467.547 44.449c-59.261-59.262-155.69-59.27-214.96 0l-67.2 67.2c-.12.12-.25.25-.36.37-58.566 58.892-59.387 154.781.36 214.59a152.454 152.454 0 0 0 20.521 17.196c6.402 4.468 15.064 3.789 20.584-1.731l21.054-21.055c8.35-8.35 12.094-19.239 11.698-29.806a16.037 16.037 0 0 0-6.947-12.606c-2.912-2.005-6.64-4.875-10.341-8.569-28.073-28.073-28.191-73.639 0-101.83l67.2-67.19c28.239-28.239 74.3-28.069 102.325.51 27.75 28.3 26.872 73.934-1.155 101.96l-13.087 13.087c-4.35 4.35-5.769 10.79-3.783 16.612 5.864 17.194 9.042 34.999 9.69 52.721.509 13.906 17.454 20.446 27.294 10.606l37.106-37.106c59.271-59.259 59.271-155.699.001-214.959z",
  { mirror: true },
);

export const save = createIcon(
  "M433.941 129.941l-83.882-83.882A48 48 0 0 0 316.118 32H48C21.49 32 0 53.49 0 80v352c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V163.882a48 48 0 0 0-14.059-33.941zM224 416c-35.346 0-64-28.654-64-64 0-35.346 28.654-64 64-64s64 28.654 64 64c0 35.346-28.654 64-64 64zm96-304.52V212c0 6.627-5.373 12-12 12H76c-6.627 0-12-5.373-12-12V108c0-6.627 5.373-12 12-12h228.52c3.183 0 6.235 1.264 8.485 3.515l3.48 3.48A11.996 11.996 0 0 1 320 111.48z",
  { width: 448, height: 512 },
);

export const saveAs = createIcon(
  "M252 54L203 8a28 27 0 00-20-8H28C12 0 0 12 0 27v195c0 15 12 26 28 26h204c15 0 28-11 28-26V73a28 27 0 00-8-19zM130 213c-21 0-37-16-37-36 0-19 16-35 37-35 20 0 37 16 37 35 0 20-17 36-37 36zm56-169v56c0 4-4 6-7 6H44c-4 0-7-2-7-6V42c0-4 3-7 7-7h133l4 2 3 2a7 7 0 012 5z M296 201l87 95-188 205-78 9c-10 1-19-8-18-20l9-84zm141-14l-41-44a31 31 0 00-46 0l-38 41 87 95 38-42c13-14 13-36 0-50z",
  { width: 448, height: 512 },
);

export const load = createIcon(
  "M572.694 292.093L500.27 416.248A63.997 63.997 0 0 1 444.989 448H45.025c-18.523 0-30.064-20.093-20.731-36.093l72.424-124.155A64 64 0 0 1 152 256h399.964c18.523 0 30.064 20.093 20.73 36.093zM152 224h328v-48c0-26.51-21.49-48-48-48H272l-64-64H48C21.49 64 0 85.49 0 112v278.046l69.077-118.418C86.214 242.25 117.989 224 152 224z",
  { width: 576, height: 512, mirror: true },
);

export const clipboard = createIcon(
  "M384 112v352c0 26.51-21.49 48-48 48H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h80c0-35.29 28.71-64 64-64s64 28.71 64 64h80c26.51 0 48 21.49 48 48zM192 40c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24m96 114v-20a6 6 0 0 0-6-6H102a6 6 0 0 0-6 6v20a6 6 0 0 0 6 6h180a6 6 0 0 0 6-6z",
  { width: 384, height: 512 },
);

export const trash = createIcon(
  "M32 464a48 48 0 0 0 48 48h288a48 48 0 0 0 48-48V128H32zm272-256a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zM432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16z",
  { width: 448, height: 512 },
);

export const palette = createIcon(
  "M204.3 5C104.9 24.4 24.8 104.3 5.2 203.4c-37 187 131.7 326.4 258.8 306.7 41.2-6.4 61.4-54.6 42.5-91.7-23.1-45.4 9.9-98.4 60.9-98.4h79.7c35.8 0 64.8-29.6 64.9-65.3C511.5 97.1 368.1-26.9 204.3 5zM96 320c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm32-128c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm128-64c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm128 64c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z",
);

export const exportFile = createIcon(
  "M384 121.9c0-6.3-2.5-12.4-7-16.9L279.1 7c-4.5-4.5-10.6-7-17-7H256v128h128zM571 308l-95.7-96.4c-10.1-10.1-27.4-3-27.4 11.3V288h-64v64h64v65.2c0 14.3 17.3 21.4 27.4 11.3L571 332c6.6-6.6 6.6-17.4 0-24zm-379 28v-32c0-8.8 7.2-16 16-16h176V160H248c-13.2 0-24-10.8-24-24V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V352H208c-8.8 0-16-7.2-16-16z",
  { width: 576, height: 512, mirror: true },
);

export const zoomIn = createIcon(
  "M416 208H272V64c0-17.67-14.33-32-32-32h-32c-17.67 0-32 14.33-32 32v144H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h144v144c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32V304h144c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32z",
  { width: 448, height: 512 },
);

export const zoomOut = createIcon(
  "M416 208H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h384c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32z",
  { width: 448, height: 512 },
);

export const done = createIcon(
  "M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z",
  { mirror: true },
);

export const menu = createIcon(
  "M16 132h416c8.837 0 16-7.163 16-16V76c0-8.837-7.163-16-16-16H16C7.163 60 0 67.163 0 76v40c0 8.837 7.163 16 16 16zm0 160h416c8.837 0 16-7.163 16-16v-40c0-8.837-7.163-16-16-16H16c-8.837 0-16 7.163-16 16v40c0 8.837 7.163 16 16 16zm0 160h416c8.837 0 16-7.163 16-16v-40c0-8.837-7.163-16-16-16H16c-8.837 0-16 7.163-16 16v40c0 8.837 7.163 16 16 16z",
);

export const undo = createIcon(
  "M255.545 8c-66.269.119-126.438 26.233-170.86 68.685L48.971 40.971C33.851 25.851 8 36.559 8 57.941V192c0 13.255 10.745 24 24 24h134.059c21.382 0 32.09-25.851 16.971-40.971l-41.75-41.75c30.864-28.899 70.801-44.907 113.23-45.273 92.398-.798 170.283 73.977 169.484 169.442C423.236 348.009 349.816 424 256 424c-41.127 0-79.997-14.678-110.63-41.556-4.743-4.161-11.906-3.908-16.368.553L89.34 422.659c-4.872 4.872-4.631 12.815.482 17.433C133.798 479.813 192.074 504 256 504c136.966 0 247.999-111.033 248-247.998C504.001 119.193 392.354 7.755 255.545 8z",
  { mirror: true },
);

export const redo = createIcon(
  "M256.455 8c66.269.119 126.437 26.233 170.859 68.685l35.715-35.715C478.149 25.851 504 36.559 504 57.941V192c0 13.255-10.745 24-24 24H345.941c-21.382 0-32.09-25.851-16.971-40.971l41.75-41.75c-30.864-28.899-70.801-44.907-113.23-45.273-92.398-.798-170.283 73.977-169.484 169.442C88.764 348.009 162.184 424 256 424c41.127 0 79.997-14.678 110.629-41.556 4.743-4.161 11.906-3.908 16.368.553l39.662 39.662c4.872 4.872 4.631 12.815-.482 17.433C378.202 479.813 319.926 504 256 504 119.034 504 8.001 392.967 8 256.002 7.999 119.193 119.646 7.755 256.455 8z",
  { mirror: true },
);

// Icon imported form Storybook
// Storybook is licensed under MIT https://github.com/storybookjs/storybook/blob/next/LICENSE
export const resetZoom = createIcon(
  <path
    stroke="currentColor"
    strokeWidth="40"
    fill="currentColor"
    d="M148 560a318 318 0 0 0 522 110 316 316 0 0 0 0-450 316 316 0 0 0-450 0c-11 11-21 22-30 34v4h47c25 0 46 21 46 46s-21 45-46 45H90c-13 0-25-6-33-14-9-9-14-20-14-33V156c0-25 20-45 45-45s45 20 45 45v32l1 1a401 401 0 0 1 623 509l212 212a42 42 0 0 1-59 59L698 757A401 401 0 0 1 65 570a42 42 0 0 1 83-10z"
  />,
  { width: 1024 },
);

export const BringForwardIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M22 9.556C22 8.696 21.303 8 20.444 8H16v8H8v4.444C8 21.304 8.697 22 9.556 22h10.888c.86 0 1.556-.697 1.556-1.556V9.556z"
          fill={iconFillColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
        />
        <path
          d="M16 3.556C16 2.696 15.303 2 14.444 2H3.556C2.696 2 2 2.697 2 3.556v10.888C2 15.304 2.697 16 3.556 16h10.888c.86 0 1.556-.697 1.556-1.556V3.556z"
          fill={activeElementColor(appearance)}
          stroke={activeElementColor(appearance)}
          strokeWidth="2"
        />
      </>,
      { width: 24 },
    ),
);

export const SendBackwardIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M16 3.556C16 2.696 15.303 2 14.444 2H3.556C2.696 2 2 2.697 2 3.556v10.888C2 15.304 2.697 16 3.556 16h10.888c.86 0 1.556-.697 1.556-1.556V3.556z"
          fill={activeElementColor(appearance)}
          stroke={activeElementColor(appearance)}
          strokeWidth="2"
        />
        <path
          d="M22 9.556C22 8.696 21.303 8 20.444 8H9.556C8.696 8 8 8.697 8 9.556v10.888C8 21.304 8.697 22 9.556 22h10.888c.86 0 1.556-.697 1.556-1.556V9.556z"
          fill={iconFillColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
        />
      </>,
      { width: 24 },
    ),
);

export const BringToFrontIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M13 21a1 1 0 001 1h7a1 1 0 001-1v-7a1 1 0 00-1-1h-3v5h-5v3zM11 3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h3V6h5V3z"
          fill={iconFillColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
        />
        <path
          d="M18 7.333C18 6.597 17.403 6 16.667 6H7.333C6.597 6 6 6.597 6 7.333v9.334C6 17.403 6.597 18 7.333 18h9.334c.736 0 1.333-.597 1.333-1.333V7.333z"
          fill={activeElementColor(appearance)}
          stroke={activeElementColor(appearance)}
          strokeWidth="2"
        />
      </>,
      { width: 24 },
    ),
);

export const SendToBackIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M18 7.333C18 6.597 17.403 6 16.667 6H7.333C6.597 6 6 6.597 6 7.333v9.334C6 17.403 6.597 18 7.333 18h9.334c.736 0 1.333-.597 1.333-1.333V7.333z"
          fill={activeElementColor(appearance)}
          stroke={activeElementColor(appearance)}
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M11 3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h8V3zM22 14a1 1 0 00-1-1h-7a1 1 0 00-1 1v7a1 1 0 001 1h8v-8z"
          fill={iconFillColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </>,
      { width: 24 },
    ),
);

//
// Align action icons created from scratch to match those of z-index actions
//
export const AlignTopIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M 2,5 H 22"
          fill={iconFillColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M 6,7 C 5.446,7 5,7.446 5,8 v 9.999992 c 0,0.554 0.446,1 1,1 h 3.0000001 c 0.554,0 0.9999999,-0.446 0.9999999,-1 V 8 C 10,7.446 9.5540001,7 9.0000001,7 Z m 9,0 c -0.554,0 -1,0.446 -1,1 v 5.999992 c 0,0.554 0.446,1 1,1 h 3 c 0.554,0 1,-0.446 1,-1 V 8 C 19,7.446 18.554,7 18,7 Z"
          fill={activeElementColor(appearance)}
          stroke={activeElementColor(appearance)}
          strokeWidth="2"
        />
      </>,
      { width: 24 },
    ),
);

export const AlignBottomIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M 2,19 H 22"
          fill={iconFillColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="m 6,16.999992 c -0.554,0 -1,-0.446 -1,-1 V 6 C 5,5.446 5.446,5 6,5 H 9.0000001 C 9.5540001,5 10,5.446 10,6 v 9.999992 c 0,0.554 -0.4459999,1 -0.9999999,1 z m 9,0 c -0.554,0 -1,-0.446 -1,-1 V 10 c 0,-0.554 0.446,-1 1,-1 h 3 c 0.554,0 1,0.446 1,1 v 5.999992 c 0,0.554 -0.446,1 -1,1 z"
          fill={activeElementColor(appearance)}
          stroke={activeElementColor(appearance)}
          strokeWidth="2"
        />
      </>,
      { width: 24 },
    ),
);

export const AlignLeftIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M 5,2 V 22"
          fill={iconFillColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="m 7.000004,5.999996 c 0,-0.554 0.446,-1 1,-1 h 9.999992 c 0.554,0 1,0.446 1,1 v 3.0000001 c 0,0.554 -0.446,0.9999999 -1,0.9999999 H 8.000004 c -0.554,0 -1,-0.4459999 -1,-0.9999999 z m 0,9 c 0,-0.554 0.446,-1 1,-1 h 5.999992 c 0.554,0 1,0.446 1,1 v 3 c 0,0.554 -0.446,1 -1,1 H 8.000004 c -0.554,0 -1,-0.446 -1,-1 z"
          fill={activeElementColor(appearance)}
          stroke={activeElementColor(appearance)}
          strokeWidth="2"
        />
      </>,
      { width: 24 },
    ),
);

export const AlignRightIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M 19,2 V 22"
          fill={iconFillColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="m 16.999996,5.999996 c 0,-0.554 -0.446,-1 -1,-1 H 6.000004 c -0.554,0 -1,0.446 -1,1 v 3.0000001 c 0,0.554 0.446,0.9999999 1,0.9999999 h 9.999992 c 0.554,0 1,-0.4459999 1,-0.9999999 z m 0,9 c 0,-0.554 -0.446,-1 -1,-1 h -5.999992 c -0.554,0 -1,0.446 -1,1 v 3 c 0,0.554 0.446,1 1,1 h 5.999992 c 0.554,0 1,-0.446 1,-1 z"
          fill={activeElementColor(appearance)}
          stroke={activeElementColor(appearance)}
          strokeWidth="2"
        />
      </>,
      { width: 24 },
    ),
);

export const CenterVerticallyIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="m 5.000004,16.999996 c 0,0.554 0.446,1 1,1 h 3 c 0.554,0 1,-0.446 1,-1 v -10 c 0,-0.554 -0.446,-1 -1,-1 h -3 c -0.554,0 -1,0.446 -1,1 z m 9,-2 c 0,0.554 0.446,1 1,1 h 3 c 0.554,0 1,-0.446 1,-1 v -6 c 0,-0.554 -0.446,-1 -1,-1 h -3 c -0.554,0 -1,0.446 -1,1 z"
          fill={activeElementColor(appearance)}
          stroke={activeElementColor(appearance)}
          strokeWidth="2"
        />
        <path
          d="M 2,12 H 22"
          fill={iconFillColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
          strokeDasharray="1, 2.8"
          strokeLinecap="round"
        />
      </>,
      { width: 24 },
    ),
);

export const CenterHorizontallyIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M 7 5 C 6.446 5 6 5.446 6 6 L 6 9 C 6 9.554 6.446 10 7 10 L 17 10 C 17.554 10 18 9.554 18 9 L 18 6 C 18 5.446 17.554 5 17 5 L 7 5 z M 9 14 C 8.446 14 8 14.446 8 15 L 8 18 C 8 18.554 8.446 19 9 19 L 15 19 C 15.554 19 16 18.554 16 18 L 16 15 C 16 14.446 15.554 14 15 14 L 9 14 z "
          fill={activeElementColor(appearance)}
          stroke={activeElementColor(appearance)}
          strokeWidth="2"
        />
        <path
          d="M 12,2 V 22"
          fill={iconFillColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
          strokeDasharray="1, 2.8"
          strokeLinecap="round"
        />
      </>,
      { width: 24 },
    ),
);

export const users = createIcon(
  "M192 256c61.9 0 112-50.1 112-112S253.9 32 192 32 80 82.1 80 144s50.1 112 112 112zm76.8 32h-8.3c-20.8 10-43.9 16-68.5 16s-47.6-6-68.5-16h-8.3C51.6 288 0 339.6 0 403.2V432c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48v-28.8c0-63.6-51.6-115.2-115.2-115.2zM480 256c53 0 96-43 96-96s-43-96-96-96-96 43-96 96 43 96 96 96zm48 32h-3.8c-13.9 4.8-28.6 8-44.2 8s-30.3-3.2-44.2-8H432c-20.4 0-39.2 5.9-55.7 15.4 24.4 26.3 39.7 61.2 39.7 99.8v38.4c0 2.2-.5 4.3-.6 6.4H592c26.5 0 48-21.5 48-48 0-61.9-50.1-112-112-112z",
  { width: 640, height: 512, mirror: true },
);

export const start = createIcon(
  "M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm115.7 272l-176 101c-15.8 8.8-35.7-2.5-35.7-21V152c0-18.4 19.8-29.8 35.7-21l176 107c16.4 9.2 16.4 32.9 0 42z",
);

export const stop = createIcon(
  "M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm96 328c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V176c0-8.8 7.2-16 16-16h160c8.8 0 16 7.2 16 16v160z",
);

export const close = createIcon(
  "M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z",
  { width: 352, height: 512 },
);

export const back = createIcon(
  "M34.52 239.03L228.87 44.69c9.37-9.37 24.57-9.37 33.94 0l22.67 22.67c9.36 9.36 9.37 24.52.04 33.9L131.49 256l154.02 154.75c9.34 9.38 9.32 24.54-.04 33.9l-22.67 22.67c-9.37 9.37-24.57 9.37-33.94 0L34.52 272.97c-9.37-9.37-9.37-24.57 0-33.94z",
  { width: 320, height: 512, style: { marginLeft: "-0.2rem" }, mirror: true },
);

export const clone = createIcon(
  "M464 0c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48H176c-26.51 0-48-21.49-48-48V48c0-26.51 21.49-48 48-48h288M176 416c-44.112 0-80-35.888-80-80V128H48c-26.51 0-48 21.49-48 48v288c0 26.51 21.49 48 48 48h288c26.51 0 48-21.49 48-48v-48H176z",
  { mirror: true },
);

// modified https://feathericons.com/?query=shield
export const shield = createIcon(
  "M11.553 22.894a.998.998 0 00.894 0s3.037-1.516 5.465-4.097C19.616 16.987 21 14.663 21 12V5a1 1 0 00-.649-.936l-8-3a.998.998 0 00-.702 0l-8 3A1 1 0 003 5v7c0 2.663 1.384 4.987 3.088 6.797 2.428 2.581 5.465 4.097 5.465 4.097zm-1.303-8.481l6.644-6.644a.856.856 0 111.212 1.212l-7.25 7.25a.856.856 0 01-1.212 0l-3.75-3.75a.856.856 0 111.212-1.212l3.144 3.144z",
  { width: 24 },
);

export const GroupIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path d="M25 26H111V111H25" fill={iconFillColor(appearance)} />
        <path
          d="M25 111C25 80.2068 25 49.4135 25 26M25 26C48.6174 26 72.2348 26 111 26H25ZM25 26C53.3671 26 81.7343 26 111 26H25ZM111 26C111 52.303 111 78.606 111 111V26ZM111 26C111 51.2947 111 76.5893 111 111V26ZM111 111C87.0792 111 63.1585 111 25 111H111ZM111 111C87.4646 111 63.9293 111 25 111H111ZM25 111C25 81.1514 25 51.3028 25 26V111Z"
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
        />
        <path d="M100 100H160V160H100" fill={iconFillColor(appearance)} />
        <path
          d="M100 160C100 144.106 100 128.211 100 100M100 100C117.706 100 135.412 100 160 100H100ZM100 100C114.214 100 128.428 100 160 100H100ZM160 100C160 120.184 160 140.369 160 160V100ZM160 100C160 113.219 160 126.437 160 160V100ZM160 160C145.534 160 131.068 160 100 160H160ZM160 160C143.467 160 126.934 160 100 160H160ZM100 160C100 143.661 100 127.321 100 100V160Z"
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
        />
        <rect
          x="2.5"
          y="2.5"
          width="30"
          height="30"
          fill={handlerColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="6"
        />
        <rect
          x="2.5"
          y="149.5"
          width="30"
          height="30"
          fill={handlerColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="6"
        />
        <rect
          x="147.5"
          y="149.5"
          width="30"
          height="30"
          fill={handlerColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="6"
        />
        <rect
          x="147.5"
          y="2.5"
          width="30"
          height="30"
          fill={handlerColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="6"
        />
      </>,
      { width: 182, height: 182 },
    ),
);

export const UngroupIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path d="M25 26H111V111H25" fill={iconFillColor(appearance)} />
        <path
          d="M25 111C25 80.2068 25 49.4135 25 26M25 26C48.6174 26 72.2348 26 111 26H25ZM25 26C53.3671 26 81.7343 26 111 26H25ZM111 26C111 52.303 111 78.606 111 111V26ZM111 26C111 51.2947 111 76.5893 111 111V26ZM111 111C87.0792 111 63.1585 111 25 111H111ZM111 111C87.4646 111 63.9293 111 25 111H111ZM25 111C25 81.1514 25 51.3028 25 26V111Z"
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
        />
        <path d="M100 100H160V160H100" fill={iconFillColor(appearance)} />
        <path
          d="M100 160C100 144.106 100 128.211 100 100M100 100C117.706 100 135.412 100 160 100H100ZM100 100C114.214 100 128.428 100 160 100H100ZM160 100C160 120.184 160 140.369 160 160V100ZM160 100C160 113.219 160 126.437 160 160V100ZM160 160C145.534 160 131.068 160 100 160H160ZM160 160C143.467 160 126.934 160 100 160H160ZM100 160C100 143.661 100 127.321 100 100V160Z"
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
        />
        <rect
          x="2.5"
          y="2.5"
          width="30"
          height="30"
          fill={handlerColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="6"
        />
        <rect
          x="78.5"
          y="149.5"
          width="30"
          height="30"
          fill={handlerColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="6"
        />
        <rect
          x="147.5"
          y="149.5"
          width="30"
          height="30"
          fill={handlerColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="6"
        />
        <rect
          x="147.5"
          y="78.5"
          width="30"
          height="30"
          fill={handlerColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="6"
        />
        <rect
          x="105.5"
          y="2.5"
          width="30"
          height="30"
          fill={handlerColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="6"
        />
        <rect
          x="2.5"
          y="102.5"
          width="30"
          height="30"
          fill={handlerColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="6"
        />
      </>,
      { width: 182, height: 182 },
    ),
);

export const FillHachureIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <g stroke={iconFillColor(appearance)} fill="none">
        <path d="M0 0s0 0 0 0m0 0s0 0 0 0m.133 12.04L10.63-.033M.133 12.04L10.63-.034M2.234 21.818L21.26-.07M2.234 21.818L21.26-.07m-8.395 21.852L31.89-.103M12.865 21.783L31.89-.103m-8.395 21.852L41.208 1.37M23.495 21.75L41.208 1.37m-7.083 20.343l7.216-8.302m-7.216 8.302l7.216-8.302" />
        <path
          d="M0 0h40M0 0h40m0 0v20m0-20v20m0 0H0m40 0H0m0 0V0m0 20V0"
          strokeWidth={2}
        />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const FillCrossHatchIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <g stroke={iconFillColor(appearance)} fill="none">
        <path d="M0 0s0 0 0 0m0 0s0 0 0 0m.133 12.04L10.63-.033M.133 12.04L10.63-.034M2.234 21.818L21.26-.07M2.234 21.818L21.26-.07m-8.395 21.852L31.89-.103M12.865 21.783C17.87 16.025 22.875 10.266 31.89-.103m-8.395 21.852L41.208 1.37M23.495 21.75L41.208 1.37m-7.083 20.343l7.216-8.302m-7.216 8.302l7.216-8.302M-.09 19.92s0 0 0 0m0 0s0 0 0 0m12.04-.133L-.126 9.29m12.075 10.497L-.126 9.29m24.871 11.02C19.872 16.075 15 11.84.595-.684m24.15 20.994L.595-.684m36.19 20.861L12.636-.817m24.15 20.994L12.636-.817m30.909 16.269L24.676-.95m18.868 16.402L24.676-.95m18.833 5.771L37.472-.427m6.037 5.248L37.472-.427" />
        <path
          d="M0 0h40M0 0h40m0 0v20m0-20v20m0 0H0m40 0H0m0 0V0m0 20V0"
          strokeWidth={2}
        />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const FillSolidIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path d="M0 0h120v60H0" strokeWidth={0} />
        <path
          d="M0 0h40M0 0h40m0 0v20m0-20v20m0 0H0m40 0H0m0 0V0m0 20V0"
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          fill="none"
        />
      </>,
      { width: 40, height: 20 },
    ),
);

export const StrokeWidthIcon = React.memo(
  ({
    appearance,
    strokeWidth,
  }: {
    appearance: "light" | "dark";
    strokeWidth: number;
  }) =>
    createIcon(
      <path
        d="M0 10h40M0 10h40"
        stroke={iconFillColor(appearance)}
        strokeWidth={strokeWidth}
        fill="none"
      />,
      { width: 40, height: 20 },
    ),
);

export const StrokeStyleSolidIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M0 10h40M0 10h40"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20 },
    ),
);

export const StrokeStyleDashedIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M3.286 9.998h32.759"
        stroke={iconFillColor(appearance)}
        strokeWidth={2.5}
        fill="none"
        strokeDasharray="12 8"
      />,
      { width: 40, height: 20 },
    ),
);

export const StrokeStyleDottedIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M0 10h40M0 10h40"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
        strokeDasharray="3 6"
      />,
      { width: 40, height: 20 },
    ),
);

export const SloppinessArchitectIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M.268 17.938C4.05 15.093 19.414.725 22.96.868c3.547.143-4.149 16.266-1.41 17.928 2.738 1.662 14.866-6.632 17.84-7.958m-39.123 7.1C4.05 15.093 19.414.725 22.96.868c3.547.143-4.149 16.266-1.41 17.928 2.738 1.662 14.866-6.632 17.84-7.958"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20 },
    ),
);

export const SloppinessArtistIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M2.663 18.134c3.963-2.578 18.855-12.098 22.675-12.68 3.82-.58-1.966 8.367.242 9.196 2.209.828 10.649-3.14 13.01-4.224M7.037 15.474c4.013-2.198 14.19-14.648 17.18-14.32 2.99.329-1.749 14.286.759 16.292 2.507 2.006 12.284-2.68 14.286-4.256"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20 },
    ),
);

export const SloppinessCartoonistIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M1.944 17.15C6.056 14.637 22.368 1.86 26.615 2.083c4.248.223-.992 14.695.815 16.406 1.807 1.71 8.355-5.117 10.026-6.14m-35.512 4.8C6.056 14.637 22.368 1.86 26.615 2.083c4.248.223-.992 14.695.815 16.406 1.807 1.71 8.355-5.117 10.026-6.14"
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          fill="none"
        />
        <path
          d="M3.114 10.534c2.737-1.395 12.854-8.814 16.42-8.368 3.568.445 2.35 10.282 4.984 11.04 2.635.756 9.019-5.416 10.822-6.5M3.114 10.535c2.737-1.395 12.854-8.814 16.42-8.368 3.568.445 2.35 10.282 4.984 11.04 2.635.756 9.019-5.416 10.822-6.5"
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          fill="none"
        />
      </>,
      { width: 40, height: 20 },
    ),
);

export const EdgeSharpIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M9.18 19.68V6.346m0 13.336V6.345m0 0h29.599m-29.6 0h29.6"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20 },
    ),
);

export const EdgeRoundIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M9.444 19.537c.484-2.119-2.1-10.449 2.904-12.71 5.004-2.263 22.601-.72 27.121-.863M9.444 19.537c.484-2.119-2.1-10.449 2.904-12.71 5.004-2.263 22.601-.72 27.121-.863"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20 },
    ),
);

// Source: https://github.com/FortAwesome/Font-Awesome/blob/master/svgs/solid/align-left.svg
export const TextAlignLeftIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M12.83 352h262.34A12.82 12.82 0 00288 339.17v-38.34A12.82 12.82 0 00275.17 288H12.83A12.82 12.82 0 000 300.83v38.34A12.82 12.82 0 0012.83 352zm0-256h262.34A12.82 12.82 0 00288 83.17V44.83A12.82 12.82 0 00275.17 32H12.83A12.82 12.82 0 000 44.83v38.34A12.82 12.82 0 0012.83 96zM432 160H16a16 16 0 00-16 16v32a16 16 0 0016 16h416a16 16 0 0016-16v-32a16 16 0 00-16-16zm0 256H16a16 16 0 00-16 16v32a16 16 0 0016 16h416a16 16 0 0016-16v-32a16 16 0 00-16-16z"
        fill={iconFillColor(appearance)}
      />,
      { width: 448, height: 512 },
    ),
);

// Source: https://github.com/FortAwesome/Font-Awesome/blob/master/svgs/solid/align-center.svg
export const TextAlignCenterIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M432 160H16a16 16 0 00-16 16v32a16 16 0 0016 16h416a16 16 0 0016-16v-32a16 16 0 00-16-16zm0 256H16a16 16 0 00-16 16v32a16 16 0 0016 16h416a16 16 0 0016-16v-32a16 16 0 00-16-16zM108.1 96h231.81A12.09 12.09 0 00352 83.9V44.09A12.09 12.09 0 00339.91 32H108.1A12.09 12.09 0 0096 44.09V83.9A12.1 12.1 0 00108.1 96zm231.81 256A12.09 12.09 0 00352 339.9v-39.81A12.09 12.09 0 00339.91 288H108.1A12.09 12.09 0 0096 300.09v39.81a12.1 12.1 0 0012.1 12.1z"
        fill={iconFillColor(appearance)}
      />,
      { width: 448, height: 512 },
    ),
);

// Source: https://github.com/FortAwesome/Font-Awesome/blob/master/svgs/solid/align-right.svg
export const TextAlignRightIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M16 224h416a16 16 0 0016-16v-32a16 16 0 00-16-16H16a16 16 0 00-16 16v32a16 16 0 0016 16zm416 192H16a16 16 0 00-16 16v32a16 16 0 0016 16h416a16 16 0 0016-16v-32a16 16 0 00-16-16zm3.17-384H172.83A12.82 12.82 0 00160 44.83v38.34A12.82 12.82 0 00172.83 96h262.34A12.82 12.82 0 00448 83.17V44.83A12.82 12.82 0 00435.17 32zm0 256H172.83A12.82 12.82 0 00160 300.83v38.34A12.82 12.82 0 00172.83 352h262.34A12.82 12.82 0 00448 339.17v-38.34A12.82 12.82 0 00435.17 288z"
        fill={iconFillColor(appearance)}
      />,
      { width: 448, height: 512 },
    ),
);
