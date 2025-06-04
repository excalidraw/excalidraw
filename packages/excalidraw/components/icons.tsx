//
// All icons are imported from https://fontawesome.com/icons?d=gallery
// Icons are under the license https://fontawesome.com/license
//

// Note: when adding new icons, review https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/RTL_Guidelines
// to determine whether or not the icons should be mirrored in right-to-left languages.

import clsx from "clsx";
import oc from "open-color";
import React from "react";

import { THEME } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

export const iconFillColor = (theme: Theme) => "var(--icon-fill-color)";

const handlerColor = (theme: Theme) =>
  theme === THEME.LIGHT ? oc.white : "#1e1e1e";

type Opts = {
  width?: number;
  height?: number;
  mirror?: true;
} & React.SVGProps<SVGSVGElement>;

export const createIcon = (
  d: string | React.ReactNode,
  opts: number | Opts = 512,
) => {
  const {
    width = 512,
    height = width,
    mirror,
    style,
    ...rest
  } = typeof opts === "number" ? ({ width: opts } as Opts) : opts;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      className={clsx({ "rtl-mirror": mirror })}
      style={style}
      {...rest}
    >
      {typeof d === "string" ? <path fill="currentColor" d={d} /> : d}
    </svg>
  );
};

const tablerIconProps: Opts = {
  width: 24,
  height: 24,
  fill: "none",
  strokeWidth: 2,
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const modifiedTablerIconProps: Opts = {
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

// -----------------------------------------------------------------------------

// tabler-icons: present
export const PlusPromoIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <rect x={3} y={8} width={18} height={4} rx={1} />
    <line x1={12} y1={8} x2={12} y2={21} />
    <path d="M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5" />
  </g>,
  tablerIconProps,
);

// tabler-icons: book
export const LibraryIcon = createIcon(
  <g strokeWidth="1.25">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
    <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
    <line x1="3" y1="6" x2="3" y2="19" />
    <line x1="12" y1="6" x2="12" y2="19" />
    <line x1="21" y1="6" x2="21" y2="19" />
  </g>,
  tablerIconProps,
);

// tabler-icons: plus
export const PlusIcon = createIcon(
  <svg strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>,
  tablerIconProps,
);

// tabler-icons: dots-vertical
export const DotsIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <circle cx="12" cy="12" r="1"></circle>
    <circle cx="12" cy="19" r="1"></circle>
    <circle cx="12" cy="5" r="1"></circle>
  </g>,
  tablerIconProps,
);

// tabler-icons: pinned
export const PinIcon = createIcon(
  <svg strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M9 4v6l-2 4v2h10v-2l-2 -4v-6"></path>
    <line x1="12" y1="16" x2="12" y2="21"></line>
    <line x1="8" y1="4" x2="16" y2="4"></line>
  </svg>,
  tablerIconProps,
);

// tabler-icons: lock-open (via Figma)
export const UnlockedIcon = createIcon(
  <g>
    <path
      d="M13.542 8.542H6.458a2.5 2.5 0 0 0-2.5 2.5v3.75a2.5 2.5 0 0 0 2.5 2.5h7.084a2.5 2.5 0 0 0 2.5-2.5v-3.75a2.5 2.5 0 0 0-2.5-2.5Z"
      stroke="currentColor"
      strokeWidth="1.25"
    />
    <path
      d="M10 13.958a1.042 1.042 0 1 0 0-2.083 1.042 1.042 0 0 0 0 2.083Z"
      stroke="currentColor"
      strokeWidth="1.25"
    />
    <mask
      id="UnlockedIcon"
      style={{ maskType: "alpha" }}
      maskUnits="userSpaceOnUse"
      x={6}
      y={1}
      width={9}
      height={9}
    >
      <path
        stroke="none"
        d="M6.399 9.561V5.175c0-.93.401-1.823 1.116-2.48a3.981 3.981 0 0 1 2.693-1.028c1.01 0 1.98.37 2.694 1.027.715.658 1.116 1.55 1.116 2.481"
        fill="#fff"
      />
    </mask>
    <g mask="url(#UnlockedIcon)">
      <path
        stroke="none"
        d="M5.149 9.561v1.25h2.5v-1.25h-2.5Zm5.06-7.894V.417v1.25Zm2.559 3.508v1.25h2.5v-1.25h-2.5ZM7.648 8.51V5.175h-2.5V8.51h2.5Zm0-3.334c0-.564.243-1.128.713-1.561L6.668 1.775c-.959.883-1.52 2.104-1.52 3.4h2.5Zm.713-1.561a2.732 2.732 0 0 1 1.847-.697v-2.5c-1.31 0-2.585.478-3.54 1.358L8.36 3.614Zm1.847-.697c.71 0 1.374.26 1.847.697l1.694-1.839a5.231 5.231 0 0 0-3.54-1.358v2.5Zm1.847.697c.47.433.713.997.713 1.561h2.5c0-1.296-.56-2.517-1.52-3.4l-1.693 1.839Z"
        fill="currentColor"
      />
    </g>
  </g>,
  modifiedTablerIconProps,
);

// tabler-icons: lock (via Figma)
export const LockedIcon = createIcon(
  <g strokeWidth="1.25">
    <path d="M13.542 8.542H6.458a2.5 2.5 0 0 0-2.5 2.5v3.75a2.5 2.5 0 0 0 2.5 2.5h7.084a2.5 2.5 0 0 0 2.5-2.5v-3.75a2.5 2.5 0 0 0-2.5-2.5Z" />
    <path d="M10 13.958a1.042 1.042 0 1 0 0-2.083 1.042 1.042 0 0 0 0 2.083Z" />
    <path d="M6.667 8.333V5.417C6.667 3.806 8.159 2.5 10 2.5c1.841 0 3.333 1.306 3.333 2.917v2.916" />
  </g>,
  modifiedTablerIconProps,
);

// custom
export const WelcomeScreenMenuArrow = createIcon(
  <>
    <path
      d="M38.5 83.5c-14-2-17.833-10.473-21-22.5C14.333 48.984 12 22 12 12.5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="m12.005 10.478 7.905 14.423L6 25.75l6.005-15.273Z"
      fill="currentColor"
    />
    <path
      d="M12.005 10.478c1.92 3.495 3.838 7 7.905 14.423m-7.905-14.423c3.11 5.683 6.23 11.368 7.905 14.423m0 0c-3.68.226-7.35.455-13.91.85m13.91-.85c-5.279.33-10.566.647-13.91.85m0 0c1.936-4.931 3.882-9.86 6.005-15.273M6 25.75c2.069-5.257 4.135-10.505 6.005-15.272"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </>,
  { width: 41, height: 94, fill: "none" },
);

// custom
export const WelcomeScreenHelpArrow = createIcon(
  <>
    <path
      d="M18.026 1.232c-5.268 13.125-5.548 33.555 3.285 42.311 8.823 8.75 33.31 12.304 42.422 13.523"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="m72.181 59.247-13.058-10-2.948 13.62 16.006-3.62Z"
      fill="currentColor"
    />
    <path
      d="M72.181 59.247c-3.163-2.429-6.337-4.856-13.058-10m13.058 10c-5.145-3.936-10.292-7.882-13.058-10m0 0c-.78 3.603-1.563 7.196-2.948 13.62m2.948-13.62c-1.126 5.168-2.24 10.346-2.948 13.62m0 0c5.168-1.166 10.334-2.343 16.006-3.62m-16.006 3.62c5.51-1.248 11.01-2.495 16.006-3.62"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </>,
  { width: 85, height: 71, fill: "none" },
);

// custom
export const WelcomeScreenTopToolbarArrow = createIcon(
  <>
    <path
      d="M1 77c14-2 31.833-11.973 35-24 3.167-12.016-6-35-9.5-43.5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="m24.165 1.093-2.132 16.309 13.27-4.258-11.138-12.05Z"
      fill="currentColor"
    />
    <path
      d="M24.165 1.093c-.522 3.953-1.037 7.916-2.132 16.309m2.131-16.309c-.835 6.424-1.68 12.854-2.13 16.308m0 0c3.51-1.125 7.013-2.243 13.27-4.257m-13.27 4.257c5.038-1.608 10.08-3.232 13.27-4.257m0 0c-3.595-3.892-7.197-7.777-11.14-12.05m11.14 12.05c-3.837-4.148-7.667-8.287-11.14-12.05"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </>,
  { width: 38, height: 78, fill: "none" },
);

