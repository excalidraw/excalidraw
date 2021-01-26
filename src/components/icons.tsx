//
// All icons are imported from https://fontawesome.com/icons?d=gallery
// Icons are under the license https://fontawesome.com/license
//

// Note: when adding new icons, review https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/RTL_Guidelines
// to determine whether or not the icons should be mirrored in right-to-left languages.

import React from "react";

import oc from "open-color";
import clsx from "clsx";

const activeElementColor = (theme: "light" | "dark") =>
  theme === "light" ? oc.orange[4] : oc.orange[9];
const iconFillColor = (theme: "light" | "dark") =>
  theme === "light" ? oc.black : oc.gray[4];
const handlerColor = (theme: "light" | "dark") =>
  theme === "light" ? oc.white : "#1e1e1e";

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
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M22 9.556C22 8.696 21.303 8 20.444 8H16v8H8v4.444C8 21.304 8.697 22 9.556 22h10.888c.86 0 1.556-.697 1.556-1.556V9.556z"
          fill={iconFillColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="2"
        />
        <path
          d="M16 3.556C16 2.696 15.303 2 14.444 2H3.556C2.696 2 2 2.697 2 3.556v10.888C2 15.304 2.697 16 3.556 16h10.888c.86 0 1.556-.697 1.556-1.556V3.556z"
          fill={activeElementColor(theme)}
          stroke={activeElementColor(theme)}
          strokeWidth="2"
        />
      </>,
      { width: 24, mirror: true },
    ),
);

export const SendBackwardIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M16 3.556C16 2.696 15.303 2 14.444 2H3.556C2.696 2 2 2.697 2 3.556v10.888C2 15.304 2.697 16 3.556 16h10.888c.86 0 1.556-.697 1.556-1.556V3.556z"
          fill={activeElementColor(theme)}
          stroke={activeElementColor(theme)}
          strokeWidth="2"
        />
        <path
          d="M22 9.556C22 8.696 21.303 8 20.444 8H9.556C8.696 8 8 8.697 8 9.556v10.888C8 21.304 8.697 22 9.556 22h10.888c.86 0 1.556-.697 1.556-1.556V9.556z"
          fill={iconFillColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="2"
        />
      </>,
      { width: 24, mirror: true },
    ),
);

export const BringToFrontIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M13 21a1 1 0 001 1h7a1 1 0 001-1v-7a1 1 0 00-1-1h-3v5h-5v3zM11 3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h3V6h5V3z"
          fill={iconFillColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="2"
        />
        <path
          d="M18 7.333C18 6.597 17.403 6 16.667 6H7.333C6.597 6 6 6.597 6 7.333v9.334C6 17.403 6.597 18 7.333 18h9.334c.736 0 1.333-.597 1.333-1.333V7.333z"
          fill={activeElementColor(theme)}
          stroke={activeElementColor(theme)}
          strokeWidth="2"
        />
      </>,
      { width: 24, mirror: true },
    ),
);

export const SendToBackIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M18 7.333C18 6.597 17.403 6 16.667 6H7.333C6.597 6 6 6.597 6 7.333v9.334C6 17.403 6.597 18 7.333 18h9.334c.736 0 1.333-.597 1.333-1.333V7.333z"
          fill={activeElementColor(theme)}
          stroke={activeElementColor(theme)}
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M11 3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h8V3zM22 14a1 1 0 00-1-1h-7a1 1 0 00-1 1v7a1 1 0 001 1h8v-8z"
          fill={iconFillColor(theme)}
          stroke={iconFillColor(theme)}
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
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M 2,5 H 22"
          fill={iconFillColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M 6,7 C 5.446,7 5,7.446 5,8 v 9.999992 c 0,0.554 0.446,1 1,1 h 3.0000001 c 0.554,0 0.9999999,-0.446 0.9999999,-1 V 8 C 10,7.446 9.5540001,7 9.0000001,7 Z m 9,0 c -0.554,0 -1,0.446 -1,1 v 5.999992 c 0,0.554 0.446,1 1,1 h 3 c 0.554,0 1,-0.446 1,-1 V 8 C 19,7.446 18.554,7 18,7 Z"
          fill={activeElementColor(theme)}
          stroke={activeElementColor(theme)}
          strokeWidth="2"
        />
      </>,
      { width: 24, mirror: true },
    ),
);

