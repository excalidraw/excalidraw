//
// All icons are imported from https://fontawesome.com/icons?d=gallery
// Icons are under the license https://fontawesome.com/license
//

// Note: when adding new icons, review https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/RTL_Guidelines
// to determine whether or not the icons should be mirrored in right-to-left languages.

import React from "react";

import oc from "open-color";
import clsx from "clsx";

const activeElementColor = (appearance: "light" | "dark") =>
  appearance === "light" ? oc.orange[4] : oc.orange[9];
const iconFillColor = (appearance: "light" | "dark") =>
  appearance === "light" ? oc.black : oc.gray[4];
const handlerColor = (appearance: "light" | "dark") =>
  appearance === "light" ? oc.white : "#1e1e1e";

type Opts = {
  width?: number;
  height?: number;
  mirror?: true;
} & React.SVGProps<SVGSVGElement>;

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

export const questionCircle = createIcon(
  "M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zM262.655 90c-54.497 0-89.255 22.957-116.549 63.758-3.536 5.286-2.353 12.415 2.715 16.258l34.699 26.31c5.205 3.947 12.621 3.008 16.665-2.122 17.864-22.658 30.113-35.797 57.303-35.797 20.429 0 45.698 13.148 45.698 32.958 0 14.976-12.363 22.667-32.534 33.976C247.128 238.528 216 254.941 216 296v4c0 6.627 5.373 12 12 12h56c6.627 0 12-5.373 12-12v-1.333c0-28.462 83.186-29.647 83.186-106.667 0-58.002-60.165-102-116.531-102zM256 338c-25.365 0-46 20.635-46 46 0 25.364 20.635 46 46 46s46-20.636 46-46c0-25.365-20.635-46-46-46z",
  { mirror: true },
);

export const share = createIcon(
  "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z",
  { width: 24, height: 24 },
);

export const shareIOS = createIcon(
  "M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z",
  { width: 24, height: 24 },
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
      { width: 24, mirror: true },
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
      { width: 24, mirror: true },
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
      { width: 24, mirror: true },
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
      { width: 24, mirror: true },
    ),
);

//
// Align action icons created from scratch to match those of z-index actions
// Note: vertical align icons are flipped so the larger item is always the
// first one the user sees. Horizontal align icons should not be flipped since
// that would make them lie about their function.
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
      { width: 24, mirror: true },
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
      { width: 24, mirror: true },
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

export const DistributeHorizontallyIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path d="M5 5V19Z" fill="black" />
        <path
          d="M19 5V19M5 5V19"
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M15 9C15.554 9 16 9.446 16 10V14C16 14.554 15.554 15 15 15H9C8.446 15 8 14.554 8 14V10C8 9.446 8.446 9 9 9H15Z"
          fill={activeElementColor(appearance)}
          stroke={activeElementColor(appearance)}
          strokeWidth="2"
        />
      </>,
      { width: 24 },
    ),
);

<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
></svg>;

export const DistributeVerticallyIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M5 5L19 5M5 19H19"
          fill={iconFillColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M15 9C15.554 9 16 9.446 16 10V14C16 14.554 15.554 15 15 15H9C8.446 15 8 14.554 8 14V10C8 9.446 8.446 9 9 9H15Z"
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
      { width: 24, mirror: true },
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

// not mirrored because it's inspired by a playback control, which is always RTL
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
      { width: 182, height: 182, mirror: true },
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
      { width: 182, height: 182, mirror: true },
    ),
);

export const FillHachureIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.101 16H28.0934L36 8.95989V4H33.5779L20.101 16ZM30.5704 4L17.0935 16H9.10101L22.5779 4H30.5704ZM19.5704 4L6.09349 16H4V10.7475L11.5779 4H19.5704ZM8.57036 4H4V8.06952L8.57036 4ZM36 11.6378L31.101 16H36V11.6378ZM2 2V18H38V2H2Z"
        fill={iconFillColor(appearance)}
      />,
      { width: 40, height: 20 },
    ),
);