// custom
export const ExcalLogo = createIcon(
  <g fill="currentColor">
    <path
      d="M 191.086 41.087 C 184.003 43.734, 176.140 49.019, 169.006 55.926 C 162.881 61.856, 156 70.365, 156 72.009 C 156 72.554, 155.653 73, 155.229 73 C 154.805 73, 152.737 76.487, 150.634 80.750 C 148.530 85.013, 146.402 89.282, 145.904 90.237 C 142.476 96.817, 136.352 118.607, 133.606 134 C 129.952 154.477, 128.943 168.612, 129.030 198.114 C 129.102 222.405, 128.870 227.648, 127.665 228.941 C 126.866 229.799, 124.531 232.075, 122.475 234 C 119.022 237.234, 107 252.273, 107 253.358 C 107 253.620, 105.062 257.134, 102.692 261.167 C 100.323 265.200, 97.313 271.425, 96.003 275 C 92.054 285.776, 90.877 287.365, 85.922 288.614 C 83.490 289.227, 78.540 290.915, 74.922 292.364 C 71.303 293.814, 68.051 295, 67.693 295 C 65.827 295, 50.414 302.942, 43 307.724 C 27.821 317.515, 19.779 327.574, 16.946 340.312 C 15.905 344.996, 15.896 347.132, 16.902 351.312 C 18.331 357.253, 22.103 366, 23.236 366 C 23.656 366, 24 366.618, 24 367.373 C 24 369.440, 37.553 381.879, 45.500 387.107 C 52.920 391.987, 63.238 397.499, 71.500 400.994 C 74.250 402.157, 77.400 403.522, 78.500 404.028 C 80.927 405.142, 88.745 407.931, 91.500 408.666 C 92.600 408.959, 94.918 409.829, 96.651 410.599 C 98.384 411.370, 100.394 412, 101.118 412 C 101.841 412, 104.248 412.634, 106.467 413.410 C 114.002 416.044, 121.323 417.829, 144 422.562 C 156.922 425.259, 176.457 428.031, 203.500 431.004 C 231.929 434.130, 294.475 434.127, 322.500 430.999 C 342.127 428.808, 367.895 424.803, 375.500 422.760 C 377.700 422.169, 381.300 421.361, 383.500 420.964 C 389.872 419.815, 400.343 417.023, 402.236 415.968 C 403.191 415.435, 404.766 414.997, 405.736 414.994 C 406.706 414.990, 408.707 414.358, 410.183 413.588 C 411.658 412.818, 414.240 411.886, 415.921 411.517 C 417.602 411.148, 419.234 410.431, 419.548 409.923 C 419.861 409.415, 420.765 409, 421.556 409 C 423.299 409, 438.364 401.807, 438.833 400.750 C 439.017 400.337, 439.692 399.992, 440.333 399.982 C 441.675 399.961, 448.580 395.406, 454.382 390.715 C 461.093 385.288, 465.579 380.146, 467.903 375.215 C 469.125 372.622, 470.547 369.719, 471.063 368.764 C 472.625 365.869, 472.162 352.010, 470.337 347.033 C 465.269 333.215, 449.303 319.168, 425.360 307.462 C 415.012 302.403, 414.185 301.784, 413.716 298.758 C 412.763 292.598, 408.490 280.025, 404.440 271.464 C 403.098 268.628, 402 265.994, 402 265.611 C 402 265.229, 401.541 264.372, 400.980 263.708 C 400.418 263.044, 398.215 259.745, 396.084 256.377 C 391.402 248.981, 389.518 246.659, 380.581 237.269 C 376.776 233.271, 373.093 230, 372.398 230 C 370.265 230, 369.750 226.164, 370.467 215.615 C 371.828 195.588, 371.256 131.477, 369.560 114 C 365.954 76.828, 358.260 58.851, 341.185 47.702 C 330.965 41.029, 326.085 39.500, 315 39.500 C 301.174 39.500, 291.158 43.960, 280.889 54.689 C 276.742 59.022, 267 72.904, 267 74.480 C 267 74.826, 266.141 76.998, 265.091 79.305 C 263.535 82.725, 259.305 95.043, 257.298 102 C 256.566 104.540, 255.334 101.244, 254.531 94.597 C 254.139 91.351, 253.445 87.751, 252.989 86.597 C 252.534 85.444, 251.414 82.025, 250.501 79 C 248.966 73.915, 245.173 65.166, 243.998 64 C 243.721 63.725, 242.236 61.643, 240.697 59.374 C 236.046 52.513, 225.988 43.013, 223.356 42.994 C 222.885 42.990, 221.150 42.243, 219.500 41.332 C 214.665 38.664, 197.956 38.520, 191.086 41.087 M 194.289 52.948 C 191.422 53.980, 186.432 56.859, 183.200 59.346 C 177.730 63.555, 175.972 65.364, 168.787 74.173 C 166.160 77.395, 157.509 93.875, 154.705 101 C 151.968 107.953, 147.829 122.966, 145.604 134 C 141.187 155.917, 140.744 161.134, 140.357 195.805 C 139.924 234.613, 140.712 230.921, 130.674 241.210 C 119.159 253.013, 109.707 269.398, 103.105 289 C 100.197 297.633, 97.920 312.579, 98.533 319 C 99.200 325.980, 100.731 332, 101.838 332 C 102.213 332, 103.657 333.013, 105.046 334.250 C 108.696 337.501, 113.771 341, 114.837 341 C 115.342 341, 116.223 341.564, 116.795 342.253 C 119.354 345.336, 141.910 355.235, 155.045 359.038 C 197.657 371.378, 246.207 376.330, 291.466 372.953 C 304.935 371.948, 326.766 368.734, 332 366.984 C 333.375 366.525, 337.875 365.161, 342 363.953 C 346.125 362.745, 349.928 361.362, 350.450 360.879 C 350.973 360.395, 352.010 360, 352.755 360 C 354.119 360, 360.923 357.174, 372 352.006 C 376.575 349.872, 387.724 343.601, 389.079 342.399 C 389.947 341.630, 390.954 341, 391.317 341 C 392.253 341, 395.750 338.167, 400.722 333.382 C 404.998 329.265, 405 329.259, 405.013 321.882 C 405.034 309.640, 400.322 290.367, 393.891 276.390 C 392.851 274.130, 392 271.768, 392 271.140 C 392 270.513, 391.550 270, 391 270 C 390.450 270, 390 269.492, 390 268.871 C 390 267.568, 381.012 254.161, 377.126 249.669 C 372.024 243.770, 367.737 239.930, 363.440 237.412 C 359.093 234.865, 359.093 234.865, 359.210 182.182 C 359.308 137.798, 359.050 127.137, 357.572 114.500 C 353.312 78.069, 346.356 63.114, 329.787 54.768 C 324.331 52.020, 322.438 51.595, 315.471 51.551 C 309.541 51.513, 306.273 52.020, 302.971 53.487 C 297.267 56.022, 297.008 56.219, 288.979 64.130 C 280.575 72.410, 274.335 84.444, 269.344 102 C 266.146 113.246, 262.438 135.695, 261.131 151.711 C 260.309 161.789, 258.654 165, 254.279 165 C 248.456 165, 248.386 164.783, 247.046 142.291 C 244.478 99.172, 242.423 87.808, 234.176 71.105 C 231.548 65.782, 220.991 55.304, 216 53.063 C 210.254 50.485, 201.264 50.437, 194.289 52.948 M 305.776 281.750 C 300.864 287.352, 299.813 294.307, 302.721 301.967 C 304.918 307.755, 307.524 309.925, 312.327 309.967 C 317.608 310.013, 321.376 306.135, 322.885 299.102 C 324.780 290.266, 322.114 284.058, 315.741 282.467 C 314.223 282.088, 312.734 281.378, 312.432 280.889 C 311.497 279.377, 307.390 279.908, 305.776 281.750 M 193.500 282.976 C 187.339 284.052, 184.966 287.504, 185.073 295.236 C 185.165 301.831, 187.550 306.127, 191.720 307.207 C 195.867 308.282, 199.239 306.865, 202.402 302.718 C 204.474 300, 205 298.194, 205 293.790 C 205 285.187, 201.217 281.630, 193.500 282.976 M 232.250 300.496 C 229.510 303.608, 230.860 306.410, 238.500 313.467 C 246 320.395, 246 320.395, 246 326.733 C 246 333.970, 247.953 338, 251.460 338 C 255.564 338, 257 335.064, 257 326.671 C 257 320.714, 257.317 319, 258.419 319 C 259.199 319, 261.112 318.365, 262.669 317.589 C 264.226 316.814, 267.750 315.126, 270.500 313.839 C 275.046 311.713, 275.528 311.162, 275.808 307.784 C 276.080 304.516, 275.808 303.990, 273.558 303.425 C 269.713 302.460, 267.223 303.189, 255.286 308.773 C 251.580 310.507, 250.808 310.149, 243 303.078 C 238.289 298.812, 234.528 297.908, 232.250 300.496"      
      fill="currentColor"
    />
  </g>,
  { width: 480, height: 420, fill: "none" },
);

// custom
export const SelectionIcon = createIcon(
  <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 6l4.153 11.793a0.365 .365 0 0 0 .331 .207a0.366 .366 0 0 0 .332 -.207l2.184 -4.793l4.787 -1.994a0.355 .355 0 0 0 .213 -.323a0.355 .355 0 0 0 -.213 -.323l-11.787 -4.36z" />
    <path d="M13.5 13.5l4.5 4.5" />
  </g>,
  { fill: "none", width: 22, height: 22, strokeWidth: 1.25 },
);

export const LassoIcon = createIcon(
  <g
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.5}
  >
    <path d="M4.028 13.252c-.657 -.972 -1.028 -2.078 -1.028 -3.252c0 -3.866 4.03 -7 9 -7s9 3.134 9 7s-4.03 7 -9 7c-1.913 0 -3.686 -.464 -5.144 -1.255" />
    <path d="M5 15m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M5 17c0 1.42 .316 2.805 1 4" />
  </g>,

  { fill: "none", width: 22, height: 22, strokeWidth: 1.25 },
);

// Created out own RabbitSearch icon
// tabler-icons: search
export const RabbitSearchIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
    <path d="M21 21l-6 -6" />
  </g>,
  tablerIconProps,
);

// Created out own RabbitSearch icon
// tabler-icons: search
export const RabbitColorPaletteIcon = createIcon(
  <g strokeWidth="1.5">
    {/* Invisible background path */}
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    {/* Palette shape */}
    <path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" />
    {/* Color dots */}
    <path d="M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  </g>,
  tablerIconProps,
);

// tabler-icons: square
export const RectangleIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <rect x="4" y="4" width="16" height="16" rx="2"></rect>
  </g>,
  tablerIconProps,
);