export const AlignBottomIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M 2,19 H 22"
          fill={iconFillColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="m 6,16.999992 c -0.554,0 -1,-0.446 -1,-1 V 6 C 5,5.446 5.446,5 6,5 H 9.0000001 C 9.5540001,5 10,5.446 10,6 v 9.999992 c 0,0.554 -0.4459999,1 -0.9999999,1 z m 9,0 c -0.554,0 -1,-0.446 -1,-1 V 10 c 0,-0.554 0.446,-1 1,-1 h 3 c 0.554,0 1,0.446 1,1 v 5.999992 c 0,0.554 -0.446,1 -1,1 z"
          fill={activeElementColor(theme)}
          stroke={activeElementColor(theme)}
          strokeWidth="2"
        />
      </>,
      { width: 24, mirror: true },
    ),
);

export const AlignLeftIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M 5,2 V 22"
          fill={iconFillColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="m 7.000004,5.999996 c 0,-0.554 0.446,-1 1,-1 h 9.999992 c 0.554,0 1,0.446 1,1 v 3.0000001 c 0,0.554 -0.446,0.9999999 -1,0.9999999 H 8.000004 c -0.554,0 -1,-0.4459999 -1,-0.9999999 z m 0,9 c 0,-0.554 0.446,-1 1,-1 h 5.999992 c 0.554,0 1,0.446 1,1 v 3 c 0,0.554 -0.446,1 -1,1 H 8.000004 c -0.554,0 -1,-0.446 -1,-1 z"
          fill={activeElementColor(theme)}
          stroke={activeElementColor(theme)}
          strokeWidth="2"
        />
      </>,
      { width: 24 },
    ),
);

export const AlignRightIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M 19,2 V 22"
          fill={iconFillColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="m 16.999996,5.999996 c 0,-0.554 -0.446,-1 -1,-1 H 6.000004 c -0.554,0 -1,0.446 -1,1 v 3.0000001 c 0,0.554 0.446,0.9999999 1,0.9999999 h 9.999992 c 0.554,0 1,-0.4459999 1,-0.9999999 z m 0,9 c 0,-0.554 -0.446,-1 -1,-1 h -5.999992 c -0.554,0 -1,0.446 -1,1 v 3 c 0,0.554 0.446,1 1,1 h 5.999992 c 0.554,0 1,-0.446 1,-1 z"
          fill={activeElementColor(theme)}
          stroke={activeElementColor(theme)}
          strokeWidth="2"
        />
      </>,
      { width: 24 },
    ),
);

export const DistributeHorizontallyIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path d="M5 5V19Z" fill="black" />
        <path
          d="M19 5V19M5 5V19"
          stroke={iconFillColor(theme)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M15 9C15.554 9 16 9.446 16 10V14C16 14.554 15.554 15 15 15H9C8.446 15 8 14.554 8 14V10C8 9.446 8.446 9 9 9H15Z"
          fill={activeElementColor(theme)}
          stroke={activeElementColor(theme)}
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
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M5 5L19 5M5 19H19"
          fill={iconFillColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M15 9C15.554 9 16 9.446 16 10V14C16 14.554 15.554 15 15 15H9C8.446 15 8 14.554 8 14V10C8 9.446 8.446 9 9 9H15Z"
          fill={activeElementColor(theme)}
          stroke={activeElementColor(theme)}
          strokeWidth="2"
        />
      </>,
      { width: 24 },
    ),
);