export const FillCrossHatchIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <g fill={iconFillColor(appearance)} fillRule="evenodd" clipRule="evenodd">
        <path d="M20.101 16H28.0934L36 8.95989V4H33.5779L20.101 16ZM30.5704 4L17.0935 16H9.10101L22.5779 4H30.5704ZM19.5704 4L6.09349 16H4V10.7475L11.5779 4H19.5704ZM8.57036 4H4V8.06952L8.57036 4ZM36 11.6378L31.101 16H36V11.6378ZM2 2V18H38V2H2Z" />
        <path d="M14.0001 18L3.00006 4.00002L4.5727 2.76438L15.5727 16.7644L14.0001 18ZM25.0001 18L14.0001 4.00002L15.5727 2.76438L26.5727 16.7644L25.0001 18ZM36.0001 18L25.0001 4.00002L26.5727 2.76438L37.5727 16.7644L36.0001 18Z" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const FillSolidIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(<path d="M2 2H38V18H2V2Z" fill={iconFillColor(appearance)} />, {
      width: 40,
      height: 20,
    }),
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
        d="M6 10H34"
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
        d="M6 10H34"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      />,
      {
        width: 40,
        height: 20,
      },
    ),
);

export const StrokeStyleDashedIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M6 10H34"
        stroke={iconFillColor(appearance)}
        strokeWidth={2.5}
        strokeDasharray={"10, 8"}
        fill="none"
      />,
      { width: 40, height: 20 },
    ),
);

export const StrokeStyleDottedIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M6 10H34"
        stroke={iconFillColor(appearance)}
        strokeWidth={2.5}
        strokeDasharray={"4, 4"}
        fill="none"
      />,
      { width: 40, height: 20 },
    ),
);

export const SloppinessArchitectIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M3.00098 16.1691C6.28774 13.9744 19.6399 2.8905 22.7215 3.00082C25.8041 3.11113 19.1158 15.5488 21.4962 16.8309C23.8757 18.1131 34.4155 11.7148 37.0001 10.6919"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20, mirror: true },
    ),
);

export const SloppinessArtistIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M3 17C6.68158 14.8752 16.1296 9.09849 22.0648 6.54922C28 3.99995 22.2896 13.3209 25 14C27.7104 14.6791 36.3757 9.6471 36.3757 9.6471M6.40706 15C13 11.1918 20.0468 1.51045 23.0234 3.0052C26 4.49995 20.457 12.8659 22.7285 16.4329C25 20 36.3757 13 36.3757 13"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20, mirror: true },
    ),
);

export const SloppinessCartoonistIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M3 15.6468C6.93692 13.5378 22.5544 2.81528 26.6206 3.00242C30.6877 3.18956 25.6708 15.3346 27.4009 16.7705C29.1309 18.2055 35.4001 12.4762 37 11.6177M3.97143 10.4917C6.61158 9.24563 16.3706 2.61886 19.8104 3.01724C23.2522 3.41472 22.0773 12.2013 24.6181 12.8783C27.1598 13.5536 33.3179 8.04068 35.0571 7.07244"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20, mirror: true },
    ),
);

export const EdgeSharpIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M10 17L10 5L35 5"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20, mirror: true },
    ),
);

export const EdgeRoundIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M10 17V15C10 8 13 5 21 5L33.5 5"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20, mirror: true },
    ),
);

export const ArrowheadNoneIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        d="M6 10H34"
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      />,
      {
        width: 40,
        height: 20,
      },
    ),
);

export const ArrowheadArrowIcon = React.memo(
  ({
    appearance,
    flip = false,
  }: {
    appearance: "light" | "dark";
    flip?: boolean;
  }) =>
    createIcon(
      <g
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        stroke={iconFillColor(appearance)}
        strokeWidth={2}
        fill="none"
      >
        <path d="M34 10H6M34 10L27 5M34 10L27 15" />
        <path d="M27.5 5L34.5 10L27.5 15" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const ArrowheadDotIcon = React.memo(
  ({
    appearance,
    flip = false,
  }: {
    appearance: "light" | "dark";
    flip?: boolean;
  }) =>
    createIcon(
      <g
        stroke={iconFillColor(appearance)}
        fill={iconFillColor(appearance)}
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
      >
        <path d="M32 10L6 10" strokeWidth={2} />
        <circle r="4" transform="matrix(-1 0 0 1 30 10)" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const ArrowheadBarIcon = React.memo(
  ({
    appearance,
    flip = false,
  }: {
    appearance: "light" | "dark";
    flip?: boolean;
  }) =>
    createIcon(
      <g transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}>
        <path
          d="M34 10H5.99996M34 10L34 5M34 10L34 15"
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          fill="none"
        />
      </g>,
      { width: 40, height: 20 },
    ),
);