// tabler-icons: square-rotated
export const DiamondIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M10.5 20.4l-6.9 -6.9c-.781 -.781 -.781 -2.219 0 -3l6.9 -6.9c.781 -.781 2.219 -.781 3 0l6.9 6.9c.781 .781 .781 2.219 0 3l-6.9 6.9c-.781 .781 -2.219 .781 -3 0z" />
  </g>,

  tablerIconProps,
);

// tabler-icons: circle
export const EllipseIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <circle cx="12" cy="12" r="9"></circle>
  </g>,

  tablerIconProps,
);

// tabler-icons: arrow-narrow-right
export const ArrowIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <line x1="5" y1="12" x2="19" y2="12" />
    <line x1="15" y1="16" x2="19" y2="12" />
    <line x1="15" y1="8" x2="19" y2="12" />
  </g>,
  tablerIconProps,
);

// custom?
export const LineIcon = createIcon(
  <path d="M4.167 10h11.666" strokeWidth="1.5" />,
  modifiedTablerIconProps,
);

export const PenModeIcon = createIcon(
  <g strokeWidth="1.25">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M20 17v-12c0 -1.121 -.879 -2 -2 -2s-2 .879 -2 2v12l2 2l2 -2z"></path>
    <path d="M16 7h4"></path>
    <path d="M18 19h-13a2 2 0 1 1 0 -4h4a2 2 0 1 0 0 -4h-3"></path>
  </g>,
  tablerIconProps,
);

// modified tabler-icons: pencil
export const FreedrawIcon = createIcon(
  <g strokeWidth="1.25">
    <path
      clipRule="evenodd"
      d="m7.643 15.69 7.774-7.773a2.357 2.357 0 1 0-3.334-3.334L4.31 12.357a3.333 3.333 0 0 0-.977 2.357v1.953h1.953c.884 0 1.732-.352 2.357-.977Z"
    />
    <path d="m11.25 5.417 3.333 3.333" />
  </g>,

  modifiedTablerIconProps,
);

// tabler-icons: typography
export const TextIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <line x1="4" y1="20" x2="7" y2="20" />
    <line x1="14" y1="20" x2="21" y2="20" />
    <line x1="6.9" y1="15" x2="13.8" y2="15" />
    <line x1="10.2" y1="6.3" x2="16" y2="20" />
    <polyline points="5 20 11 4 13 4 20 20"></polyline>
  </g>,
  tablerIconProps,
);

// modified tabler-icons: photo
export const ImageIcon = createIcon(
  <g strokeWidth="1.25">
    <path d="M12.5 6.667h.01" />
    <path d="M4.91 2.625h10.18a2.284 2.284 0 0 1 2.285 2.284v10.182a2.284 2.284 0 0 1-2.284 2.284H4.909a2.284 2.284 0 0 1-2.284-2.284V4.909a2.284 2.284 0 0 1 2.284-2.284Z" />
    <path d="m3.333 12.5 3.334-3.333c.773-.745 1.726-.745 2.5 0l4.166 4.166" />
    <path d="m11.667 11.667.833-.834c.774-.744 1.726-.744 2.5 0l1.667 1.667" />
  </g>,
  modifiedTablerIconProps,
);

// tabler-icons: eraser
export const EraserIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3" />
    <path d="M18 13.3l-6.3 -6.3" />
  </g>,
  tablerIconProps,
);

export const ZoomInIcon = createIcon(
  <path strokeWidth="1.25" d="M10 4.167v11.666M4.167 10h11.666" />,
  modifiedTablerIconProps,
);

export const ZoomOutIcon = createIcon(
  <path d="M5 10h10" strokeWidth="1.25" />,
  modifiedTablerIconProps,
);

export const ZoomResetIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M21 21l-6 -6" />
    <path d="M3.268 12.043a7.017 7.017 0 0 0 6.634 4.957a7.012 7.012 0 0 0 7.043 -6.131a7 7 0 0 0 -5.314 -7.672a7.021 7.021 0 0 0 -8.241 4.403" />
    <path d="M3 4v4h4" />
  </g>,
  tablerIconProps,
);

export const TrashIcon = createIcon(
  <path
    strokeWidth="1.25"
    d="M3.333 5.833h13.334M8.333 9.167v5M11.667 9.167v5M4.167 5.833l.833 10c0 .92.746 1.667 1.667 1.667h6.666c.92 0 1.667-.746 1.667-1.667l.833-10M7.5 5.833v-2.5c0-.46.373-.833.833-.833h3.334c.46 0 .833.373.833.833v2.5"
  />,
  modifiedTablerIconProps,
);

export const EmbedIcon = createIcon(
  <g strokeWidth="1.5">
    <polyline points="12 16 18 10 12 4" />
    <polyline points="8 4 2 10 8 16" />
  </g>,
  modifiedTablerIconProps,
);

export const DuplicateIcon = createIcon(
  <g strokeWidth="1.25">
    <path d="M14.375 6.458H8.958a2.5 2.5 0 0 0-2.5 2.5v5.417a2.5 2.5 0 0 0 2.5 2.5h5.417a2.5 2.5 0 0 0 2.5-2.5V8.958a2.5 2.5 0 0 0-2.5-2.5Z" />
    <path
      clipRule="evenodd"
      d="M11.667 3.125c.517 0 .986.21 1.325.55.34.338.55.807.55 1.325v1.458H8.333c-.485 0-.927.185-1.26.487-.343.312-.57.75-.609 1.24l-.005 5.357H5a1.87 1.87 0 0 1-1.326-.55 1.87 1.87 0 0 1-.549-1.325V5c0-.518.21-.987.55-1.326.338-.34.807-.549 1.325-.549h6.667Z"
    />
  </g>,
  modifiedTablerIconProps,
);

export const MoonIcon = createIcon(
  <path
    clipRule="evenodd"
    d="M10 2.5h.328a6.25 6.25 0 0 0 6.6 10.372A7.5 7.5 0 1 1 10 2.493V2.5Z"
    stroke="currentColor"
  />,
  modifiedTablerIconProps,
);

export const SunIcon = createIcon(
  <g stroke="currentColor" strokeLinejoin="round">
    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM10 4.167V2.5M14.167 5.833l1.166-1.166M15.833 10H17.5M14.167 14.167l1.166 1.166M10 15.833V17.5M5.833 14.167l-1.166 1.166M5 10H3.333M5.833 5.833 4.667 4.667" />
  </g>,
  { ...modifiedTablerIconProps, strokeWidth: 1.5 },
);

export const HamburgerMenuIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <line x1="4" y1="6" x2="20" y2="6"></line>
    <line x1="4" y1="12" x2="20" y2="12"></line>
    <line x1="4" y1="18" x2="20" y2="18"></line>
  </g>,
  tablerIconProps,
);

export const ExportIcon = createIcon(
  <path
    strokeWidth="1.25"
    d="M3.333 14.167v1.666c0 .92.747 1.667 1.667 1.667h10c.92 0 1.667-.746 1.667-1.667v-1.666M5.833 9.167 10 13.333l4.167-4.166M10 3.333v10"
  />,
  modifiedTablerIconProps,
);

export const HelpIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <circle cx="12" cy="12" r="9"></circle>
    <line x1="12" y1="17" x2="12" y2="17.01"></line>
    <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4"></path>
  </g>,
  tablerIconProps,
);

export const HelpIconThin = createIcon(
  <g strokeWidth="1.25">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <circle cx="12" cy="12" r="9"></circle>
    <line x1="12" y1="17" x2="12" y2="17.01"></line>
    <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4"></path>
  </g>,
  tablerIconProps,
);

export const ExternalLinkIcon = createIcon(
  <path
    strokeWidth="1.25"
    d="M9.167 5.833H5.833c-1.254 0-2.5 1.282-2.5 2.5v5.834c0 1.283 1.252 2.5 2.5 2.5h5.834c1.251 0 2.5-1.25 2.5-2.5v-3.334M8.333 11.667l8.334-8.334M12.5 3.333h4.167V7.5"
  />,
  modifiedTablerIconProps,
);

export const GithubIcon = createIcon(
  <path
    d="M7.5 15.833c-3.583 1.167-3.583-2.083-5-2.5m10 4.167v-2.917c0-.833.083-1.166-.417-1.666 2.334-.25 4.584-1.167 4.584-5a3.833 3.833 0 0 0-1.084-2.667 3.5 3.5 0 0 0-.083-2.667s-.917-.25-2.917 1.084a10.25 10.25 0 0 0-5.166 0C5.417 2.333 4.5 2.583 4.5 2.583a3.5 3.5 0 0 0-.083 2.667 3.833 3.833 0 0 0-1.084 2.667c0 3.833 2.25 4.75 4.584 5-.5.5-.5 1-.417 1.666V17.5"
    strokeWidth="1.25"
  />,
  modifiedTablerIconProps,
);

export const DiscordIcon = createIcon(
  <g strokeWidth="1.25">
    <path d="M7.5 10.833a.833.833 0 1 0 0-1.666.833.833 0 0 0 0 1.666ZM12.5 10.833a.833.833 0 1 0 0-1.666.833.833 0 0 0 0 1.666ZM6.25 6.25c2.917-.833 4.583-.833 7.5 0M5.833 13.75c2.917.833 5.417.833 8.334 0" />
    <path d="M12.917 14.167c0 .833 1.25 2.5 1.666 2.5 1.25 0 2.361-1.39 2.917-2.5.556-1.39.417-4.861-1.25-9.584-1.214-.846-2.5-1.116-3.75-1.25l-.833 2.084M7.083 14.167c0 .833-1.13 2.5-1.526 2.5-1.191 0-2.249-1.39-2.778-2.5-.529-1.39-.397-4.861 1.19-9.584 1.157-.846 2.318-1.116 3.531-1.25l.833 2.084" />
  </g>,
  modifiedTablerIconProps,
);