export const CenterVerticallyIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="m 5.000004,16.999996 c 0,0.554 0.446,1 1,1 h 3 c 0.554,0 1,-0.446 1,-1 v -10 c 0,-0.554 -0.446,-1 -1,-1 h -3 c -0.554,0 -1,0.446 -1,1 z m 9,-2 c 0,0.554 0.446,1 1,1 h 3 c 0.554,0 1,-0.446 1,-1 v -6 c 0,-0.554 -0.446,-1 -1,-1 h -3 c -0.554,0 -1,0.446 -1,1 z"
          fill={activeElementColor(theme)}
          stroke={activeElementColor(theme)}
          strokeWidth="2"
        />
        <path
          d="M 2,12 H 22"
          fill={iconFillColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="2"
          strokeDasharray="1, 2.8"
          strokeLinecap="round"
        />
      </>,
      { width: 24, mirror: true },
    ),
);

export const CenterHorizontallyIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M 7 5 C 6.446 5 6 5.446 6 6 L 6 9 C 6 9.554 6.446 10 7 10 L 17 10 C 17.554 10 18 9.554 18 9 L 18 6 C 18 5.446 17.554 5 17 5 L 7 5 z M 9 14 C 8.446 14 8 14.446 8 15 L 8 18 C 8 18.554 8.446 19 9 19 L 15 19 C 15.554 19 16 18.554 16 18 L 16 15 C 16 14.446 15.554 14 15 14 L 9 14 z "
          fill={activeElementColor(theme)}
          stroke={activeElementColor(theme)}
          strokeWidth="2"
        />
        <path
          d="M 12,2 V 22"
          fill={iconFillColor(theme)}
          stroke={iconFillColor(theme)}
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

export const GroupIcon = React.memo(({ theme }: { theme: "light" | "dark" }) =>
  createIcon(
    <>
      <path d="M25 26H111V111H25" fill={iconFillColor(theme)} />
      <path
        d="M25 111C25 80.2068 25 49.4135 25 26M25 26C48.6174 26 72.2348 26 111 26H25ZM25 26C53.3671 26 81.7343 26 111 26H25ZM111 26C111 52.303 111 78.606 111 111V26ZM111 26C111 51.2947 111 76.5893 111 111V26ZM111 111C87.0792 111 63.1585 111 25 111H111ZM111 111C87.4646 111 63.9293 111 25 111H111ZM25 111C25 81.1514 25 51.3028 25 26V111Z"
        stroke={iconFillColor(theme)}
        strokeWidth="2"
      />
      <path d="M100 100H160V160H100" fill={iconFillColor(theme)} />
      <path
        d="M100 160C100 144.106 100 128.211 100 100M100 100C117.706 100 135.412 100 160 100H100ZM100 100C114.214 100 128.428 100 160 100H100ZM160 100C160 120.184 160 140.369 160 160V100ZM160 100C160 113.219 160 126.437 160 160V100ZM160 160C145.534 160 131.068 160 100 160H160ZM160 160C143.467 160 126.934 160 100 160H160ZM100 160C100 143.661 100 127.321 100 100V160Z"
        stroke={iconFillColor(theme)}
        strokeWidth="2"
      />
      <rect
        x="2.5"
        y="2.5"
        width="30"
        height="30"
        fill={handlerColor(theme)}
        stroke={iconFillColor(theme)}
        strokeWidth="6"
      />
      <rect
        x="2.5"
        y="149.5"
        width="30"
        height="30"
        fill={handlerColor(theme)}
        stroke={iconFillColor(theme)}
        strokeWidth="6"
      />
      <rect
        x="147.5"
        y="149.5"
        width="30"
        height="30"
        fill={handlerColor(theme)}
        stroke={iconFillColor(theme)}
        strokeWidth="6"
      />
      <rect
        x="147.5"
        y="2.5"
        width="30"
        height="30"
        fill={handlerColor(theme)}
        stroke={iconFillColor(theme)}
        strokeWidth="6"
      />
    </>,
    { width: 182, height: 182, mirror: true },
  ),
);