export const XBrandIcon = createIcon(
  <g strokeWidth="1.25">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
    <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
  </g>,
  tablerIconProps,
);

export const checkIcon = createIcon(
  <polyline fill="none" stroke="currentColor" points="20 6 9 17 4 12" />,
  {
    width: 24,
    height: 24,
  },
);

export const LinkIcon = createIcon(
  <g strokeWidth="1.25">
    <path d="M8.333 11.667a2.917 2.917 0 0 0 4.167 0l3.333-3.334a2.946 2.946 0 1 0-4.166-4.166l-.417.416" />
    <path d="M11.667 8.333a2.917 2.917 0 0 0-4.167 0l-3.333 3.334a2.946 2.946 0 0 0 4.166 4.166l.417-.416" />
  </g>,
  modifiedTablerIconProps,
);

export const save = createIcon(
  "M433.941 129.941l-83.882-83.882A48 48 0 0 0 316.118 32H48C21.49 32 0 53.49 0 80v352c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V163.882a48 48 0 0 0-14.059-33.941zM224 416c-35.346 0-64-28.654-64-64 0-35.346 28.654-64 64-64s64 28.654 64 64c0 35.346-28.654 64-64 64zm96-304.52V212c0 6.627-5.373 12-12 12H76c-6.627 0-12-5.373-12-12V108c0-6.627 5.373-12 12-12h228.52c3.183 0 6.235 1.264 8.485 3.515l3.48 3.48A11.996 11.996 0 0 1 320 111.48z",
  { width: 448, height: 512 },
);

export const saveAs = createIcon(
  "M252 54L203 8a28 27 0 00-20-8H28C12 0 0 12 0 27v195c0 15 12 26 28 26h204c15 0 28-11 28-26V73a28 27 0 00-8-19zM130 213c-21 0-37-16-37-36 0-19 16-35 37-35 20 0 37 16 37 35 0 20-17 36-37 36zm56-169v56c0 4-4 6-7 6H44c-4 0-7-2-7-6V42c0-4 3-7 7-7h133l4 2 3 2a7 7 0 012 5z M296 201l87 95-188 205-78 9c-10 1-19-8-18-20l9-84zm141-14l-41-44a31 31 0 00-46 0l-38 41 87 95 38-42c13-14 13-36 0-50z",
  { width: 448, height: 512 },
);

// tabler-icon: folder
export const LoadIcon = createIcon(
  <path
    d="m9.257 6.351.183.183H15.819c.34 0 .727.182 1.051.506.323.323.505.708.505 1.05v5.819c0 .316-.183.7-.52 1.035-.337.338-.723.522-1.037.522H4.182c-.352 0-.74-.181-1.058-.5-.318-.318-.499-.705-.499-1.057V5.182c0-.351.181-.736.5-1.054.32-.321.71-.503 1.057-.503H6.53l2.726 2.726Z"
    strokeWidth="1.25"
  />,
  modifiedTablerIconProps,
);

export const clipboard = createIcon(
  "M384 112v352c0 26.51-21.49 48-48 48H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h80c0-35.29 28.71-64 64-64s64 28.71 64 64h80c26.51 0 48 21.49 48 48zM192 40c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24m96 114v-20a6 6 0 0 0-6-6H102a6 6 0 0 0-6 6v20a6 6 0 0 0 6 6h180a6 6 0 0 0 6-6z",
  { width: 384, height: 512 },
);

export const palette = createIcon(
  "M204.3 5C104.9 24.4 24.8 104.3 5.2 203.4c-37 187 131.7 326.4 258.8 306.7 41.2-6.4 61.4-54.6 42.5-91.7-23.1-45.4 9.9-98.4 60.9-98.4h79.7c35.8 0 64.8-29.6 64.9-65.3C511.5 97.1 368.1-26.9 204.3 5zM96 320c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm32-128c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm128-64c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm128 64c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z",
);

export const bucketFillIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M5 16l1.465 1.638a2 2 0 1 1 -3.015 .099l1.55 -1.737z" />
    <path d="M13.737 9.737c2.299 -2.3 3.23 -5.095 2.081 -6.245c-1.15 -1.15 -3.945 -.217 -6.244 2.082c-2.3 2.299 -3.231 5.095 -2.082 6.244c1.15 1.15 3.946 .218 6.245 -2.081z" />
    <path d="M7.492 11.818c.362 .362 .768 .676 1.208 .934l6.895 4.047c1.078 .557 2.255 -.075 3.692 -1.512c1.437 -1.437 2.07 -2.614 1.512 -3.692c-.372 -.718 -1.72 -3.017 -4.047 -6.895a6.015 6.015 0 0 0 -.934 -1.208" />
  </g>,
  tablerIconProps,
);

// simple / icon
export const slashIcon = createIcon(
  <g strokeWidth={1.5}>
    <path d="M6 18l12 -12" />
  </g>,
  tablerIconProps,
);

export const ExportImageIcon = createIcon(
  <g strokeWidth="1.25">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M15 8h.01"></path>
    <path d="M12 20h-5a3 3 0 0 1 -3 -3v-10a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v5"></path>
    <path d="M4 15l4 -4c.928 -.893 2.072 -.893 3 0l4 4"></path>
    <path d="M14 14l1 -1c.617 -.593 1.328 -.793 2.009 -.598"></path>
    <path d="M19 16v6"></path>
    <path d="M22 19l-3 3l-3 -3"></path>
  </g>,
  tablerIconProps,
);

export const exportToFileIcon = createIcon(
  "M216 0h80c13.3 0 24 10.7 24 24v168h87.7c17.8 0 26.7 21.5 14.1 34.1L269.7 378.3c-7.5 7.5-19.8 7.5-27.3 0L90.1 226.1c-12.6-12.6-3.7-34.1 14.1-34.1H192V24c0-13.3 10.7-24 24-24zm296 376v112c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V376c0-13.3 10.7-24 24-24h146.7l49 49c20.1 20.1 52.5 20.1 72.6 0l49-49H488c13.3 0 24 10.7 24 24zm-124 88c0-11-9-20-20-20s-20 9-20 20 9 20 20 20 20-9 20-20zm64 0c0-11-9-20-20-20s-20 9-20 20 9 20 20 20 20-9 20-20z",
  { width: 512, height: 512 },
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

export const UndoIcon = createIcon(
  <path
    d="M7.5 10.833 4.167 7.5 7.5 4.167M4.167 7.5h9.166a3.333 3.333 0 0 1 0 6.667H12.5"
    strokeWidth="1.25"
  />,
  modifiedTablerIconProps,
);

export const RedoIcon = createIcon(
  <path
    d="M12.5 10.833 15.833 7.5 12.5 4.167M15.833 7.5H6.667a3.333 3.333 0 1 0 0 6.667H7.5"
    strokeWidth="1.25"
  />,
  modifiedTablerIconProps,
);

export const questionCircle = createIcon(
  "M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zM262.655 90c-54.497 0-89.255 22.957-116.549 63.758-3.536 5.286-2.353 12.415 2.715 16.258l34.699 26.31c5.205 3.947 12.621 3.008 16.665-2.122 17.864-22.658 30.113-35.797 57.303-35.797 20.429 0 45.698 13.148 45.698 32.958 0 14.976-12.363 22.667-32.534 33.976C247.128 238.528 216 254.941 216 296v4c0 6.627 5.373 12 12 12h56c6.627 0 12-5.373 12-12v-1.333c0-28.462 83.186-29.647 83.186-106.667 0-58.002-60.165-102-116.531-102zM256 338c-25.365 0-46 20.635-46 46 0 25.364 20.635 46 46 46s46-20.636 46-46c0-25.365-20.635-46-46-46z",
  { mirror: true },
);

export const share = createIcon(
  <path
    d="M5 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15 17.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM7.25 8.917l5.5-2.834M7.25 11.083l5.5 2.834"
    strokeWidth="1.5"
  />,
  modifiedTablerIconProps,
);

export const warning = createIcon(
  "M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z",
);

export const shareIOS = createIcon(
  "M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z",
  { width: 24, height: 24 },
);

export const exportToPlus = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M8 9h-1a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-8a2 2 0 0 0 -2 -2h-1" />
    <path d="M12 14v-11" />
    <path d="M9 6l3 -3l3 3" />
  </g>,
  tablerIconProps,
);

export const shareWindows = createIcon(
  <>
    <path
      fill="currentColor"
      d="M40 5.6v6.1l-4.1.7c-8.9 1.4-16.5 6.9-20.6 15C13 32 10.9 43 12.4 43c.4 0 2.4-1.3 4.4-3 5-3.9 12.1-7 18.2-7.7l5-.6v12.8l11.2-11.3L62.5 22 51.2 10.8 40-.5v6.1zm10.2 22.6L44 34.5v-6.8l-6.9.6c-3.9.3-9.8 1.7-13.2 3.1-3.5 1.4-6.5 2.4-6.7 2.2-.9-1 3-7.5 6.4-10.8C28 18.6 34.4 16 40.1 16c3.7 0 3.9-.1 3.9-3.2V9.5l6.2 6.3 6.3 6.2-6.3 6.2z"
    />
    <path
      stroke="currentColor"
      fill="currentColor"
      d="M0 36v20h48v-6.2c0-6 0-6.1-2-4.3-1.1 1-2 2.9-2 4.2V52H4V34c0-17.3-.1-18-2-18s-2 .7-2 20z"
    />
  </>,
  { width: 64, height: 64 },
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

const arrowBarToTopJSX = (
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 10l0 10" />
    <path d="M12 10l4 4" />
    <path d="M12 10l-4 4" />
    <path d="M4 4l16 0" />
  </g>
);

const arrownNarrowUpJSX = (
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 5l0 14" />
    <path d="M16 9l-4 -4" />
    <path d="M8 9l4 -4" />
  </g>
);

export const BringForwardIcon = createIcon(arrownNarrowUpJSX, tablerIconProps);

export const SendBackwardIcon = createIcon(arrownNarrowUpJSX, {
  ...tablerIconProps,
  style: {
    transform: "rotate(180deg)",
  },
});

export const BringToFrontIcon = createIcon(arrowBarToTopJSX, tablerIconProps);

export const SendToBackIcon = createIcon(arrowBarToTopJSX, {
  ...tablerIconProps,
  style: {
    transform: "rotate(180deg)",
  },
});

//
// Align action icons created from scratch to match those of z-index actions
// Note: vertical align icons are flipped so the larger item is always the
// first one the user sees. Horizontal align icons should not be flipped since
// that would make them lie about their function.
//
export const AlignTopIcon = createIcon(
  <>
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth="1.25">
      <path
        d="M3.333 3.333h13.334"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.542 6.458h-.417c-.92 0-1.667.747-1.667 1.667v7.083c0 .92.746 1.667 1.667 1.667h.417c.92 0 1.666-.746 1.666-1.667V8.125c0-.92-.746-1.667-1.666-1.667ZM6.875 6.458h-.417c-.92 0-1.666.747-1.666 1.667v3.75c0 .92.746 1.667 1.666 1.667h.417c.92 0 1.667-.746 1.667-1.667v-3.75c0-.92-.747-1.667-1.667-1.667Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const AlignBottomIcon = createIcon(
  <>
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth="1.25">
      <path
        d="M3.333 16.667h13.334"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.875 3.125h-.417c-.92 0-1.666.746-1.666 1.667v7.083c0 .92.746 1.667 1.666 1.667h.417c.92 0 1.667-.746 1.667-1.667V4.792c0-.92-.747-1.667-1.667-1.667ZM13.542 5.817h-.417c-.92 0-1.667.747-1.667 1.667v4.391c0 .92.746 1.667 1.667 1.667h.417c.92 0 1.666-.746 1.666-1.667V7.484c0-.92-.746-1.667-1.666-1.667Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const AlignLeftIcon = createIcon(
  <>
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth="1.25">
      <path
        d="M3.333 3.333v13.334"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15.208 4.792H8.125c-.92 0-1.667.746-1.667 1.666v.417c0 .92.747 1.667 1.667 1.667h7.083c.92 0 1.667-.747 1.667-1.667v-.417c0-.92-.746-1.666-1.667-1.666ZM12.516 11.458H8.125c-.92 0-1.667.746-1.667 1.667v.417c0 .92.747 1.666 1.667 1.666h4.391c.92 0 1.667-.746 1.667-1.666v-.417c0-.92-.746-1.667-1.667-1.667Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const AlignRightIcon = createIcon(
  <>
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth="1.25">
      <path
        d="M16.667 3.333v13.334"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11.875 4.792H4.792c-.92 0-1.667.746-1.667 1.666v.417c0 .92.746 1.667 1.667 1.667h7.083c.92 0 1.667-.747 1.667-1.667v-.417c0-.92-.746-1.666-1.667-1.666ZM11.683 11.458H7.292c-.92 0-1.667.746-1.667 1.667v.417c0 .92.746 1.666 1.667 1.666h4.39c.921 0 1.667-.746 1.667-1.666v-.417c0-.92-.746-1.667-1.666-1.667Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const DistributeHorizontallyIcon = createIcon(
  <>
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth="1.25">
      <path
        d="M16.667 3.333v13.334M3.333 3.333v13.334"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.375 10.208v-.416c0-.92-.746-1.667-1.667-1.667H7.292c-.92 0-1.667.746-1.667 1.667v.416c0 .92.746 1.667 1.667 1.667h5.416c.92 0 1.667-.746 1.667-1.667Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const DistributeVerticallyIcon = createIcon(
  <>
    <g clipPath="url(#a)" stroke="currentColor" strokeWidth="1.25">
      <path
        d="M3.333 3.333h13.334M3.333 16.667h13.334"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.208 5.625h-.416c-.92 0-1.667.746-1.667 1.667v5.416c0 .92.746 1.667 1.667 1.667h.416c.92 0 1.667-.746 1.667-1.667V7.292c0-.92-.746-1.667-1.667-1.667Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const CenterVerticallyIcon = createIcon(
  <g stroke="currentColor" strokeWidth="1.25">
    <path d="M1.667 10h2.916" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.333 10h3.334" strokeLinejoin="round" />
    <path d="M15.417 10h2.916" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.875 4.792h-.417c-.92 0-1.666.746-1.666 1.666v7.084c0 .92.746 1.666 1.666 1.666h.417c.92 0 1.667-.746 1.667-1.666V6.458c0-.92-.747-1.666-1.667-1.666ZM13.542 6.458h-.417c-.92 0-1.667.747-1.667 1.667v3.75c0 .92.746 1.667 1.667 1.667h.417c.92 0 1.666-.746 1.666-1.667v-3.75c0-.92-.746-1.667-1.666-1.667Z" />
  </g>,
  modifiedTablerIconProps,
);

export const CenterHorizontallyIcon = createIcon(
  <g stroke="currentColor" strokeWidth="1.25">
    <path d="M10 18.333v-2.916" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11.667V8.333" strokeLinejoin="round" />
    <path d="M10 4.583V1.667" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.792 13.125v.417c0 .92.746 1.666 1.666 1.666h7.084c.92 0 1.666-.746 1.666-1.666v-.417c0-.92-.746-1.667-1.666-1.667H6.458c-.92 0-1.666.746-1.666 1.667ZM6.458 6.458v.417c0 .92.747 1.667 1.667 1.667h3.75c.92 0 1.667-.747 1.667-1.667v-.417c0-.92-.746-1.666-1.667-1.666h-3.75c-.92 0-1.667.746-1.667 1.666Z" />
  </g>,
  modifiedTablerIconProps,
);

export const usersIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    <path d="M21 21v-2a4 4 0 0 0 -3 -3.85"></path>
  </g>,
  tablerIconProps,
);

// not mirrored because it's inspired by a playback control, which is always RTL
export const start = createIcon(
  "M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm115.7 272l-176 101c-15.8 8.8-35.7-2.5-35.7-21V152c0-18.4 19.8-29.8 35.7-21l176 107c16.4 9.2 16.4 32.9 0 42z",
);

export const stop = createIcon(
  "M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm96 328c0 8.8-7.2 16-16 16H176c-8.8 0-16-7.2-16-16V176c0-8.8 7.2-16 16-16h160c8.8 0 16 7.2 16 16v160z",
);

export const CloseIcon = createIcon(
  <>
    <g
      clipPath="url(#a)"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 5 5 15M5 5l10 10" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
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

export const file = createIcon(
  "M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm32-48h224V288l-23.5-23.5c-4.7-4.7-12.3-4.7-17 0L176 352l-39.5-39.5c-4.7-4.7-12.3-4.7-17 0L80 352v64zm48-240c-26.5 0-48 21.5-48 48s21.5 48 48 48 48-21.5 48-48-21.5-48-48-48z",
  { width: 384, height: 512 },
);

// TODO barnabasmolnar/editor-redesign
// couldn't find a new icon for this
export const GroupIcon = React.memo(({ theme }: { theme: Theme }) =>
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
      <g
        fill={handlerColor(theme)}
        stroke={iconFillColor(theme)}
        strokeWidth="6"
      >
        <rect x="2.5" y="2.5" width="30" height="30" />
        <rect x="2.5" y="149.5" width="30" height="30" />
        <rect x="147.5" y="149.5" width="30" height="30" />
        <rect x="147.5" y="2.5" width="30" height="30" />
      </g>
    </>,
    { width: 182, height: 182, mirror: true },
  ),
);

export const UngroupIcon = React.memo(({ theme }: { theme: Theme }) =>
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
      <g
        fill={handlerColor(theme)}
        stroke={iconFillColor(theme)}
        strokeWidth="6"
      >
        <rect x="2.5" y="2.5" width="30" height="30" />
        <rect x="78.5" y="149.5" width="30" height="30" />
        <rect x="147.5" y="149.5" width="30" height="30" />
        <rect x="147.5" y="78.5" width="30" height="30" />
        <rect x="105.5" y="2.5" width="30" height="30" />
        <rect x="2.5" y="102.5" width="30" height="30" />
      </g>
    </>,
    { width: 182, height: 182, mirror: true },
  ),
);

export const FillZigZagIcon = createIcon(
  <g strokeWidth={1.25}>
    <path d="M5.879 2.625h8.242a3.27 3.27 0 0 1 3.254 3.254v8.242a3.27 3.27 0 0 1-3.254 3.254H5.88a3.27 3.27 0 0 1-3.254-3.254V5.88A3.27 3.27 0 0 1 5.88 2.626l-.001-.001ZM4.518 16.118l7.608-12.83m.198 13.934 5.051-9.897M2.778 9.675l9.348-6.387m-7.608 12.83 12.857-8.793" />
  </g>,
  modifiedTablerIconProps,
);

export const FillHachureIcon = createIcon(
  <>
    <path
      d="M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z"
      stroke="currentColor"
      strokeWidth="1.25"
    />
    <mask
      id="FillHachureIcon"
      style={{ maskType: "alpha" }}
      maskUnits="userSpaceOnUse"
      x={2}
      y={2}
      width={16}
      height={16}
    >
      <path
        d="M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </mask>
    <g mask="url(#FillHachureIcon)">
      <path
        d="M2.258 15.156 15.156 2.258M7.324 20.222 20.222 7.325m-20.444 5.35L12.675-.222m-8.157 18.34L17.416 5.22"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </>,
  modifiedTablerIconProps,
);

export const FillCrossHatchIcon = createIcon(
  <>
    <g clipPath="url(#a)">
      <path
        d="M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <mask
        id="FillCrossHatchIcon"
        style={{ maskType: "alpha" }}
        maskUnits="userSpaceOnUse"
        x={-1}
        y={-1}
        width={22}
        height={22}
      >
        <path
          d="M2.426 15.044 15.044 2.426M7.383 20 20 7.383M0 12.617 12.617 0m-7.98 17.941L17.256 5.324m-2.211 12.25L2.426 4.956M20 12.617 7.383 0m5.234 20L0 7.383m17.941 7.98L5.324 2.745"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </mask>
      <g mask="url(#FillCrossHatchIcon)">
        <path
          d="M14.121 2H5.88A3.879 3.879 0 0 0 2 5.879v8.242A3.879 3.879 0 0 0 5.879 18h8.242A3.879 3.879 0 0 0 18 14.121V5.88A3.879 3.879 0 0 0 14.121 2Z"
          fill="currentColor"
        />
      </g>
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const FillSolidIcon = createIcon(
  <>
    <g clipPath="url(#a)">
      <path
        d="M4.91 2.625h10.18a2.284 2.284 0 0 1 2.285 2.284v10.182a2.284 2.284 0 0 1-2.284 2.284H4.909a2.284 2.284 0 0 1-2.284-2.284V4.909a2.284 2.284 0 0 1 2.284-2.284Z"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  { ...modifiedTablerIconProps, fill: "currentColor" },
);

export const StrokeWidthBaseIcon = createIcon(
  <>
    <path
      d="M4.167 10h11.666"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>,
  modifiedTablerIconProps,
);

export const StrokeWidthBoldIcon = createIcon(
  <path
    d="M5 10h10"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
  modifiedTablerIconProps,
);

export const StrokeWidthExtraBoldIcon = createIcon(
  <path
    d="M5 10h10"
    stroke="currentColor"
    strokeWidth="3.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
  modifiedTablerIconProps,
);

export const StrokeStyleSolidIcon = React.memo(({ theme }: { theme: Theme }) =>
  createIcon(
    <path
      d="M6 10H34"
      stroke={iconFillColor(theme)}
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
    />,
    {
      width: 40,
      height: 20,
    },
  ),
);

export const StrokeStyleDashedIcon = createIcon(
  <g strokeWidth="2">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M5 12h2" />
    <path d="M17 12h2" />
    <path d="M11 12h2" />
  </g>,
  tablerIconProps,
);

// tabler-icons: line-dotted
export const StrokeStyleDottedIcon = createIcon(
  <g strokeWidth="2">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 12v.01" />
    <path d="M8 12v.01" />
    <path d="M12 12v.01" />
    <path d="M16 12v.01" />
    <path d="M20 12v.01" />
  </g>,
  tablerIconProps,
);

export const SloppinessArchitectIcon = createIcon(
  <path
    d="M2.5 12.038c1.655-.885 5.9-3.292 8.568-4.354 2.668-1.063.101 2.821 1.32 3.104 1.218.283 5.112-1.814 5.112-1.814"
    strokeWidth="1.25"
  />,
  modifiedTablerIconProps,
);

export const SloppinessArtistIcon = createIcon(
  <path
    d="M2.5 12.563c1.655-.886 5.9-3.293 8.568-4.355 2.668-1.062.101 2.822 1.32 3.105 1.218.283 5.112-1.814 5.112-1.814m-13.469 2.23c2.963-1.586 6.13-5.62 7.468-4.998 1.338.623-1.153 4.11-.132 5.595 1.02 1.487 6.133-1.43 6.133-1.43"
    strokeWidth="1.25"
  />,
  modifiedTablerIconProps,
);

export const SloppinessCartoonistIcon = createIcon(
  <path
    d="M2.5 11.936c1.737-.879 8.627-5.346 10.42-5.268 1.795.078-.418 5.138.345 5.736.763.598 3.53-1.789 4.235-2.147M2.929 9.788c1.164-.519 5.47-3.28 6.987-3.114 1.519.165 1 3.827 2.121 4.109 1.122.281 3.839-2.016 4.606-2.42"
    strokeWidth="1.25"
  />,
  modifiedTablerIconProps,
);

export const EdgeSharpIcon = createIcon(
  <svg strokeWidth="1.5">
    <path d="M3.33334 9.99998V6.66665C3.33334 6.04326 3.33403 4.9332 3.33539 3.33646C4.95233 3.33436 6.06276 3.33331 6.66668 3.33331H10" />
    <path d="M13.3333 3.33331V3.34331" />
    <path d="M16.6667 3.33331V3.34331" />
    <path d="M16.6667 6.66669V6.67669" />
    <path d="M16.6667 10V10.01" />
    <path d="M3.33334 13.3333V13.3433" />
    <path d="M16.6667 13.3333V13.3433" />
    <path d="M3.33334 16.6667V16.6767" />
    <path d="M6.66666 16.6667V16.6767" />
    <path d="M10 16.6667V16.6767" />
    <path d="M13.3333 16.6667V16.6767" />
    <path d="M16.6667 16.6667V16.6767" />
  </svg>,
  modifiedTablerIconProps,
);

// tabler-icons: border-radius
export const EdgeRoundIcon = createIcon(
  <g
    strokeWidth="1.5"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 12v-4a4 4 0 0 1 4 -4h4" />
    <line x1="16" y1="4" x2="16" y2="4.01" />
    <line x1="20" y1="4" x2="20" y2="4.01" />
    <line x1="20" y1="8" x2="20" y2="8.01" />
    <line x1="20" y1="12" x2="20" y2="12.01" />
    <line x1="4" y1="16" x2="4" y2="16.01" />
    <line x1="20" y1="16" x2="20" y2="16.01" />
    <line x1="4" y1="20" x2="4" y2="20.01" />
    <line x1="8" y1="20" x2="8" y2="20.01" />
    <line x1="12" y1="20" x2="12" y2="20.01" />
    <line x1="16" y1="20" x2="16" y2="20.01" />
    <line x1="20" y1="20" x2="20" y2="20.01" />
  </g>,
  tablerIconProps,
);

export const ArrowheadNoneIcon = createIcon(
  <g stroke="currentColor" opacity={0.3} strokeWidth={2}>
    <path d="M12 12l9 0" />
    <path d="M3 9l6 6" />
    <path d="M3 15l6 -6" />
  </g>,
  tablerIconProps,
);

export const ArrowheadArrowIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        stroke="currentColor"
        strokeWidth={2}
        fill="none"
      >
        <path d="M34 10H6M34 10L27 5M34 10L27 15" />
        <path d="M27.5 5L34.5 10L27.5 15" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const ArrowheadCircleIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="currentColor"
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
      >
        <path d="M32 10L6 10" strokeWidth={2} />
        <circle r="4" transform="matrix(-1 0 0 1 30 10)" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const ArrowheadCircleOutlineIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        strokeWidth={2}
      >
        <path d="M26 10L6 10" />
        <circle r="4" transform="matrix(-1 0 0 1 30 10)" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const ArrowheadBarIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}>
        <path
          d="M34 10H5.99996M34 10L34 5M34 10L34 15"
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
        />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const ArrowheadTriangleIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="currentColor"
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
      >
        <path d="M32 10L6 10" strokeWidth={2} />
        <path d="M27.5 5.5L34.5 10L27.5 14.5L27.5 5.5" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const ArrowheadTriangleOutlineIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        strokeWidth={2}
        strokeLinejoin="round"
      >
        <path d="M6,9.5H27" />
        <path d="M27,5L34,10L27,14Z" fill="none" />
      </g>,

      { width: 40, height: 20 },
    ),
);

export const ArrowheadDiamondIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="currentColor"
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="M6,9.5H20" />
        <path d="M27,5L34,10L27,14L20,9.5Z" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const ArrowheadDiamondOutlineIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "translate(40, 0) scale(-1, 1)" : ""}
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="M6,9.5H20" />
        <path d="M27,5L34,10L27,14L20,9.5Z" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const ArrowheadCrowfootIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "" : "translate(40, 0) scale(-1, 1)"}
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="M34,10 H6 M15,10 L7,5 M15,10 L7,15" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const ArrowheadCrowfootOneIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "" : "translate(40, 0) scale(-1, 1)"}
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="M34,10 H6 M15,10 L15,15 L15,5" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const ArrowheadCrowfootOneOrManyIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        stroke="currentColor"
        fill="none"
        transform={flip ? "" : "translate(40, 0) scale(-1, 1)"}
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="M34,10 H6 M15,10 L15,16 L15,4 M15,10 L7,5 M15,10 L7,15" />
      </g>,
      { width: 40, height: 20 },
    ),
);