export const UngroupIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <>
        <path d="M25 26H111V111H25" fill={iconFillColor(theme)} />
        <path
          d="M25 111C25 80.2068 25 49.4135 25 26M25 26C48.6174 26 72.2348 26 111 26H25ZM25 26C53.3671 26 81.7343 26 111 26H25ZM111 26C111 52.303 111 78.606 111 111V26ZM111 26C111 51.2947 111 76.5893 111 111V26ZM111 111C87.0792 111 63.1585 111 25 111H111ZM111 111C87.4646 111 63.9293 111 25 111H111ZM25 111C25 81.1514 25 51.3028 25 26V111Z"
          stroke={iconFillColor(theme)}
          strokeWidth="2"
        />
        <path d="M100 100H160V160H100" fill={iconFillColor(theme)} />
        <path
          d="M100 160C100 144.106 100 128.211 100 100M100 100C117.706 100 135.412 100 160 100H100ZM100 100C114.214 100 128.428 100 160 100H100ZM160 100C160 120.184 160 140.369 160 160V100ZM160 100C160 113.219 160 126.437 160 160V100ZM160 160C145.534 160 131.068 160 100 160H160ZM160 160C143.467 160 126.934 160 100 160H160ZM100 160C100 143.661 100 127.321 100 100V160Z"
          stroke={iconFillColor(theme)}
          strokeWidth="2"
        />
        <rect
          x="2.5"
          y="2.5"
          width="30"
          height="30"
          fill={handlerColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="6"
        />
        <rect
          x="78.5"
          y="149.5"
          width="30"
          height="30"
          fill={handlerColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="6"
        />
        <rect
          x="147.5"
          y="149.5"
          width="30"
          height="30"
          fill={handlerColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="6"
        />
        <rect
          x="147.5"
          y="78.5"
          width="30"
          height="30"
          fill={handlerColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="6"
        />
        <rect
          x="105.5"
          y="2.5"
          width="30"
          height="30"
          fill={handlerColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="6"
        />
        <rect
          x="2.5"
          y="102.5"
          width="30"
          height="30"
          fill={handlerColor(theme)}
          stroke={iconFillColor(theme)}
          strokeWidth="6"
        />
      </>,
      { width: 182, height: 182, mirror: true },
    ),
);

export const FillHachureIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.101 16H28.0934L36 8.95989V4H33.5779L20.101 16ZM30.5704 4L17.0935 16H9.10101L22.5779 4H30.5704ZM19.5704 4L6.09349 16H4V10.7475L11.5779 4H19.5704ZM8.57036 4H4V8.06952L8.57036 4ZM36 11.6378L31.101 16H36V11.6378ZM2 2V18H38V2H2Z"
        fill={iconFillColor(theme)}
      />,
      { width: 40, height: 20 },
    ),
);

export const FillCrossHatchIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <g fill={iconFillColor(theme)} fillRule="evenodd" clipRule="evenodd">
        <path d="M20.101 16H28.0934L36 8.95989V4H33.5779L20.101 16ZM30.5704 4L17.0935 16H9.10101L22.5779 4H30.5704ZM19.5704 4L6.09349 16H4V10.7475L11.5779 4H19.5704ZM8.57036 4H4V8.06952L8.57036 4ZM36 11.6378L31.101 16H36V11.6378ZM2 2V18H38V2H2Z" />
        <path d="M14.0001 18L3.00006 4.00002L4.5727 2.76438L15.5727 16.7644L14.0001 18ZM25.0001 18L14.0001 4.00002L15.5727 2.76438L26.5727 16.7644L25.0001 18ZM36.0001 18L25.0001 4.00002L26.5727 2.76438L37.5727 16.7644L36.0001 18Z" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const FillSolidIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(<path d="M2 2H38V18H2V2Z" fill={iconFillColor(theme)} />, {
      width: 40,
      height: 20,
    }),
);

export const StrokeWidthIcon = React.memo(
  ({ theme, strokeWidth }: { theme: "light" | "dark"; strokeWidth: number }) =>
    createIcon(
      <path
        d="M6 10H34"
        stroke={iconFillColor(theme)}
        strokeWidth={strokeWidth}
        fill="none"
      />,
      { width: 40, height: 20 },
    ),
);