export const FontSizeSmallIcon = createIcon(
  <>
    <g clipPath="url(#a)">
      <path
        d="M14.167 6.667a3.333 3.333 0 0 0-3.334-3.334H9.167a3.333 3.333 0 0 0 0 6.667h1.666a3.333 3.333 0 0 1 0 6.667H9.167a3.333 3.333 0 0 1-3.334-3.334"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const FontSizeMediumIcon = createIcon(
  <>
    <g clipPath="url(#a)">
      <path
        d="M5 16.667V3.333L10 15l5-11.667v13.334"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const FontSizeLargeIcon = createIcon(
  <>
    <g clipPath="url(#a)">
      <path
        d="M5.833 3.333v13.334h8.334"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const FontSizeExtraLargeIcon = createIcon(
  <>
    <path
      d="m1.667 3.333 6.666 13.334M8.333 3.333 1.667 16.667M11.667 3.333v13.334h6.666"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>,
  modifiedTablerIconProps,
);

export const fontSizeIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 7v-2h13v2" />
    <path d="M10 5v14" />
    <path d="M12 19h-4" />
    <path d="M15 13v-1h6v1" />
    <path d="M18 12v7" />
    <path d="M17 19h2" />
  </g>,
  tablerIconProps,
);

export const FontFamilyHeadingIcon = createIcon(
  <>
    <g
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M7 12h10" />
      <path d="M7 5v14" />
      <path d="M17 5v14" />
      <path d="M15 19h4" />
      <path d="M15 5h4" />
      <path d="M5 19h4" />
      <path d="M5 5h4" />
    </g>
  </>,
  tablerIconProps,
);

export const FontFamilyNormalIcon = createIcon(
  <>
    <g
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.833 16.667v-10a3.333 3.333 0 0 1 3.334-3.334h1.666a3.333 3.333 0 0 1 3.334 3.334v10M5.833 10.833h8.334" />
    </g>
  </>,
  modifiedTablerIconProps,
);

export const FontFamilyCodeIcon = createIcon(
  <>
    <g
      clipPath="url(#a)"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.833 6.667 2.5 10l3.333 3.333M14.167 6.667 17.5 10l-3.333 3.333M11.667 3.333 8.333 16.667" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </>,
  modifiedTablerIconProps,
);

export const TextAlignLeftIcon = createIcon(
  <g
    stroke="currentColor"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <line x1="4" y1="8" x2="20" y2="8" />
    <line x1="4" y1="12" x2="12" y2="12" />
    <line x1="4" y1="16" x2="16" y2="16" />
  </g>,
  tablerIconProps,
);

export const TextAlignCenterIcon = createIcon(
  <g
    stroke="currentColor"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <line x1="4" y1="8" x2="20" y2="8" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="6" y1="16" x2="18" y2="16" />
  </g>,
  tablerIconProps,
);

export const TextAlignRightIcon = createIcon(
  <g
    stroke="currentColor"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <line x1="4" y1="8" x2="20" y2="8" />
    <line x1="10" y1="12" x2="20" y2="12" />
    <line x1="8" y1="16" x2="20" y2="16" />
  </g>,
  tablerIconProps,
);

// tabler-icons: layout-align-top
export const TextAlignTopIcon = React.memo(({ theme }: { theme: Theme }) =>
  createIcon(
    <g
      strokeWidth="1.5"
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <line x1="4" y1="4" x2="20" y2="4" />
      <rect x="9" y="8" width="6" height="12" rx="2" />
    </g>,
    tablerIconProps,
  ),
);

// tabler-icons: layout-align-bottom
export const TextAlignBottomIcon = React.memo(({ theme }: { theme: Theme }) =>
  createIcon(
    <g
      strokeWidth="2"
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="9" y="4" width="6" height="12" rx="2"></rect>
    </g>,
    tablerIconProps,
  ),
);

// tabler-icons: layout-align-middle
export const TextAlignMiddleIcon = React.memo(({ theme }: { theme: Theme }) =>
  createIcon(
    <g
      strokeWidth="1.5"
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <line x1="4" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="20" y2="12" />
      <rect x="9" y="6" width="6" height="12" rx="2" />
    </g>,
    tablerIconProps,
  ),
);

export const angleIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M21 19h-18l9 -15" />
    <path d="M20.615 15.171h.015" />
    <path d="M19.515 11.771h.015" />
    <path d="M17.715 8.671h.015" />
    <path d="M15.415 5.971h.015" />
  </g>,
  tablerIconProps,
);

export const publishIcon = createIcon(
  <path
    d="M537.6 226.6c4.1-10.7 6.4-22.4 6.4-34.6 0-53-43-96-96-96-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32c-88.4 0-160 71.6-160 160 0 2.7.1 5.4.2 8.1C40.2 219.8 0 273.2 0 336c0 79.5 64.5 144 144 144h368c70.7 0 128-57.3 128-128 0-61.9-44-113.6-102.4-125.4zM393.4 288H328v112c0 8.8-7.2 16-16 16h-48c-8.8 0-16-7.2-16-16V288h-65.4c-14.3 0-21.4-17.2-11.3-27.3l105.4-105.4c6.2-6.2 16.4-6.2 22.6 0l105.4 105.4c10.1 10.1 2.9 27.3-11.3 27.3z"
    fill="currentColor"
  />,
  { width: 640, height: 512 },
);

export const eraser = createIcon(
  <path d="M480 416C497.7 416 512 430.3 512 448C512 465.7 497.7 480 480 480H150.6C133.7 480 117.4 473.3 105.4 461.3L25.37 381.3C.3786 356.3 .3786 315.7 25.37 290.7L258.7 57.37C283.7 32.38 324.3 32.38 349.3 57.37L486.6 194.7C511.6 219.7 511.6 260.3 486.6 285.3L355.9 416H480zM265.4 416L332.7 348.7L195.3 211.3L70.63 336L150.6 416L265.4 416z" />,
);

export const handIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M8 13v-7.5a1.5 1.5 0 0 1 3 0v6.5"></path>
    <path d="M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5"></path>
    <path d="M14 5.5a1.5 1.5 0 0 1 3 0v6.5"></path>
    <path d="M17 7.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47"></path>
  </g>,
  tablerIconProps,
);

export const downloadIcon = createIcon(
  <>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"></path>
    <path d="M7 11l5 5l5 -5"></path>
    <path d="M12 4l0 12"></path>
  </>,
  tablerIconProps,
);

export const copyIcon = createIcon(
  <>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"></path>
    <path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"></path>
  </>,
  tablerIconProps,
);

export const cutIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M7 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M9.15 14.85l8.85 -10.85" />
    <path d="M6 4l8.85 10.85" />
  </g>,
  tablerIconProps,
);

export const helpIcon = createIcon(
  <>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
    <path d="M12 17l0 .01"></path>
    <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4"></path>
  </>,
  tablerIconProps,
);

export const playerPlayIcon = createIcon(
  <>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M7 4v16l13 -8z"></path>
  </>,
  tablerIconProps,
);

export const playerStopFilledIcon = createIcon(
  <>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path
      d="M17 4h-10a3 3 0 0 0 -3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3 -3v-10a3 3 0 0 0 -3 -3z"
      strokeWidth="0"
      fill="currentColor"
    ></path>
  </>,
  tablerIconProps,
);

export const tablerCheckIcon = createIcon(
  <>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M5 12l5 5l10 -10"></path>
  </>,
  tablerIconProps,
);

export const alertTriangleIcon = createIcon(
  <>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M10.24 3.957l-8.422 14.06a1.989 1.989 0 0 0 1.7 2.983h16.845a1.989 1.989 0 0 0 1.7 -2.983l-8.423 -14.06a1.989 1.989 0 0 0 -3.4 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </>,
  tablerIconProps,
);

export const eyeDropperIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M11 7l6 6"></path>
    <path d="M4 16l11.7 -11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4z"></path>
  </g>,
  tablerIconProps,
);

export const extraToolsIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M12 3l-4 7h8z"></path>
    <path d="M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"></path>
    <path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path>
  </g>,
  tablerIconProps,
);

export const frameToolIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M4 7l16 0"></path>
    <path d="M4 17l16 0"></path>
    <path d="M7 4l0 16"></path>
    <path d="M17 4l0 16"></path>
  </g>,
  tablerIconProps,
);

export const mermaidLogoIcon = createIcon(
  <path
    fill="currentColor"
    d="M407.48,111.18C335.587,108.103 269.573,152.338 245.08,220C220.587,152.338 154.573,108.103 82.68,111.18C80.285,168.229 107.577,222.632 154.74,254.82C178.908,271.419 193.35,298.951 193.27,328.27L193.27,379.13L296.9,379.13L296.9,328.27C296.816,298.953 311.255,271.42 335.42,254.82C382.596,222.644 409.892,168.233 407.48,111.18Z"
  />,
);

export const ArrowRightIcon = createIcon(
  <g strokeWidth="1.25">
    <path d="M4.16602 10H15.8327" />
    <path d="M12.5 13.3333L15.8333 10" />
    <path d="M12.5 6.66666L15.8333 9.99999" />
  </g>,
  modifiedTablerIconProps,
);

export const laserPointerToolIcon = createIcon(
  <g
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    transform="rotate(90 10 10)"
  >
    <path
      clipRule="evenodd"
      d="m9.644 13.69 7.774-7.773a2.357 2.357 0 0 0-3.334-3.334l-7.773 7.774L8 12l1.643 1.69Z"
    />
    <path d="m13.25 3.417 3.333 3.333M10 10l2-2M5 15l3-3M2.156 17.894l1-1M5.453 19.029l-.144-1.407M2.377 11.887l.866 1.118M8.354 17.273l-1.194-.758M.953 14.652l1.408.13" />
  </g>,

  20,
);

export const MagicIcon = createIcon(
  <g stroke="currentColor" fill="none">
    <path stroke="none" d="M0 0h24v24H0z" />
    <path d="M6 21l15 -15l-3 -3l-15 15l3 3" />
    <path d="M15 6l3 3" />
    <path d="M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" />
    <path d="M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" />
  </g>,
  tablerIconProps,
);

export const MagicIconThin = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" />
    <path d="M6 21l15 -15l-3 -3l-15 15l3 3" />
    <path d="M15 6l3 3" />
    <path d="M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" />
    <path d="M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" />
  </g>,
  tablerIconProps,
);