export const StrokeStyleSolidIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <path
        d="M6 10H34"
        stroke={iconFillColor(theme)}
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
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <path
        d="M6 10H34"
        stroke={iconFillColor(theme)}
        strokeWidth={2.5}
        strokeDasharray={"10, 8"}
        fill="none"
      />,
      { width: 40, height: 20 },
    ),
);

export const StrokeStyleDottedIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <path
        d="M6 10H34"
        stroke={iconFillColor(theme)}
        strokeWidth={2.5}
        strokeDasharray={"4, 4"}
        fill="none"
      />,
      { width: 40, height: 20 },
    ),
);

export const SloppinessArchitectIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <path
        d="M3.00098 16.1691C6.28774 13.9744 19.6399 2.8905 22.7215 3.00082C25.8041 3.11113 19.1158 15.5488 21.4962 16.8309C23.8757 18.1131 34.4155 11.7148 37.0001 10.6919"
        stroke={iconFillColor(theme)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20, mirror: true },
    ),
);

export const SloppinessArtistIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <path
        d="M3 17C6.68158 14.8752 16.1296 9.09849 22.0648 6.54922C28 3.99995 22.2896 13.3209 25 14C27.7104 14.6791 36.3757 9.6471 36.3757 9.6471M6.40706 15C13 11.1918 20.0468 1.51045 23.0234 3.0052C26 4.49995 20.457 12.8659 22.7285 16.4329C25 20 36.3757 13 36.3757 13"
        stroke={iconFillColor(theme)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20, mirror: true },
    ),
);

export const SloppinessCartoonistIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <path
        d="M3 15.6468C6.93692 13.5378 22.5544 2.81528 26.6206 3.00242C30.6877 3.18956 25.6708 15.3346 27.4009 16.7705C29.1309 18.2055 35.4001 12.4762 37 11.6177M3.97143 10.4917C6.61158 9.24563 16.3706 2.61886 19.8104 3.01724C23.2522 3.41472 22.0773 12.2013 24.6181 12.8783C27.1598 13.5536 33.3179 8.04068 35.0571 7.07244"
        stroke={iconFillColor(theme)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20, mirror: true },
    ),
);

export const EdgeSharpIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <path
        d="M10 17L10 5L35 5"
        stroke={iconFillColor(theme)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20, mirror: true },
    ),
);

export const EdgeRoundIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <path
        d="M10 17V15C10 8 13 5 21 5L33.5 5"
        stroke={iconFillColor(theme)}
        strokeWidth={2}
        fill="none"
      />,
      { width: 40, height: 20, mirror: true },
    ),
);

export const ArrowheadNoneIcon = React.memo(
  ({ theme }: { theme: "light" | "dark" }) =>
    createIcon(
      <path
        d="M6 10H34"
        stroke={iconFillColor(theme)}
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
  ({ theme, flip = false }: { theme: "light" | "dark"; flip?: boolean }) =>
    createIcon(
      <g
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        stroke={iconFillColor(theme)}
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
  ({ theme, flip = false }: { theme: "light" | "dark"; flip?: boolean }) =>
    createIcon(
      <g
        stroke={iconFillColor(theme)}
        fill={iconFillColor(theme)}
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
      >
        <path d="M32 10L6 10" strokeWidth={2} />
        <circle r="4" transform="matrix(-1 0 0 1 30 10)" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const ArrowheadBarIcon = React.memo(
  ({ theme, flip = false }: { theme: "light" | "dark"; flip?: boolean }) =>
    createIcon(
      <g transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}>
        <path
          d="M34 10H5.99996M34 10L34 5M34 10L34 15"
          stroke={iconFillColor(theme)}
          strokeWidth={2}
          fill="none"
        />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const FontSizeSmallIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        fill={iconFillColor(appearance)}
        d="M 30.739 42.4 L 20.039 40.2 A 43.337 43.337 0 0 1 14.575 38.696 Q 9.086 36.763 5.889 33.6 A 15.331 15.331 0 0 1 1.607 25.335 A 22.189 22.189 0 0 1 1.239 21.2 A 20.057 20.057 0 0 1 2.359 14.417 A 18.181 18.181 0 0 1 4.589 10.1 A 20.96 20.96 0 0 1 11.441 3.913 A 26.302 26.302 0 0 1 13.939 2.65 A 30.586 30.586 0 0 1 21.92 0.405 A 40.309 40.309 0 0 1 27.739 0 A 42.74 42.74 0 0 1 36.264 0.827 A 37.81 37.81 0 0 1 39.389 1.6 Q 44.839 3.2 49.139 6.5 A 5.758 5.758 0 0 1 50.199 7.449 A 4.036 4.036 0 0 1 51.139 9.4 Q 51.221 9.864 51.221 10.309 A 4.57 4.57 0 0 1 50.639 12.55 Q 49.839 14 48.239 14.5 A 3.091 3.091 0 0 1 47.312 14.639 Q 46.325 14.639 45.178 14.06 A 8.459 8.459 0 0 1 44.539 13.7 A 29.414 29.414 0 0 0 39.098 10.817 A 25.689 25.689 0 0 0 36.539 9.95 A 31.047 31.047 0 0 0 30.571 8.913 A 37.485 37.485 0 0 0 27.639 8.8 Q 20.239 8.8 15.889 12.1 A 10.944 10.944 0 0 0 12.713 15.779 Q 11.539 18.043 11.539 20.9 A 10.556 10.556 0 0 0 11.943 23.894 A 8.069 8.069 0 0 0 14.239 27.6 A 10.713 10.713 0 0 0 16.49 29.161 Q 19.08 30.542 23.239 31.4 L 33.839 33.6 A 52.003 52.003 0 0 1 39.591 35.133 Q 45.37 37.06 48.739 40.05 A 14.312 14.312 0 0 1 53.494 49.347 A 20.177 20.177 0 0 1 53.639 51.8 A 19.598 19.598 0 0 1 52.711 57.926 A 17.082 17.082 0 0 1 50.339 62.6 A 20.085 20.085 0 0 1 44.282 68.105 A 25.974 25.974 0 0 1 41.039 69.75 Q 35.426 72.136 27.8 72.29 A 52.605 52.605 0 0 1 26.739 72.3 Q 19.839 72.3 13.489 70.7 Q 7.139 69.1 2.439 65.9 A 6.609 6.609 0 0 1 1.246 64.871 A 4.59 4.59 0 0 1 0.139 62.75 Q 0 62.107 0 61.5 A 4.872 4.872 0 0 1 0.489 59.35 Q 1.239 57.8 2.789 57.2 A 2.812 2.812 0 0 1 3.813 57.011 Q 4.971 57.011 6.339 57.9 Q 10.839 60.8 15.839 62.15 A 39.001 39.001 0 0 0 22.789 63.341 A 47.749 47.749 0 0 0 26.739 63.5 A 37.81 37.81 0 0 0 31.168 63.259 Q 36.378 62.642 39.289 60.45 A 10.534 10.534 0 0 0 41.967 57.577 A 9.476 9.476 0 0 0 43.339 52.5 A 8.873 8.873 0 0 0 42.861 49.523 A 7.512 7.512 0 0 0 40.439 46.15 Q 37.539 43.8 30.739 42.4 Z"
      />,
      { width: 54, height: 72 },
    ),
);

export const FontSizeMediumIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        fill={iconFillColor(appearance)}
        d="M 0.001 67.001 L 0.001 4.901 A 7.233 7.233 0 0 1 0.23 2.991 Q 0.83 0.807 2.992 0.218 A 6.894 6.894 0 0 1 4.801 0.001 Q 6.179 0.001 7.148 0.345 A 3.803 3.803 0 0 1 8.051 0.801 Q 8.921 1.407 9.706 2.586 A 11.915 11.915 0 0 1 10.201 3.401 L 34.801 49.401 L 59.401 3.401 A 11.218 11.218 0 0 1 60.106 2.281 Q 60.796 1.326 61.551 0.801 A 4.054 4.054 0 0 1 62.755 0.243 Q 63.599 0.001 64.701 0.001 Q 68.356 0.001 69.107 3.094 A 7.679 7.679 0 0 1 69.301 4.901 L 69.301 67.001 Q 69.301 71.901 64.701 71.901 Q 60.001 71.901 60.001 67.001 L 60.001 19.601 L 39.001 58.301 A 10.154 10.154 0 0 1 38.44 59.235 Q 37.892 60.041 37.301 60.501 Q 36.565 61.073 35.362 61.177 A 6.49 6.49 0 0 1 34.801 61.201 A 6.211 6.211 0 0 1 33.766 61.12 Q 33.216 61.027 32.774 60.827 A 2.989 2.989 0 0 1 32.151 60.451 A 5.804 5.804 0 0 1 31.307 59.621 Q 30.951 59.197 30.619 58.666 A 10.801 10.801 0 0 1 30.401 58.301 L 9.401 19.701 L 9.401 67.001 Q 9.401 71.901 4.801 71.901 A 6.759 6.759 0 0 1 2.887 71.654 Q 0.767 71.027 0.204 68.811 A 7.368 7.368 0 0 1 0.001 67.001 Z"
      />,
      { width: 69, height: 71 },
    ),
);

export const FontSizeLargeIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        fill={iconFillColor(appearance)}
        d="M 41.401 70.901 L 5.301 70.901 Q 1.095 70.901 0.227 67.564 A 7.808 7.808 0 0 1 0.001 65.601 L 0.001 5.301 A 7.812 7.812 0 0 1 0.25 3.236 Q 1.138 0.001 5.201 0.001 A 7.333 7.333 0 0 1 7.274 0.268 Q 10.401 1.191 10.401 5.301 L 10.401 62.001 L 41.401 62.001 A 6.945 6.945 0 0 1 43.193 62.211 Q 45.493 62.827 45.909 65.246 A 6.826 6.826 0 0 1 46.001 66.401 A 6.319 6.319 0 0 1 45.767 68.202 Q 45.173 70.194 43.076 70.716 A 6.959 6.959 0 0 1 41.401 70.901 Z"
      />,
      { width: 46, height: 71 },
    ),
);