export const OpenAIIcon = createIcon(
  <g stroke="currentColor" fill="none">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M11.217 19.384a3.501 3.501 0 0 0 6.783 -1.217v-5.167l-6 -3.35" />
    <path d="M5.214 15.014a3.501 3.501 0 0 0 4.446 5.266l4.34 -2.534v-6.946" />
    <path d="M6 7.63c-1.391 -.236 -2.787 .395 -3.534 1.689a3.474 3.474 0 0 0 1.271 4.745l4.263 2.514l6 -3.348" />
    <path d="M12.783 4.616a3.501 3.501 0 0 0 -6.783 1.217v5.067l6 3.45" />
    <path d="M18.786 8.986a3.501 3.501 0 0 0 -4.446 -5.266l-4.34 2.534v6.946" />
    <path d="M18 16.302c1.391 .236 2.787 -.395 3.534 -1.689a3.474 3.474 0 0 0 -1.271 -4.745l-4.308 -2.514l-5.955 3.42" />
  </g>,
  tablerIconProps,
);

export const fullscreenIcon = createIcon(
  <g stroke="currentColor" fill="none">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 8v-2a2 2 0 0 1 2 -2h2" />
    <path d="M4 16v2a2 2 0 0 0 2 2h2" />
    <path d="M16 4h2a2 2 0 0 1 2 2v2" />
    <path d="M16 20h2a2 2 0 0 0 2 -2v-2" />
  </g>,
  tablerIconProps,
);

export const eyeIcon = createIcon(
  <g stroke="currentColor" fill="none" strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
    <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
  </g>,
  tablerIconProps,
);

export const eyeClosedIcon = createIcon(
  <g stroke="currentColor" fill="none">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
    <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
    <path d="M3 3l18 18" />
  </g>,
  tablerIconProps,
);

export const brainIcon = createIcon(
  <g stroke="currentColor" fill="none">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8" />
    <path d="M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8" />
    <path d="M17.5 16a3.5 3.5 0 0 0 0 -7h-.5" />
    <path d="M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0" />
    <path d="M6.5 16a3.5 3.5 0 0 1 0 -7h.5" />
    <path d="M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10" />
  </g>,
  tablerIconProps,
);

export const brainIconThin = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8" />
    <path d="M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8" />
    <path d="M17.5 16a3.5 3.5 0 0 0 0 -7h-.5" />
    <path d="M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0" />
    <path d="M6.5 16a3.5 3.5 0 0 1 0 -7h.5" />
    <path d="M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10" />
  </g>,
  tablerIconProps,
);

export const searchIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
    <path d="M21 21l-6 -6" />
  </g>,
  tablerIconProps,
);

export const clockIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M20.984 12.53a9 9 0 1 0 -7.552 8.355" />
    <path d="M12 7v5l3 3" />
    <path d="M19 16l-2 3h4l-2 3" />
  </g>,
  tablerIconProps,
);

export const microphoneIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M9 2m0 3a3 3 0 0 1 3 -3h0a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3h0a3 3 0 0 1 -3 -3z" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <path d="M8 21l8 0" />
    <path d="M12 17l0 4" />
  </g>,
  tablerIconProps,
);

export const microphoneMutedIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 3l18 18" />
    <path d="M9 5a3 3 0 0 1 6 0v5a3 3 0 0 1 -.13 .874m-2 2a3 3 0 0 1 -3.87 -2.872v-1" />
    <path d="M5 10a7 7 0 0 0 10.846 5.85m2 -2a6.967 6.967 0 0 0 1.152 -3.85" />
    <path d="M8 21l8 0" />
    <path d="M12 17l0 4" />
  </g>,
  tablerIconProps,
);

export const boltIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" />
  </g>,
  tablerIconProps,
);
export const selectAllIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M8 8m0 1a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" />
    <path d="M12 20v.01" />
    <path d="M16 20v.01" />
    <path d="M8 20v.01" />
    <path d="M4 20v.01" />
    <path d="M4 16v.01" />
    <path d="M4 12v.01" />
    <path d="M4 8v.01" />
    <path d="M4 4v.01" />
    <path d="M8 4v.01" />
    <path d="M12 4v.01" />
    <path d="M16 4v.01" />
    <path d="M20 4v.01" />
    <path d="M20 8v.01" />
    <path d="M20 12v.01" />
    <path d="M20 16v.01" />
    <path d="M20 20v.01" />
  </g>,
  tablerIconProps,
);

export const abacusIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M5 3v18" />
    <path d="M19 21v-18" />
    <path d="M5 7h14" />
    <path d="M5 15h14" />
    <path d="M8 13v4" />
    <path d="M11 13v4" />
    <path d="M16 13v4" />
    <path d="M14 5v4" />
    <path d="M11 5v4" />
    <path d="M8 5v4" />
    <path d="M3 21h18" />
  </g>,
  tablerIconProps,
);

export const flipVertical = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 12l18 0" />
    <path d="M7 16l10 0l-10 5l0 -5" />
    <path d="M7 8l10 0l-10 -5l0 5" />
  </g>,
  tablerIconProps,
);

export const flipHorizontal = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 3l0 18" />
    <path d="M16 7l0 10l5 0l-5 -10" />
    <path d="M8 7l0 10l-5 0l5 -10" />
  </g>,
  tablerIconProps,
);

export const paintIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M5 3m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z" />
    <path d="M19 6h1a2 2 0 0 1 2 2a5 5 0 0 1 -5 5l-5 0v2" />
    <path d="M10 15m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" />
  </g>,
  tablerIconProps,
);

export const zoomAreaIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M15 15m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" />
    <path d="M22 22l-3 -3" />
    <path d="M6 18h-1a2 2 0 0 1 -2 -2v-1" />
    <path d="M3 11v-1" />
    <path d="M3 6v-1a2 2 0 0 1 2 -2h1" />
    <path d="M10 3h1" />
    <path d="M15 3h1a2 2 0 0 1 2 2v1" />
  </g>,
  tablerIconProps,
);

export const svgIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
    <path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" />
    <path d="M4 20.25c0 .414 .336 .75 .75 .75h1.25a1 1 0 0 0 1 -1v-1a1 1 0 0 0 -1 -1h-1a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1h1.25a.75 .75 0 0 1 .75 .75" />
    <path d="M10 15l2 6l2 -6" />
    <path d="M20 15h-1a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h1v-3" />
  </g>,
  tablerIconProps,
);

export const pngIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
    <path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" />
    <path d="M20 15h-1a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h1v-3" />
    <path d="M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" />
    <path d="M11 21v-6l3 6v-6" />
  </g>,
  tablerIconProps,
);

export const magnetIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 13v-8a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v8a2 2 0 0 0 6 0v-8a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v8a8 8 0 0 1 -16 0" />
    <path d="M4 8l5 0" />
    <path d="M15 8l4 0" />
  </g>,
  tablerIconProps,
);

export const coffeeIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1" />
    <path d="M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" />
    <path d="M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" />
    <path d="M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5z" />
    <path d="M16.746 16.726a3 3 0 1 0 .252 -5.555" />
  </g>,
  tablerIconProps,
);

export const DeviceDesktopIcon = createIcon(
  <g stroke="currentColor">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-16a1 1 0 0 1-1-1v-10zM7 20h10M9 16v4M15 16v4" />
  </g>,
  { ...tablerIconProps, strokeWidth: 1.5 },
);

// login
export const loginIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M15 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" />
    <path d="M21 12h-13l3 -3" />
    <path d="M11 15l-3 -3" />
  </g>,
  tablerIconProps,
);

export const youtubeIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M2 8a4 4 0 0 1 4 -4h12a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-12a4 4 0 0 1 -4 -4v-8z" />
    <path d="M10 9l5 3l-5 3z" />
  </g>,
  tablerIconProps,
);

export const gridIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 6h18" />
    <path d="M3 12h18" />
    <path d="M3 18h18" />
    <path d="M6 3v18" />
    <path d="M12 3v18" />
    <path d="M18 3v18" />
  </g>,
  tablerIconProps,
);

export const lineEditorIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M17 3m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" />
    <path d="M3 17m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" />
    <path d="M17 5c-6.627 0 -12 5.373 -12 12" />
  </g>,
  tablerIconProps,
);

// arrow-up-right (modified)
export const sharpArrowIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 18l12 -12" />
    <path d="M18 10v-4h-4" />
  </g>,
  tablerIconProps,
);

// arrow-guide (modified)
export const elbowArrowIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4,19L10,19C11.097,19 12,18.097 12,17L12,9C12,7.903 12.903,7 14,7L21,7" />
    <path d="M18 4l3 3l-3 3" />
  </g>,
  tablerIconProps,
);

// arrow-ramp-right-2 (heavily modified)
export const roundArrowIcon = createIcon(
  <g>
    <path d="M16,12L20,9L16,6" />
    <path d="M6 20c0 -6.075 4.925 -11 11 -11h3" />
  </g>,
  tablerIconProps,
);

export const collapseDownIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 9l6 6l6 -6" />
  </g>,
  tablerIconProps,
);

export const collapseUpIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 15l6 -6l6 6" />
  </g>,
  tablerIconProps,
);

export const upIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 15l6 -6l6 6" />
  </g>,
  tablerIconProps,
);

export const cropIcon = createIcon(
  <g strokeWidth="1.25">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M8 5v10a1 1 0 0 0 1 1h10" />
    <path d="M5 8h10a1 1 0 0 1 1 1v10" />
  </g>,
  tablerIconProps,
);

export const elementLinkIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M5 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M19 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M5 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M19 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M5 7l0 10" />
    <path d="M7 5l10 0" />
    <path d="M7 19l10 0" />
    <path d="M19 7l0 10" />
  </g>,
  tablerIconProps,
);