export const FontSizeExtraLargeIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        fill={iconFillColor(appearance)}
        d="M 1.128 64.8 L 23.228 35.2 L 2.428 7.3 A 7.783 7.783 0 0 1 1.723 6.235 Q 0.631 4.218 1.553 2.438 A 4.326 4.326 0 0 1 1.628 2.3 Q 2.928 0 5.928 0 Q 8.928 0 11.328 3.3 L 29.128 27.6 L 46.728 3.3 Q 48.403 0.997 50.419 0.302 A 5.506 5.506 0 0 1 52.228 0 A 6.233 6.233 0 0 1 53.932 0.219 A 4.232 4.232 0 0 1 56.528 2.25 Q 57.828 4.5 55.728 7.3 L 34.928 35.2 L 56.928 64.8 Q 58.757 67.304 57.667 69.482 A 4.416 4.416 0 0 1 57.578 69.65 Q 56.328 71.9 53.228 71.9 A 5.615 5.615 0 0 1 50.011 70.856 Q 48.822 70.044 47.728 68.6 L 29.028 43 L 10.428 68.6 Q 8.711 70.867 6.711 71.577 A 5.589 5.589 0 0 1 4.828 71.9 A 6.233 6.233 0 0 1 3.124 71.682 A 4.232 4.232 0 0 1 0.528 69.65 Q -0.662 67.59 0.831 65.235 A 8.016 8.016 0 0 1 1.128 64.8 Z M 111.628 71.2 L 75.528 71.2 Q 71.322 71.2 70.454 67.863 A 7.808 7.808 0 0 1 70.228 65.9 L 70.228 5.6 A 7.812 7.812 0 0 1 70.477 3.535 Q 71.366 0.3 75.428 0.3 A 7.333 7.333 0 0 1 77.502 0.568 Q 80.628 1.491 80.628 5.6 L 80.628 62.3 L 111.628 62.3 A 6.945 6.945 0 0 1 113.421 62.511 Q 115.721 63.127 116.136 65.546 A 6.826 6.826 0 0 1 116.228 66.7 A 6.319 6.319 0 0 1 115.994 68.502 Q 115.401 70.494 113.304 71.016 A 6.959 6.959 0 0 1 111.628 71.2 Z"
      />,
      { width: 116, height: 72 },
    ),
);

export const FontFamilyHandDrawnIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        fill={iconFillColor(appearance)}
        d="M19.4 7.34L16.66 4.6A2 2 0 0 0 14 4.53l-9 9a2 2 0 0 0-.57 1.21L4 18.91a1 1 0 0 0 .29.8A1 1 0 0 0 5 20h.09l4.17-.38a2 2 0 0 0 1.21-.57l9-9a1.92 1.92 0 0 0-.07-2.71zM9.08 17.62l-3 .28.27-3L12 9.32l2.7 2.7zM16 10.68L13.32 8l1.95-2L18 8.73z"
      />,
      { width: 24, height: 24 },
    ),
);

export const FontFamilyNormalIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <path
        fill={iconFillColor(appearance)}
        d="M 48.926 48.682 L 17.578 48.682 L 9.668 68.799 L 0 68.799 L 28.076 0 L 38.672 0 L 66.309 68.799 L 56.787 68.799 L 48.926 48.682 Z M 29.15 18.994 L 20.41 41.406 L 46.143 41.406 L 37.305 18.701 A 76.439 76.439 0 0 1 36.935 17.758 Q 36.526 16.694 36 15.254 A 287.122 287.122 0 0 1 35.498 13.867 Q 34.375 10.742 33.252 7.031 A 153.427 153.427 0 0 1 32.343 9.918 A 211.052 211.052 0 0 1 31.274 13.11 A 214.341 214.341 0 0 1 30.303 15.883 Q 29.851 17.145 29.428 18.264 A 121.447 121.447 0 0 1 29.15 18.994 Z"
      />,
      { width: 66, height: 69 },
    ),
);

export const FontFamilyCodeIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          fill={iconFillColor(appearance)}
          d="M506.76,242.828l-118.4-125.44c-7.277-7.718-19.424-8.07-27.142-0.787c-7.706,7.277-8.064,19.43-0.781,27.142
          l105.965,112.256L360.437,368.268c-7.283,7.712-6.925,19.859,0.781,27.142c3.712,3.501,8.454,5.235,13.178,5.235
          c5.101,0,10.195-2.022,13.965-6.01l118.4-125.446C513.742,261.785,513.742,250.226,506.76,242.828z"
        />

        <path
          fill={iconFillColor(appearance)}
          d="M151.566,368.262L45.608,255.999l105.958-112.262c7.277-7.712,6.925-19.866-0.787-27.142
          c-7.706-7.277-19.866-6.925-27.142,0.787l-118.4,125.44c-6.982,7.398-6.982,18.963,0,26.362L123.643,394.63
          c3.776,4,8.864,6.016,13.965,6.016c4.723,0,9.466-1.741,13.171-5.242C158.498,388.127,158.843,375.974,151.566,368.262z"
        />

        <path
          fill={iconFillColor(appearance)}
          d="M287.061,52.697c-10.477-1.587-20.282,5.606-21.882,16.083l-56.32,368.64c-1.6,10.483,5.6,20.282,16.083,21.882
          c0.986,0.147,1.958,0.218,2.925,0.218c9.325,0,17.504-6.803,18.957-16.301l56.32-368.64
          C304.744,64.095,297.544,54.297,287.061,52.697z"
        />
      </>,
      { width: 512, height: 512 },
    ),
);
