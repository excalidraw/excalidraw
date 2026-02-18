//
// All icons are imported from https://fontawesome.com/icons?d=gallery
// Icons are under the license https://fontawesome.com/license
//

// Note: when adding new icons, review https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/RTL_Guidelines
// to determine whether or not the icons should be mirrored in right-to-left languages.

import clsx from "clsx";
import React from "react";

import { THEME } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

export const iconFillColor = (theme: Theme) => "var(--icon-fill-color)";

const handlerColor = (theme: Theme) =>
  theme === THEME.LIGHT ? "#fff" : "#1e1e1e";

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

// tabler-icons: dots-horizontal (horizontal equivalent of dots-vertical)
export const DotsHorizontalIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
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

export const polygonIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M19 8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M5 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M15 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M6.5 9.5l3.5 -3" />
    <path d="M14 5.5l3 1.5" />
    <path d="M18.5 10l-2.5 7" />
    <path d="M13.5 17.5l-7 -5" />
  </g>,
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

export const LockedIconFilled = createIcon(
  <g fill="currentColor">
    <path d="M12 2a5 5 0 0 1 5 5v3a3 3 0 0 1 3 3v6a3 3 0 0 1 -3 3h-10a3 3 0 0 1 -3 -3v-6a3 3 0 0 1 3 -3v-3a5 5 0 0 1 5 -5m0 12a2 2 0 0 0 -1.995 1.85l-.005 .15a2 2 0 1 0 2 -2m0 -10a3 3 0 0 0 -3 3v3h6v-3a3 3 0 0 0 -3 -3" />
  </g>,
  {
    width: 24,
    height: 24,
  },
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
      d="M39.9 32.889a.326.326 0 0 0-.279-.056c-2.094-3.083-4.774-6-7.343-8.833l-.419-.472a.212.212 0 0 0-.056-.139.586.586 0 0 0-.167-.111l-.084-.083-.056-.056c-.084-.167-.28-.278-.475-.167-.782.39-1.507.973-2.206 1.528-.92.722-1.842 1.445-2.708 2.25a8.405 8.405 0 0 0-.977 1.028c-.14.194-.028.361.14.444-.615.611-1.23 1.223-1.843 1.861a.315.315 0 0 0-.084.223c0 .083.056.166.111.194l1.09.833v.028c1.535 1.528 4.244 3.611 7.12 5.861.418.334.865.667 1.284 1 .195.223.39.473.558.695.084.11.28.139.391.055.056.056.14.111.196.167a.398.398 0 0 0 .167.056.255.255 0 0 0 .224-.111.394.394 0 0 0 .055-.167c.029 0 .028.028.056.028a.318.318 0 0 0 .224-.084l5.082-5.528a.309.309 0 0 0 0-.444Zm-14.63-1.917a.485.485 0 0 0 .111.14c.586.5 1.2 1 1.843 1.555l-2.569-1.945-.251-.166c-.056-.028-.112-.084-.168-.111l-.195-.167.056-.056.055-.055.112-.111c.866-.861 2.346-2.306 3.1-3.028-.81.805-2.43 3.167-2.095 3.944Zm8.767 6.89-2.122-1.612a44.713 44.713 0 0 0-2.625-2.5c1.145.861 2.122 1.611 2.262 1.75 1.117.972 1.06.806 1.815 1.445l.921.666a1.06 1.06 0 0 1-.251.25Zm.558.416-.056-.028c.084-.055.168-.111.252-.194l-.196.222ZM1.089 5.75c.055.361.14.722.195 1.056.335 1.833.67 3.5 1.284 4.75l.252.944c.084.361.223.806.363.917 1.424 1.25 3.602 3.11 5.947 4.889a.295.295 0 0 0 .363 0s0 .027.028.027a.254.254 0 0 0 .196.084.318.318 0 0 0 .223-.084c2.988-3.305 5.221-6.027 6.813-8.305.112-.111.14-.278.14-.417.111-.111.195-.25.307-.333.111-.111.111-.306 0-.39l-.028-.027c0-.055-.028-.139-.084-.167-.698-.666-1.2-1.138-1.731-1.638-.922-.862-1.871-1.75-3.881-3.75l-.028-.028c-.028-.028-.056-.056-.112-.056-.558-.194-1.703-.389-3.127-.639C6.087 2.223 3.21 1.723.614.944c0 0-.168 0-.196.028l-.083.084c-.028.027-.056.055-.224.11h.056-.056c.028.167.028.278.084.473 0 .055.112.5.112.555l.782 3.556Zm15.496 3.278-.335-.334c.084.112.196.195.335.334Zm-3.546 4.666-.056.056c0-.028.028-.056.056-.056Zm-2.038-10c.168.167.866.834 1.033.973-.726-.334-2.54-1.167-3.379-1.445.838.167 1.983.334 2.346.472ZM1.424 2.306c.419.722.754 3.222 1.089 5.666-.196-.778-.335-1.555-.503-2.278-.251-1.277-.503-2.416-.838-3.416.056 0 .14 0 .252.028Zm-.168-.584c-.112 0-.223-.028-.307-.028 0-.027 0-.055-.028-.055.14 0 .223.028.335.083Zm-1.089.222c0-.027 0-.027 0 0ZM39.453 1.333c.028-.11-.558-.61-.363-.639.42-.027.42-.666 0-.666-.558.028-1.144.166-1.675.25-.977.194-1.982.389-2.96.61-2.205.473-4.383.973-6.561 1.557-.67.194-1.424.333-2.066.666-.224.111-.196.333-.084.472-.056.028-.084.028-.14.056-.195.028-.363.056-.558.083-.168.028-.252.167-.224.334 0 .027.028.083.028.11-1.173 1.556-2.485 3.195-3.909 4.945-1.396 1.611-2.876 3.306-4.356 5.056-4.719 5.5-10.052 11.75-15.943 17.25a.268.268 0 0 0 0 .389c.028.027.056.055.084.055-.084.084-.168.14-.252.222-.056.056-.084.111-.084.167a.605.605 0 0 0-.111.139c-.112.111-.112.305.028.389.111.11.307.11.39-.028.029-.028.029-.056.056-.056a.44.44 0 0 1 .615 0c.335.362.67.723.977 1.028l-.698-.583c-.112-.111-.307-.083-.39.028-.113.11-.085.305.027.389l7.427 6.194c.056.056.112.056.196.056s.14-.028.195-.084l.168-.166c.028.027.083.027.111.027.084 0 .14-.027.196-.083 10.052-10.055 18.15-17.639 27.42-24.417.083-.055.111-.166.111-.25.112 0 .196-.083.251-.194 1.704-5.194 2.039-9.806 2.15-12.083v-.028c0-.028.028-.056.028-.083.028-.056.028-.084.028-.084a1.626 1.626 0 0 0-.111-1.028ZM21.472 9.5c.446-.5.893-1.028 1.34-1.5-2.876 3.778-7.65 9.583-14.408 16.5 4.607-5.083 9.242-10.333 13.068-15ZM5.193 35.778h.084-.084Zm3.462 3.194c-.027-.028-.027-.028 0-.028v.028Zm4.16-3.583c.224-.25.448-.472.699-.722 0 0 0 .027.028.027-.252.223-.475.445-.726.695Zm1.146-1.111c.14-.14.279-.334.446-.5l.028-.028c1.648-1.694 3.351-3.389 5.082-5.111l.028-.028c.419-.333.921-.694 1.368-1.028a379.003 379.003 0 0 0-6.952 6.695ZM24.794 6.472c-.921 1.195-1.954 2.778-2.82 4.028-2.736 3.944-11.532 13.583-11.727 13.75a1976.983 1976.983 0 0 1-8.042 7.639l-.167.167c-.14-.167-.14-.417.028-.556C14.49 19.861 22.03 10.167 25.074 5.917c-.084.194-.14.36-.28.555Zm4.83 5.695c-1.116-.64-1.646-1.64-1.34-2.611l.084-.334c.028-.083.084-.194.14-.277.307-.5.754-.917 1.257-1.167.027 0 .055 0 .083-.028-.028-.056-.028-.139-.028-.222.028-.167.14-.278.335-.278.335 0 1.369.306 1.76.639.111.083.223.194.335.305.14.167.363.445.474.667.056.028.112.306.196.445.056.222.111.472.084.694-.028.028 0 .194-.028.194a2.668 2.668 0 0 1-.363 1.028c-.028.028-.028.056-.056.084l-.028.027c-.14.223-.335.417-.53.556-.643.444-1.369.583-2.095.389 0 0-.195-.084-.28-.111Zm8.154-.834a39.098 39.098 0 0 1-.893 3.167c0 .028-.028.083 0 .111-.056 0-.084.028-.14.056-2.206 1.61-4.356 3.305-6.506 5.028 1.843-1.64 3.686-3.306 5.613-4.945.558-.5.949-1.139 1.06-1.861l.28-1.667v-.055c.14-.334.67-.195.586.166Z"
      fill="currentColor"
    />
  </g>,
  { width: 40, height: 40, fill: "none" },
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

export const TextSizeIcon = createIcon(
  <g stroke="currentColor" strokeWidth="1.5">
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

export const ArrowheadNoneIcon = React.memo(
  ({ flip = false }: { flip?: boolean }) =>
    createIcon(
      <g
        transform={flip ? "translate(24, 0) scale(-1, 1)" : ""}
        stroke="currentColor"
        opacity={0.3}
        strokeWidth={2}
      >
        <path d="M12 12l-9 0" />
        <path d="M21 9l-6 6" />
        <path d="M21 15l-6 -6" />
      </g>,
      tablerIconProps,
    ),
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

export const codeIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M7 8l-4 4l4 4" />
    <path d="M17 8l4 4l-4 4" />
    <path d="M14 4l-4 16" />
  </g>,
  tablerIconProps,
);

export const FontFamilyCodeIcon = codeIcon;

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

export const santaHatIcon = createIcon(


  <>
    <g filter="url(#filter0_i_427_48)">
      <path
        fill="#FB0C0C"
        d="M41.42 35.106a2 2 0 0 1-.238-1.215l.619-5.108-1.227 19.107c-.099 1.535-1.82 2.389-3.102 1.539L9.64 30.966a2 2 0 0 1 .045-3.362l19.644-12.286s7.99-3.582 11.347-1.294c4.375 2.98 6.574 16.791 7.575 26.047.228 2.106-2.44 2.907-3.472 1.056z"
      ></path>
    </g>
    <g
      clipPath="url(#paint0_angular_427_48_clip_path)"
      data-figma-skip-parse="true"
    ></g>
    <path
      d="M31.04 45.642h.006l-.004-.003zm6.009 3.832-.005.015.204-.005.006-.015zm.2.01-.205.005.005-.015.205-.005zM15.566 23.41a.94.94 0 0 1 .662-.419l.206-.027.188-.03.104-.156.115-.167q.134-.198.289-.371l.128-.145.132-.142.16-.142a.97.97 0 0 1 .57-.166l.446.005c.056 0 .076-.01.079-.013l.305-.22a.5.5 0 0 0 .124-.137l.107-.183.11-.18a1.2 1.2 0 0 1 .466-.455l.331-.174q.205-.11.428-.185l.185-.06.182-.062a.35.35 0 0 0 .136-.079l.279-.265c.182-.171.405-.263.644-.285l.21-.02.16-.015.079-.14.104-.185c.117-.209.29-.38.523-.478l.174-.072.177-.075q.196-.08.401-.146l.183-.057.185-.06a.12.12 0 0 0 .064-.046l.12-.16.123-.157.134-.146a1 1 0 0 1 .523-.23l.203-.024.206-.027a.2.2 0 0 0 .097-.04l.15-.12.145-.12a.6.6 0 0 0 .133-.165l.107-.182.105-.188a.89.89 0 0 1 .7-.454l.207-.022.208-.017a.2.2 0 0 0 .11-.04l.15-.111.154-.113q.189-.14.4-.242l.166-.081.169-.085a1.5 1.5 0 0 0 .241-.145l.147-.109.15-.112c.185-.139.402-.21.629-.22l.196-.006.127-.009.117-.175.123-.2a.83.83 0 0 1 .386-.335.8.8 0 0 1 .517-.022l.218.06.223.059h.014l.144-.083.163-.098q.254-.152.545-.192l.187-.02.187-.027q.144-.02.28-.063l.178-.055.18-.06q.159-.05.318-.112l.348-.143q.208-.083.423-.137l.182-.048.183-.043q.197-.05.397-.088l.182-.034.187-.035c.21-.04.419-.023.62.04l.195.06.19.06c.079.025.148.031.206.029l.181-.006.181-.011q.2-.01.4-.002l.184.004.181.003a.4.4 0 0 0 .179-.036l.195-.081.198-.08c.2-.08.415-.111.633-.086l.386.04.207.049a.97.97 0 0 1 .465.36l.127.182.126.177c.04.057.07.072.08.077l.17.07.167.073q.217.092.412.227l.155.112.154.107c.183.129.317.3.401.505l.146.36q.031.074.087.123l.282.253q.156.14.302.294l.265.279q.141.147.278.301l.257.292c.166.19.248.419.258.664l.008.207.01.203q.007.161.04.294l.042.183.046.185c.027.109.053.216.088.32l.06.177.057.178a4 4 0 0 0 .12.305l.149.342q.038.09.123.189l.134.15.138.153c.159.178.256.395.276.637l.013.192.017.194q.014.187.03.371l.038.382q.017.175.045.348l.03.189.028.183.005.007a.2.2 0 0 0 .033.042l.16.148.163.15a.98.98 0 0 1 .3.508l.02.21-.006.193-.003.195a.6.6 0 0 0 .033.205l.061.177.059.18q.045.128.12.257l.099.169.102.17c.126.216.17.457.13.701l-.033.199-.03.2a1 1 0 0 0-.013.268l.031.377a.5.5 0 0 0 .053.175l.088.17.09.177q.137.27.149.573l.007.188.005.19q.008.226-.016.454l-.02.193-.017.195v.009l.012.023.113.168.117.171c.108.16.188.333.232.52l.085.366c.05.212.037.426-.021.632l-.058.2-.042.156.104.14.133.167c.13.168.201.365.2.574l-.024.213-.094.397c-.006.026-.002.037.004.05l.08.175.079.179c.093.203.127.42.099.642l-.026.194-.023.19a.12.12 0 0 0 .015.077l.095.175.09.176q.141.269.158.574l.01.19.007.187q.01.212-.001.426l-.019.381a.6.6 0 0 0 .024.204l.057.183.051.184q.05.157.115.315l.146.36c.087.212.106.44.061.663l-.037.191-.04.194q-.03.155-.035.3l-.01.19-.003.19a2.4 2.4 0 0 1-.059.463l-.081.35a2.2 2.2 0 0 1-.136.416l-.067.143-.063.145a4 4 0 0 1-.177.337l-.081.144-.087.144a.86.86 0 0 1-.58.416l-.165.036-.504.102-.17.032-.166.03c-.206.04-.411.023-.605-.049l-.165-.062-.167-.06a1 1 0 0 1-.512-.428l-.093-.15-.09-.154a.7.7 0 0 0-.14-.164l-.147-.125-.147-.13a1.7 1.7 0 0 1-.347-.418l-.189-.322q-.098-.165-.191-.334l-.09-.162-.092-.165a2 2 0 0 1-.188-.466l-.049-.187-.047-.177-.013-.008-.367-.225a.84.84 0 0 1-.326-.348.87.87 0 0 1-.08-.46l.02-.227.011-.166-.102-.072-.174-.12c-.033-.023-.06-.054-.092-.08q.002.045.002.09l-.013.189-.01.185a3 3 0 0 0 0 .324l.01.184.01.19a1.08 1.08 0 0 1-.206.684l-.127.178-.091.122.058.132.087.194a1 1 0 0 1 .037.742l-.122.369a.2.2 0 0 0-.008.103l.044.188.045.194q.07.312-.018.62l-.053.186-.05.182a.4.4 0 0 0-.01.172l.026.186.027.192q.033.239.016.478l-.013.189-.01.185a1.18 1.18 0 0 1-.255.638l-.138.18-.087.11.052.12.092.192a1 1 0 0 1 .087.569l-.05.196-.07.183-.065.183a3 3 0 0 0-.1.313l-.044.186-.047.185.012.031.101.194.1.197c.109.215.154.454.11.702l-.034.192-.031.195q-.048.267-.17.511l-.087.181-.093.183a1.12 1.12 0 0 1-.474.496l-.351.19a1.4 1.4 0 0 0-.247.173l-.16.137-.157.136a.84.84 0 0 1-.846.16l-.2-.067-.197-.07a9 9 0 0 0-.36-.116l-.359-.108a2 2 0 0 1-.176-.06c-.022-.008-.062-.021-.102-.044a.6.6 0 0 1-.1-.076l-.183-.056-.186-.058a1.07 1.07 0 0 1-.568-.409l-.117-.162-.115-.166a.1.1 0 0 0-.058-.047l-.364-.13a1 1 0 0 1-.558-.487l-.1-.188-.098-.191c-.023-.044-.042-.053-.048-.056l-.171-.08-.17-.085a1 1 0 0 0-.25-.081l-.197-.042-.2-.039a1.07 1.07 0 0 1-.603-.348l-.256-.292a.2.2 0 0 0-.085-.056l-.373-.117a1.6 1.6 0 0 1-.497-.254l-.147-.117-.15-.113a2.3 2.3 0 0 1-.348-.338l-.126-.15-.118-.14-.005.002-.215-.016-.212-.019a.87.87 0 0 1-.718-.48l-.098-.192-.07-.135-.145-.013-.215-.015a.9.9 0 0 1-.707-.432l-.218-.35c-.018-.03-.03-.037-.039-.04l-.18-.069-.178-.07a1.6 1.6 0 0 1-.47-.28l-.287-.247a2 2 0 0 0-.238-.171l-.16-.097-.159-.1a2.4 2.4 0 0 1-.38-.29l-.14-.127-.14-.13a1.4 1.4 0 0 0-.217-.167l-.321-.194a.5.5 0 0 0-.182-.065l-.408-.064a1.02 1.02 0 0 1-.629-.351l-.128-.146-.126-.15a1 1 0 0 0-.188-.176l-.154-.107-.152-.11a2 2 0 0 0-.264-.16l-.334-.175a1.2 1.2 0 0 1-.465-.436l-.111-.172-.079-.122-.174.001-.223-.002a.82.82 0 0 1-.476-.152.85.85 0 0 1-.29-.398l-.08-.218-.037-.1-.098.006-.23.008a.87.87 0 0 1-.77-.38l-.115-.166-.1-.151-.195-.026-.206-.028a.87.87 0 0 1-.686-.507l-.093-.198-.06-.129-.136-.006-.22-.01a.98.98 0 0 1-.696-.32l-.256-.292a2 2 0 0 0-.22-.212l-.144-.123-.145-.12a.6.6 0 0 0-.173-.1l-.364-.13a1.16 1.16 0 0 1-.534-.382l-.122-.156-.12-.159a2 2 0 0 0-.209-.228l-.137-.133-.139-.13a.2.2 0 0 0-.094-.048l-.394-.084a1.4 1.4 0 0 1-.546-.244l-.3-.227a6 6 0 0 0-.282-.197l-.154-.107-.156-.103a1.4 1.4 0 0 1-.414-.43l-.108-.175-.088-.137-.174-.013-.215-.015a.9.9 0 0 1-.705-.435l-.108-.176-.107-.178a.26.26 0 0 0-.096-.096l-.325-.188a.34.34 0 0 0-.154-.037l-.438-.018a.83.83 0 0 1-.46-.155.83.83 0 0 1-.281-.388l-.078-.207-.077-.21a2 2 0 0 0-.118-.266l-.17-.282a1.6 1.6 0 0 1-.177-.44l-.034-.154-.035-.16a3 3 0 0 0-.085-.295l-.065-.184-.06-.185a1 1 0 0 1 .023-.72l.075-.185.079-.182a.93.93 0 0 1 .561-.528l.379-.133q.176-.063.337-.133l.174-.072.176-.075a.5.5 0 0 0 .152-.1l.135-.14.136-.136q.142-.14.285-.274l.137-.135.137-.13a1.3 1.3 0 0 1 .525-.303l.185-.06.175-.052.007-.01.205-.38a.87.87 0 0 1 .717-.466l.422-.03a.2.2 0 0 0 .101-.03l.153-.11.149-.113a3 3 0 0 0 .24-.206l.279-.265c.184-.177.412-.269.654-.288l.212-.014.18-.017zm.606.895a.9.9 0 0 1-.703.41l-.213.017-.208.017-.036.005-.008.004-.136.135-.14.132q-.159.155-.336.288l-.152.11-.15.112a1.2 1.2 0 0 1-.622.224l-.213.018-.15.008-.074.139-.103.19a.99.99 0 0 1-.582.49l-.373.109a.3.3 0 0 0-.123.073l-.28.265q-.132.128-.265.26l-.136.134-.139.138a1.5 1.5 0 0 1-.468.317l-.174.072-.177.076a7 7 0 0 1-.391.152l-.19.067-.169.056-.066.163-.078.182-.003.012.002-.003s-.003.004-.001.008l.065.184.063.188q.07.204.113.389l.035.159.037.156a.5.5 0 0 0 .062.153l.083.144.085.14q.112.194.197.432l.078.206.037.1.103.007.22.01c.212.009.42.061.608.17l.163.093.165.09c.188.109.334.264.445.446l.109.175.08.133.176.019.212.019.214.038a.9.9 0 0 1 .356.213l.139.172.217.35c.039.062.08.1.119.125l.156.104.154.107q.169.112.332.234l.3.227a.4.4 0 0 0 .15.063l.395.083c.216.046.411.147.574.301l.139.13.137.133q.167.158.311.343l.244.311c.023.03.047.045.076.055l.364.13q.266.091.48.271l.144.123.145.12q.172.147.324.318l.13.143.118.134q.004.002.011.003l.22.01.216.012.224.036a.8.8 0 0 1 .216.106q.105.07.18.16l.117.191.094.198.07.15.144.02.206.03a.94.94 0 0 1 .669.405l.113.17.075.105.185-.004.23-.006.244.026a.78.78 0 0 1 .438.295l.114.216.118.331.105.005.223.002.217.027q.215.05.382.202l.148.178.222.344c.031.048.061.072.088.087l.334.174q.197.104.377.231l.152.11.154.107q.204.147.368.343l.126.149.128.146.005.008.003.002.02.004.408.064q.291.044.544.197l.321.194q.204.125.38.29l.278.26q.103.094.22.163l.158.1.16.098q.196.12.37.269l.287.246q.077.065.176.103l.177.07.18.069c.23.088.412.246.537.45l.106.178.083.13.176.017.212.02.226.047a.84.84 0 0 1 .363.245l.128.188.098.191.069.13.15.015.212.02c.26.02.502.132.68.343l.253.299q.093.11.196.19l.15.114.148.117q.075.058.179.09l.373.117c.213.065.398.183.544.352l.257.292c.01.01.018.02.047.026l.2.04.197.04q.256.05.49.161l.168.084.172.081c.22.108.381.283.49.49l.2.376c.005.009.013.011.015.014l.177.066.182.065c.222.078.405.22.54.409l.114.166.118.162c.015.021.024.026.04.031l.186.058.19.055c.065.02.128.043.178.062a1 1 0 0 1 .1.048l.098.07.172.053.18.053q.193.059.4.13l.198.07.124.04.102-.082.157-.14q.198-.166.421-.287l.178-.098.175-.095a.12.12 0 0 0 .053-.059l.093-.182.09-.184a1 1 0 0 0 .08-.242l.068-.386c.002-.01.002-.03-.02-.074l-.099-.192-.099-.197a1.03 1.03 0 0 1-.093-.728l.044-.186.047-.184q.053-.214.131-.424l.068-.18.063-.174-.09-.196-.092-.192a.84.84 0 0 1 .102-.889l.276-.36c.043-.057.048-.087.049-.095l.01-.185.013-.189q.009-.134-.01-.274l-.025-.19-.03-.188a1.4 1.4 0 0 1 .04-.583l.056-.183.05-.182a.26.26 0 0 0 .002-.13l-.043-.188-.042-.192c-.05-.217-.04-.438.032-.65l.061-.183.063-.18q0-.004-.004-.015l-.174-.388a.86.86 0 0 1 .09-.864l.124-.18.128-.178a.2.2 0 0 0 .025-.044v-.009l-.02-.38a4 4 0 0 1 0-.43l.013-.189.01-.185a.7.7 0 0 0-.024-.218l-.05-.193-.053-.189a1.2 1.2 0 0 1 0-.642l.05-.183.053-.185a1.5 1.5 0 0 0 .048-.277l.01-.186.013-.174-.014-.085q-.029-.173-.061-.331l-.04-.167-.034-.168a2.6 2.6 0 0 1-.058-.441l-.005-.191-.01-.19c-.008-.196.027-.39.098-.572l.071-.178.07-.183a.2.2 0 0 0 .01-.106l-.031-.194-.033-.19c-.04-.243.002-.48.117-.692l.069-.133.042-.098a.35.35 0 0 0 .03-.153l-.01-.19-.006-.187a8 8 0 0 0-.027-.355l-.02-.191-.015-.189q-.027-.3.074-.584l.064-.182.019-.049.054-.16.02-.058q.005-.007.006-.01l.004-.011v-.009q.003-.002.007-.01l.005-.015.02-.038a1 1 0 0 1 .063-.085c.088-.078.52-.148.787.049.06.119.085.288.083.327l-.006.052-.008.032-.01.036-.005.015.002-.009q.002 0-.021.067l-.058.158-.002.003-.055.16a.3.3 0 0 0-.013.133l.022.193.021.187c.014.13.027.265.038.395l.016.189.018.19c.02.23-.031.45-.139.649l-.096.18-.02.043-.062.137.1.183.11.194a.86.86 0 0 1-.001.863l-.104.184-.101.181q-.004.007-.007.01l.042.192.047.19q.062.274.027.553l-.024.185-.021.188q-.017.123-.029.248l.026.144q.032.185.064.384l.034.196.032.2c.01.054.03.092.053.124l.23.303a.8.8 0 0 0 .172.165l.17.118.169.12c.205.145.32.347.354.569l.007.23-.019.226-.014.135.106.066.183.113c.165.1.3.237.388.411l.072.189.051.184.05.187q.032.128.092.235l.093.164.089.163.183.318.092.164.095.162q.05.088.137.166l.15.127.145.13c.134.116.252.249.343.4l.09.154.093.15.003.002.165.063.168.065q.04.013.066.006l.168-.034.166-.03.33-.068.164-.036.114-.023.054-.095.086-.145q.071-.122.123-.241l.07-.147.063-.145q.043-.093.073-.224l.04-.18.04-.174a1.4 1.4 0 0 0 .036-.272l.007-.187.004-.19q.008-.233.055-.465l.08-.388a.14.14 0 0 0-.01-.086l-.146-.359a5 5 0 0 1-.147-.407l-.051-.184-.054-.18a1.6 1.6 0 0 1-.067-.542l.019-.382a4 4 0 0 0 0-.332l-.007-.188-.01-.19a.4.4 0 0 0-.043-.154l-.091-.173-.093-.179a1.1 1.1 0 0 1-.12-.666l.023-.19.026-.195a.17.17 0 0 0-.015-.098l-.084-.178-.08-.175a1.07 1.07 0 0 1-.066-.7l.083-.357-.115-.152-.13-.17a.9.9 0 0 1-.159-.809l.058-.2.053-.2a.25.25 0 0 0 .007-.13l-.085-.367a.6.6 0 0 0-.083-.186l-.116-.17-.113-.17a1.04 1.04 0 0 1-.18-.696l.04-.385a2 2 0 0 0 .009-.318l-.005-.19-.007-.188a.4.4 0 0 0-.043-.155l-.086-.174-.091-.173a1.5 1.5 0 0 1-.156-.55l-.018-.184-.015-.189a2 2 0 0 1 .023-.51l.03-.2.033-.198.001-.023-.008-.015-.198-.337a2.4 2.4 0 0 1-.205-.44l-.06-.18-.06-.177a1.6 1.6 0 0 1-.085-.544v-.191l.003-.173-.159-.142-.163-.15a1.08 1.08 0 0 1-.344-.627l-.026-.186-.03-.189a8 8 0 0 1-.053-.4l-.037-.382q-.02-.195-.035-.393l-.013-.192-.017-.194c-.001-.012-.004-.025-.024-.048l-.135-.15-.137-.153a1.7 1.7 0 0 1-.293-.457l-.148-.342a5 5 0 0 1-.15-.39l-.06-.176-.056-.177a5 5 0 0 1-.118-.402l-.043-.183-.046-.185a2.5 2.5 0 0 1-.065-.489l-.008-.207-.005-.204q-.002-.022-.005-.027c-.001-.002-.003-.01-.009-.015l-.256-.292a10 10 0 0 0-.25-.274l-.265-.279a4 4 0 0 0-.245-.238l-.283-.252a1.3 1.3 0 0 1-.341-.49l-.075-.176-.073-.18a.14.14 0 0 0-.053-.068l-.154-.107-.153-.11a1.3 1.3 0 0 0-.228-.128l-.339-.14a1.2 1.2 0 0 1-.505-.42l-.123-.18-.127-.177-.166-.017-.193-.02a.3.3 0 0 0-.145.02l-.198.08-.195.082a1.4 1.4 0 0 1-.579.108l-.18-.003-.185-.004a5 5 0 0 0-.326.004l-.182.005-.184.01a1.6 1.6 0 0 1-.547-.073l-.193-.062-.195-.06a.3.3 0 0 0-.136-.014l-.184.037-.185.032a6 6 0 0 0-.337.076l-.182.049-.183.042q-.148.04-.29.098l-.177.07-.175.072q-.192.079-.388.14l-.178.056-.18.06a2.6 2.6 0 0 1-.45.099l-.19.024-.187.021a.4.4 0 0 0-.16.058l-.327.196a.98.98 0 0 1-.773.091l-.22-.056-.082-.026-.053.086-.128.201c-.152.243-.395.43-.725.443l-.198.009-.202.007a.1.1 0 0 0-.066.022l-.149.112-.147.108a2.5 2.5 0 0 1-.401.245l-.167.082-.172.082a1.6 1.6 0 0 0-.24.15l-.153.11-.149.112a1.2 1.2 0 0 1-.61.228l-.207.022-.162.01-.08.149-.105.188q-.145.257-.37.444l-.148.117-.145.12a1.2 1.2 0 0 1-.602.256l-.205.028-.204.024-.118.157-.123.157a1.1 1.1 0 0 1-.55.385l-.37.12a4 4 0 0 0-.318.118l-.174.072-.176.075c-.004 0-.017.005-.037.04l-.104.185-.106.188a.88.88 0 0 1-.704.461l-.208.017-.213.018c-.037.003-.045.012-.048.015l-.279.265q-.219.207-.505.302l-.185.06-.182.062q-.145.048-.273.115l-.165.087-.165.092a.2.2 0 0 0-.082.082l-.107.182-.11.18a1.45 1.45 0 0 1-.399.439l-.305.22a1.1 1.1 0 0 1-.672.2l-.223-.003-.221-.006-.239.269q-.105.117-.2.26l-.119.17-.112.17a.95.95 0 0 1-.663.413l-.202.03-.185.023z"
      data-figma-gradient-fill='{"type":"GRADIENT_ANGULAR","stops":[{"color":{"r":1.0,"g":0.0,"b":0.0,"a":1.0},"position":0.0},{"color":{"r":0.95686274766921997,"g":0.35686275362968445,"b":0.35686275362968445,"a":1.0},"position":0.17778991162776947},{"color":{"r":0.96078431606292725,"g":0.37254902720451355,"b":0.37254902720451355,"a":1.0},"position":0.29515397548675537},{"color":{"r":0.96078431606292725,"g":0.37647059559822083,"b":0.37647059559822083,"a":1.0},"position":0.36225455999374390},{"color":{"r":0.96470588445663452,"g":0.40392157435417175,"b":0.40392157435417175,"a":1.0},"position":0.38157993555068970},{"color":{"r":0.98039215803146362,"g":0.51372551918029785,"b":0.51372551918029785,"a":1.0},"position":0.41900688409805298},{"color":{"r":0.97254902124404907,"g":0.47450980544090271,"b":0.47450980544090271,"a":1.0},"position":0.44273108243942261},{"color":{"r":0.95686274766921997,"g":0.31764706969261169,"b":0.31764706969261169,"a":1.0},"position":0.50315368175506592},{"color":{"r":0.98431372642517090,"g":0.058823529630899429,"b":0.058823529630899429,"a":1.0},"position":0.52921301126480103},{"color":{"r":0.98431372642517090,"g":0.054901961237192154,"b":0.054901961237192154,"a":1.0},"position":0.74996215105056763},{"color":{"r":0.60000002384185791,"g":0.0,"b":0.0,"a":1.0},"position":1.0}],"stopsVar":[{"color":{"r":1.0,"g":0.0,"b":0.0,"a":1.0},"position":0.0},{"color":{"r":0.95686274766921997,"g":0.35686275362968445,"b":0.35686275362968445,"a":1.0},"position":0.17778991162776947},{"color":{"r":0.96078431606292725,"g":0.37254902720451355,"b":0.37254902720451355,"a":1.0},"position":0.29515397548675537},{"color":{"r":0.96078431606292725,"g":0.37647059559822083,"b":0.37647059559822083,"a":1.0},"position":0.36225455999374390},{"color":{"r":0.96470588445663452,"g":0.40392157435417175,"b":0.40392157435417175,"a":1.0},"position":0.38157993555068970},{"color":{"r":0.98039215803146362,"g":0.51372551918029785,"b":0.51372551918029785,"a":1.0},"position":0.41900688409805298},{"color":{"r":0.97254902124404907,"g":0.47450980544090271,"b":0.47450980544090271,"a":1.0},"position":0.44273108243942261},{"color":{"r":0.95686274766921997,"g":0.31764706969261169,"b":0.31764706969261169,"a":1.0},"position":0.50315368175506592},{"color":{"r":0.98431372642517090,"g":0.058823529630899429,"b":0.058823529630899429,"a":1.0},"position":0.52921301126480103},{"color":{"r":0.98431372642517090,"g":0.054901961237192154,"b":0.054901961237192154,"a":1.0},"position":0.74996215105056763},{"color":{"r":0.60000002384185791,"g":0.0,"b":0.0,"a":1.0},"position":1.0}],"transform":{"m00":-17.288373947143555,"m01":-38.054580688476562,"m02":62.395534515380859,"m10":26.062871932983398,"m11":-25.242876052856445,"m12":28.430376052856445},"opacity":1.0,"blendMode":"NORMAL","visible":true}'
    ></path>
    <g filter="url(#filter1_f_427_48)">
      <path
        fill="#830000"
        d="m46.914 29.983.54 2.82.385 3.186.482 1.93.173 2.666-1.903 4.015-2.115-3.724-1.165-15.173-1.452-10.38 3.512 10.12 1.063 1.577-.369.876z"
      ></path>
    </g>
    <g filter="url(#filter2_i_427_48)">
      <circle
        cx="48.171"
        cy="44.43"
        r="3.981"
        fill="#fff"
        transform="rotate(22.852 48.17 44.43)"
      ></circle>
    </g>
    <path
      fill="#000"
      d="M49.688 40.456c.322.068.598.236.805.492l.202.246.203.252c.088.108.21.211.377.302l.328.177.324.178c.322.176.555.443.68.788l.127.345.123.34c.14.385.086.772-.133 1.11l-.206.32-.209.324a1 1 0 0 0-.083.147l.019.076.04.148a.7.7 0 0 1-.1.56 1.3 1.3 0 0 1-.304.316l-.267.21-.265.207a8 8 0 0 0-.46.39l-.227.206-.223.207a2.1 2.1 0 0 1-.675.415l-.294.113-.289.112a27 27 0 0 1-.641.234l-.678.24a1.04 1.04 0 0 1-.605.038 1.07 1.07 0 0 1-.516-.315l-.25-.271-.252-.267a2.3 2.3 0 0 0-.42-.364l-.518-.337a1.9 1.9 0 0 1-.58-.596l-.171-.267-.166-.27a26 26 0 0 1-.365-.594l-.181-.314-.187-.312a1.1 1.1 0 0 1-.158-.58 1.1 1.1 0 0 1 .182-.571l.202-.31.197-.306q.16-.249.22-.492l.083-.326.08-.33a1.96 1.96 0 0 1 .417-.8l.231-.267.228-.269c.237-.277.553-.438.916-.474l.351-.039.355-.037q.384-.037.74-.027l.322.013.317.01q.364.011.723.085l.316.065zm-.205.978-.316-.065-.314-.07a3 3 0 0 0-.549-.065l-.319-.007-.321-.013a5 5 0 0 0-.608.024l-.354.037-.354.033a.36.36 0 0 0-.255.134l-.228.269-.231.267a.96.96 0 0 0-.208.392l-.08.33-.083.33c-.07.275-.189.538-.349.785l-.397.621a.2.2 0 0 0-.022.042l-.003.007v.009a.2.2 0 0 0 .02.037l.184.316.187.311q.182.309.348.571l.167.27.17.27q.11.179.277.287l.263.17.26.169q.319.21.604.517l.25.271.249.266c.013.015.027.019.033.022.005 0 .015.003.026-.001l.678-.24q.332-.119.617-.228l.288-.111.293-.11q.202-.078.355-.22l.228-.208.223-.207q.24-.22.52-.438l.266-.21.268-.205.005-.01-.031-.129a.82.82 0 0 1 .035-.485c.046-.128.115-.26.195-.384l.207-.32.209-.323c.057-.09.06-.149.034-.223l-.127-.342-.126-.345a.44.44 0 0 0-.216-.252l-.328-.177-.325-.175a2.2 2.2 0 0 1-.678-.553l-.2-.25-.204-.25a.38.38 0 0 0-.233-.141"
    ></path>
    <g filter="url(#filter3_f_427_48)">
      <path fill="#571111" d="m38.813 26.791.05-.11 3.1 9.763-.572.181z"></path>
    </g>
    <g filter="url(#filter4_f_427_48)">
      <path
        fill="#571111"
        fillOpacity="0.89"
        d="m25.171 22.648.224.118-9.312 7.321-1.054-1.34z"
      ></path>
    </g>
    <g filter="url(#filter5_f_427_48)">
      <path
        fill="#571111"
        fillOpacity="0.77"
        d="m40.242 23.985.276-.064-7.165 17.442-1.577-.648z"
      ></path>
    </g>
    <g filter="url(#filter6_f_427_48)">
      <path
        fill="#FFA6A6"
        d="m30.95 15.33 2.974-.908 4.742-1.022 1.159 1.363-11.718 4.847-2.943.197 2.542-1.854z"
      ></path>
    </g>
    <g filter="url(#filter7_i_427_48)">
      <path
        fill="#fff"
        d="M7.73 35.989a5.73 5.73 0 0 1 6.259-9.601l25.9 16.884a5.73 5.73 0 1 1-6.259 9.601z"
      ></path>
    </g>
    <path
      fill="#000"
      d="m6.89 25.803.385-.476c.201-.251.475-.426.813-.454.319-.026.627.083.904.244l.676.394c.178.104.307.135.396.137a.37.37 0 0 0 .24-.081l.246-.185.248-.188c.223-.166.479-.283.76-.301.289-.02.555.07.788.223l.235.154.23.155c.206.136.465.204.808.177l.322-.029.322-.022c.294-.024.584.02.843.167.26.147.447.375.57.642l.13.285.134.283q.243.528.55.928l.172.224.17.218c.067.086.197.186.593.092l.374-.087.37-.09c.311-.073.632-.082.927.031.31.118.529.346.665.634l.132.282.132.277q.242.51.56.86l.184.203.18.202c.108.119.285.205.638.16l.346-.046.343-.046c.56-.074 1.088.02 1.502.363l.203.17.205.17c.354.295.618.689.803 1.158l.117.3.12.302q.221.562.517.967l.166.224.167.23c.094.129.24.219.568.18l.341-.044.342-.038c.302-.036.604-.004.876.137.276.145.47.378.595.654l.128.284.128.289c.05.112.107.158.152.182.048.027.133.053.287.039l.338-.032.332-.03c.538-.051 1.04.04 1.455.328l.219.152.217.146q.47.327.895.723l.195.179.197.184q.435.405.8.904l.17.227.163.228q.3.41.666.695l.21.165.209.16c.235.183.5.328.798.427l.261.086.258.084q.523.174 1.05.34l.26.08.264.084c.525.164.884.552 1.087 1.072l.233.6c.105.269.253.38.45.419l.285.056.284.058c.268.054.52.17.715.378s.294.467.325.738l.03.282.029.279c.028.26.137.485.34.688l.204.208.21.207c.343.344.575.759.694 1.231l.072.284.074.287a2 2 0 0 1-.18 1.463l-.137.26-.14.259a2.95 2.95 0 0 1-.909 1.035l-.233.165-.237.163a3.5 3.5 0 0 0-.697.64l-.323.396q-.313.383-.676.908l-.363.528c-.18.26-.444.471-.8.504-.333.03-.64-.104-.895-.285l-.618-.44c-.151-.108-.263-.14-.34-.143a.44.44 0 0 0-.272.094l-.278.191-.281.195c-.242.168-.522.286-.828.276a1.17 1.17 0 0 1-.797-.366l-.211-.212-.208-.21a22 22 0 0 0-.806-.768l-.196-.179-.197-.175a2.3 2.3 0 0 0-.754-.454l-.256-.093-.252-.094a4.5 4.5 0 0 0-1-.232l-.293-.037-.29-.035a1.63 1.63 0 0 1-1.265-.848l-.146-.263-.144-.258a1.54 1.54 0 0 0-.576-.604l-.228-.13-.233-.128q-.483-.276-.943-.586l-.44-.297a3.2 3.2 0 0 1-.903-.933l-.158-.244-.155-.24a.75.75 0 0 0-.556-.358l-.287-.038-.289-.044a1.9 1.9 0 0 1-1.256-.712l-.17-.218-.174-.22c-.12-.152-.295-.243-.597-.236l-.32.006-.32.01c-.3.008-.594-.06-.846-.233a1.44 1.44 0 0 1-.52-.703l-.111-.31-.116-.309c-.116-.312-.276-.454-.454-.52l-.251-.093-.255-.096q-.45-.168-.992-.223l-.294-.029-.297-.03a2.6 2.6 0 0 1-1.281-.467l-.211-.156-.216-.155c-.405-.294-.667-.737-.817-1.264l-.094-.336-.096-.339c-.105-.366-.262-.54-.423-.625l-.234-.12-.237-.122a3.8 3.8 0 0 0-.915-.335l-.273-.061-.275-.063a6.7 6.7 0 0 1-1.143-.372l-.245-.104-.246-.109c-.469-.202-.804-.572-1.018-1.056l-.129-.288-.125-.287c-.044-.1-.094-.135-.134-.153-.051-.023-.155-.046-.345-.015l-.373.065-.37.061c-.616.103-1.19-.007-1.626-.425l-.217-.212-.215-.205c-.41-.395-.583-.905-.534-1.477l.028-.322.026-.319q.057-.678.176-1.237l.057-.252.054-.254c.046-.211.018-.45-.129-.732l-.142-.275-.142-.27c-.133-.255-.205-.555-.117-.864.088-.306.306-.525.552-.675l.265-.163.266-.158.025-.016a.83.83 0 0 1-.166-.64c.027-.207.116-.412.223-.6l.137-.238.138-.24q.3-.527.712-1.043m.154 1.537-.138.241-.136.238q-.053.096-.077.16l-.008.027.025.026.092.102a.67.67 0 0 1 .18.433.7.7 0 0 1-.125.413c-.123.187-.322.335-.515.453l-.268.16-.263.16a.3.3 0 0 0-.112.095c-.001.007 0 .047.044.132l.142.27.139.272c.236.452.326.926.223 1.404l-.056.257-.054.254a9 9 0 0 0-.162 1.107l-.023.321-.028.322c-.025.298.055.504.23.672l.215.206.219.208c.148.141.37.226.762.16l.376-.062.371-.061c.315-.053.634-.042.922.088.298.134.508.372.636.662l.126.287.128.289c.13.294.302.454.498.539l.246.109.248.105q.456.197.97.316l.272.06.276.064q.616.141 1.153.42l.237.122.232.124c.476.247.77.693.924 1.236l.097.338.096.333c.108.382.268.605.442.731l.213.158.213.153c.21.152.468.25.79.282l.595.061q.658.066 1.24.281l.253.09.254.097c.51.188.849.59 1.042 1.113l.113.306.116.309c.05.135.106.197.15.228.042.03.117.06.251.057l.32-.01.32-.006c.563-.014 1.056.178 1.403.616l.176.217.173.22c.15.19.344.303.612.343l.29.04.29.044c.53.077.958.35 1.249.8l.159.244.155.24q.271.415.625.65l.217.147.22.148q.429.29.877.544l.231.132.228.13c.4.227.718.561.955.981l.145.258.147.26a.63.63 0 0 0 .514.348l.29.035.293.037q.645.079 1.22.288l.257.093.252.093c.403.148.767.365 1.082.65l.198.176.196.179q.411.373.845.807l.208.21.21.207c.071.071.108.073.12.074.022 0 .094-.007.227-.1l.558-.382c.263-.183.563-.289.887-.275.319.015.613.141.877.33l.309.22.306.217c.14.1.21.108.223.108a.3.3 0 0 0 .068-.076l.184-.267.185-.262q.377-.551.718-.973l.323-.396q.377-.458.901-.825l.467-.33q.375-.262.603-.688l.14-.259.136-.257c.128-.24.16-.484.093-.75l-.072-.285-.074-.286c-.076-.3-.221-.553-.436-.769l-.205-.208-.207-.205a2.12 2.12 0 0 1-.624-1.288l-.03-.276-.031-.282c-.012-.105-.04-.149-.058-.168s-.067-.06-.184-.083l-.286-.055-.28-.057c-.573-.115-.973-.49-1.186-1.034l-.234-.6c-.114-.293-.271-.426-.454-.483l-.26-.08-.263-.084a66 66 0 0 1-1.065-.34l-.26-.09-.257-.083a3.6 3.6 0 0 1-1.102-.584l-.42-.33q-.48-.377-.854-.892l-.17-.227-.166-.23a5.3 5.3 0 0 0-.671-.759l-.2-.18-.193-.183a7 7 0 0 0-.785-.633l-.215-.15-.22-.148c-.173-.12-.42-.19-.79-.156l-.338.032-.332.03c-.299.029-.6-.008-.865-.153a1.37 1.37 0 0 1-.584-.656l-.128-.284-.129-.289c-.05-.11-.102-.156-.144-.178-.047-.024-.136-.047-.294-.029l-.344.042-.34.04c-.594.071-1.137-.094-1.494-.582l-.169-.227-.164-.228a5.3 5.3 0 0 1-.64-1.187l-.24-.604c-.136-.346-.31-.591-.509-.756l-.202-.17-.206-.17c-.139-.116-.357-.19-.73-.14l-.345.044-.343.047c-.58.076-1.122-.053-1.51-.48l-.181-.202-.186-.201a4.5 4.5 0 0 1-.721-1.104l-.132-.277-.133-.283c-.043-.091-.085-.115-.117-.128-.046-.017-.15-.035-.343.01l-.37.09-.374.087c-.612.144-1.217.06-1.612-.454l-.171-.223-.17-.218a6 6 0 0 1-.672-1.123l-.127-.284-.133-.283c-.053-.115-.108-.167-.154-.193a.46.46 0 0 0-.271-.042l-.322.029-.324.026c-.528.042-1.02-.063-1.441-.343l-.23-.155-.233-.151c-.08-.053-.131-.06-.167-.058-.042.003-.115.021-.227.104l-.252.186-.246.184c-.25.188-.54.288-.855.282a1.83 1.83 0 0 1-.881-.271l-.676-.394c-.178-.104-.278-.117-.318-.114-.02.002-.056.01-.115.084l-.192.238-.195.241a7 7 0 0 0-.625.908"
    ></path>
    <defs>
      <filter
        id="filter0_i_427_48"
        width="42.702"
        height="39.872"
        x="8.316"
        y="12.77"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
        <feBlend
          in="SourceGraphic"
          in2="BackgroundImageFix"
          result="shape"
        ></feBlend>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset dx="5" dy="4"></feOffset>
        <feGaussianBlur stdDeviation="1.1"></feGaussianBlur>
        <feComposite
          in2="hardAlpha"
          k2="-1"
          k3="1"
          operator="arithmetic"
        ></feComposite>
        <feColorMatrix values="0 0 0 0 0.907692 0 0 0 0 0.823905 0 0 0 0 0.823905 0 0 0 0.4 0"></feColorMatrix>
        <feBlend in2="shape" result="effect1_innerShadow_427_48"></feBlend>
      </filter>
      <filter
        id="filter1_f_427_48"
        width="20.835"
        height="43.481"
        x="34.758"
        y="8.22"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
        <feBlend
          in="SourceGraphic"
          in2="BackgroundImageFix"
          result="shape"
        ></feBlend>
        <feGaussianBlur result="effect1_foregroundBlur_427_48"></feGaussianBlur>
      </filter>
      <filter
        id="filter2_i_427_48"
        width="9.441"
        height="9.466"
        x="43.493"
        y="39.511"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
        <feBlend
          in="SourceGraphic"
          in2="BackgroundImageFix"
          result="shape"
        ></feBlend>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset dy="-3"></feOffset>
        <feGaussianBlur stdDeviation="0.35"></feGaussianBlur>
        <feComposite
          in2="hardAlpha"
          k2="-1"
          k3="1"
          operator="arithmetic"
        ></feComposite>
        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"></feColorMatrix>
        <feBlend in2="shape" result="effect1_innerShadow_427_48"></feBlend>
      </filter>
      <filter
        id="filter3_f_427_48"
        width="4.748"
        height="11.541"
        x="38.014"
        y="25.884"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
        <feBlend
          in="SourceGraphic"
          in2="BackgroundImageFix"
          result="shape"
        ></feBlend>
        <feGaussianBlur
          result="effect1_foregroundBlur_427_48"
          stdDeviation="0.3"
        ></feGaussianBlur>
      </filter>
      <filter
        id="filter4_f_427_48"
        width="18.165"
        height="15.238"
        x="11.13"
        y="18.748"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
        <feBlend
          in="SourceGraphic"
          in2="BackgroundImageFix"
          result="shape"
        ></feBlend>
        <feGaussianBlur
          result="effect1_foregroundBlur_427_48"
          stdDeviation="0.55"
        ></feGaussianBlur>
      </filter>
      <filter
        id="filter5_f_427_48"
        width="16.54"
        height="25.241"
        x="27.877"
        y="20.022"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
        <feBlend
          in="SourceGraphic"
          in2="BackgroundImageFix"
          result="shape"
        ></feBlend>
        <feGaussianBlur
          result="effect1_foregroundBlur_427_48"
          stdDeviation="0.55"
        ></feGaussianBlur>
      </filter>
      <filter
        id="filter6_f_427_48"
        width="22.46"
        height="14.21"
        x="21.265"
        y="9.498"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
        <feBlend
          in="SourceGraphic"
          in2="BackgroundImageFix"
          result="shape"
        ></feBlend>
        <feGaussianBlur
          result="effect1_foregroundBlur_427_48"
          stdDeviation="0.55"
        ></feGaussianBlur>
      </filter>
      <filter
        id="filter7_i_427_48"
        width="38.848"
        height="30.607"
        x="4.698"
        y="23.971"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
        <feBlend
          in="SourceGraphic"
          in2="BackgroundImageFix"
          result="shape"
        ></feBlend>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset dy="-6"></feOffset>
        <feGaussianBlur stdDeviation="0.45"></feGaussianBlur>
        <feComposite
          in2="hardAlpha"
          k2="-1"
          k3="1"
          operator="arithmetic"
        ></feComposite>
        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.16 0"></feColorMatrix>
        <feBlend in2="shape" result="effect1_innerShadow_427_48"></feBlend>
      </filter>
      <clipPath id="paint0_angular_427_48_clip_path">
        <path d="M31.04 45.642h.006l-.004-.003zm6.009 3.832-.005.015.204-.005.006-.015zm.2.01-.205.005.005-.015.205-.005zM15.566 23.41a.94.94 0 0 1 .662-.419l.206-.027.188-.03.104-.156.115-.167q.134-.198.289-.371l.128-.145.132-.142.16-.142a.97.97 0 0 1 .57-.166l.446.005c.056 0 .076-.01.079-.013l.305-.22a.5.5 0 0 0 .124-.137l.107-.183.11-.18a1.2 1.2 0 0 1 .466-.455l.331-.174q.205-.11.428-.185l.185-.06.182-.062a.35.35 0 0 0 .136-.079l.279-.265c.182-.171.405-.263.644-.285l.21-.02.16-.015.079-.14.104-.185c.117-.209.29-.38.523-.478l.174-.072.177-.075q.196-.08.401-.146l.183-.057.185-.06a.12.12 0 0 0 .064-.046l.12-.16.123-.157.134-.146a1 1 0 0 1 .523-.23l.203-.024.206-.027a.2.2 0 0 0 .097-.04l.15-.12.145-.12a.6.6 0 0 0 .133-.165l.107-.182.105-.188a.89.89 0 0 1 .7-.454l.207-.022.208-.017a.2.2 0 0 0 .11-.04l.15-.111.154-.113q.189-.14.4-.242l.166-.081.169-.085a1.5 1.5 0 0 0 .241-.145l.147-.109.15-.112c.185-.139.402-.21.629-.22l.196-.006.127-.009.117-.175.123-.2a.83.83 0 0 1 .386-.335.8.8 0 0 1 .517-.022l.218.06.223.059h.014l.144-.083.163-.098q.254-.152.545-.192l.187-.02.187-.027q.144-.02.28-.063l.178-.055.18-.06q.159-.05.318-.112l.348-.143q.208-.083.423-.137l.182-.048.183-.043q.197-.05.397-.088l.182-.034.187-.035c.21-.04.419-.023.62.04l.195.06.19.06c.079.025.148.031.206.029l.181-.006.181-.011q.2-.01.4-.002l.184.004.181.003a.4.4 0 0 0 .179-.036l.195-.081.198-.08c.2-.08.415-.111.633-.086l.386.04.207.049a.97.97 0 0 1 .465.36l.127.182.126.177c.04.057.07.072.08.077l.17.07.167.073q.217.092.412.227l.155.112.154.107c.183.129.317.3.401.505l.146.36q.031.074.087.123l.282.253q.156.14.302.294l.265.279q.141.147.278.301l.257.292c.166.19.248.419.258.664l.008.207.01.203q.007.161.04.294l.042.183.046.185c.027.109.053.216.088.32l.06.177.057.178a4 4 0 0 0 .12.305l.149.342q.038.09.123.189l.134.15.138.153c.159.178.256.395.276.637l.013.192.017.194q.014.187.03.371l.038.382q.017.175.045.348l.03.189.028.183.005.007a.2.2 0 0 0 .033.042l.16.148.163.15a.98.98 0 0 1 .3.508l.02.21-.006.193-.003.195a.6.6 0 0 0 .033.205l.061.177.059.18q.045.128.12.257l.099.169.102.17c.126.216.17.457.13.701l-.033.199-.03.2a1 1 0 0 0-.013.268l.031.377a.5.5 0 0 0 .053.175l.088.17.09.177q.137.27.149.573l.007.188.005.19q.008.226-.016.454l-.02.193-.017.195v.009l.012.023.113.168.117.171c.108.16.188.333.232.52l.085.366c.05.212.037.426-.021.632l-.058.2-.042.156.104.14.133.167c.13.168.201.365.2.574l-.024.213-.094.397c-.006.026-.002.037.004.05l.08.175.079.179c.093.203.127.42.099.642l-.026.194-.023.19a.12.12 0 0 0 .015.077l.095.175.09.176q.141.269.158.574l.01.19.007.187q.01.212-.001.426l-.019.381a.6.6 0 0 0 .024.204l.057.183.051.184q.05.157.115.315l.146.36c.087.212.106.44.061.663l-.037.191-.04.194q-.03.155-.035.3l-.01.19-.003.19a2.4 2.4 0 0 1-.059.463l-.081.35a2.2 2.2 0 0 1-.136.416l-.067.143-.063.145a4 4 0 0 1-.177.337l-.081.144-.087.144a.86.86 0 0 1-.58.416l-.165.036-.504.102-.17.032-.166.03c-.206.04-.411.023-.605-.049l-.165-.062-.167-.06a1 1 0 0 1-.512-.428l-.093-.15-.09-.154a.7.7 0 0 0-.14-.164l-.147-.125-.147-.13a1.7 1.7 0 0 1-.347-.418l-.189-.322q-.098-.165-.191-.334l-.09-.162-.092-.165a2 2 0 0 1-.188-.466l-.049-.187-.047-.177-.013-.008-.367-.225a.84.84 0 0 1-.326-.348.87.87 0 0 1-.08-.46l.02-.227.011-.166-.102-.072-.174-.12c-.033-.023-.06-.054-.092-.08q.002.045.002.09l-.013.189-.01.185a3 3 0 0 0 0 .324l.01.184.01.19a1.08 1.08 0 0 1-.206.684l-.127.178-.091.122.058.132.087.194a1 1 0 0 1 .037.742l-.122.369a.2.2 0 0 0-.008.103l.044.188.045.194q.07.312-.018.62l-.053.186-.05.182a.4.4 0 0 0-.01.172l.026.186.027.192q.033.239.016.478l-.013.189-.01.185a1.18 1.18 0 0 1-.255.638l-.138.18-.087.11.052.12.092.192a1 1 0 0 1 .087.569l-.05.196-.07.183-.065.183a3 3 0 0 0-.1.313l-.044.186-.047.185.012.031.101.194.1.197c.109.215.154.454.11.702l-.034.192-.031.195q-.048.267-.17.511l-.087.181-.093.183a1.12 1.12 0 0 1-.474.496l-.351.19a1.4 1.4 0 0 0-.247.173l-.16.137-.157.136a.84.84 0 0 1-.846.16l-.2-.067-.197-.07a9 9 0 0 0-.36-.116l-.359-.108a2 2 0 0 1-.176-.06c-.022-.008-.062-.021-.102-.044a.6.6 0 0 1-.1-.076l-.183-.056-.186-.058a1.07 1.07 0 0 1-.568-.409l-.117-.162-.115-.166a.1.1 0 0 0-.058-.047l-.364-.13a1 1 0 0 1-.558-.487l-.1-.188-.098-.191c-.023-.044-.042-.053-.048-.056l-.171-.08-.17-.085a1 1 0 0 0-.25-.081l-.197-.042-.2-.039a1.07 1.07 0 0 1-.603-.348l-.256-.292a.2.2 0 0 0-.085-.056l-.373-.117a1.6 1.6 0 0 1-.497-.254l-.147-.117-.15-.113a2.3 2.3 0 0 1-.348-.338l-.126-.15-.118-.14-.005.002-.215-.016-.212-.019a.87.87 0 0 1-.718-.48l-.098-.192-.07-.135-.145-.013-.215-.015a.9.9 0 0 1-.707-.432l-.218-.35c-.018-.03-.03-.037-.039-.04l-.18-.069-.178-.07a1.6 1.6 0 0 1-.47-.28l-.287-.247a2 2 0 0 0-.238-.171l-.16-.097-.159-.1a2.4 2.4 0 0 1-.38-.29l-.14-.127-.14-.13a1.4 1.4 0 0 0-.217-.167l-.321-.194a.5.5 0 0 0-.182-.065l-.408-.064a1.02 1.02 0 0 1-.629-.351l-.128-.146-.126-.15a1 1 0 0 0-.188-.176l-.154-.107-.152-.11a2 2 0 0 0-.264-.16l-.334-.175a1.2 1.2 0 0 1-.465-.436l-.111-.172-.079-.122-.174.001-.223-.002a.82.82 0 0 1-.476-.152.85.85 0 0 1-.29-.398l-.08-.218-.037-.1-.098.006-.23.008a.87.87 0 0 1-.77-.38l-.115-.166-.1-.151-.195-.026-.206-.028a.87.87 0 0 1-.686-.507l-.093-.198-.06-.129-.136-.006-.22-.01a.98.98 0 0 1-.696-.32l-.256-.292a2 2 0 0 0-.22-.212l-.144-.123-.145-.12a.6.6 0 0 0-.173-.1l-.364-.13a1.16 1.16 0 0 1-.534-.382l-.122-.156-.12-.159a2 2 0 0 0-.209-.228l-.137-.133-.139-.13a.2.2 0 0 0-.094-.048l-.394-.084a1.4 1.4 0 0 1-.546-.244l-.3-.227a6 6 0 0 0-.282-.197l-.154-.107-.156-.103a1.4 1.4 0 0 1-.414-.43l-.108-.175-.088-.137-.174-.013-.215-.015a.9.9 0 0 1-.705-.435l-.108-.176-.107-.178a.26.26 0 0 0-.096-.096l-.325-.188a.34.34 0 0 0-.154-.037l-.438-.018a.83.83 0 0 1-.46-.155.83.83 0 0 1-.281-.388l-.078-.207-.077-.21a2 2 0 0 0-.118-.266l-.17-.282a1.6 1.6 0 0 1-.177-.44l-.034-.154-.035-.16a3 3 0 0 0-.085-.295l-.065-.184-.06-.185a1 1 0 0 1 .023-.72l.075-.185.079-.182a.93.93 0 0 1 .561-.528l.379-.133q.176-.063.337-.133l.174-.072.176-.075a.5.5 0 0 0 .152-.1l.135-.14.136-.136q.142-.14.285-.274l.137-.135.137-.13a1.3 1.3 0 0 1 .525-.303l.185-.06.175-.052.007-.01.205-.38a.87.87 0 0 1 .717-.466l.422-.03a.2.2 0 0 0 .101-.03l.153-.11.149-.113a3 3 0 0 0 .24-.206l.279-.265c.184-.177.412-.269.654-.288l.212-.014.18-.017z"></path>
      </clipPath>
    </defs>
  </>,

{
  viewBox: "0 0 66 61",
  style: {
    position: "absolute",
    top: "-24px",
    right: "-24px",
    transform: "rotate(4deg) scale(2.4)",
    transformOrigin: "top right",
    zIndex: 10,
    pointerEvents: "none",
  },
  fill: "none",
},

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

// tabler-icons: refresh
export const RetryIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
    <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
  </g>,
  tablerIconProps,
);

export const stackPushIcon = createIcon(
  <g>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 10l-2 1l8 4l8 -4l-2 -1" />
    <path d="M4 15l8 4l8 -4" />
    <path d="M12 4v7" />
    <path d="M15 8l-3 3l-3 -3" />
  </g>,
  tablerIconProps,
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

// clock-bolt
export const historyCommandIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M20.984 12.53a9 9 0 1 0 -7.552 8.355" />
    <path d="M12 7v5l3 3" />
    <path d="M19 16l-2 3h4l-2 3" />
  </g>,
  tablerIconProps,
);

// history
export const historyIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 8l0 4l2 2" />
    <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
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

export const resizeIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 11v8a1 1 0 0 0 1 1h8m-9 -14v-1a1 1 0 0 1 1 -1h1m5 0h2m5 0h1a1 1 0 0 1 1 1v1m0 5v2m0 5v1a1 1 0 0 1 -1 1h-1" />
    <path d="M4 12h7a1 1 0 0 1 1 1v7" />
  </g>,
  tablerIconProps,
);

export const adjustmentsIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M14 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M4 6l8 0" />
    <path d="M16 6l4 0" />
    <path d="M8 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M4 12l2 0" />
    <path d="M10 12l10 0" />
    <path d="M17 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M4 18l11 0" />
    <path d="M19 18l1 0" />
  </g>,
  tablerIconProps,
);

export const strokeIcon = createIcon(
  <g strokeWidth={1}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 10l4 -4 L6 14l8 -8 L6 18l12 -12 L10 18l8 -8 L14 18l4 -4" />
  </g>,
  tablerIconProps,
);

export const pencilIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
    <path d="M13.5 6.5l4 4" />
  </g>,
  tablerIconProps,
);

export const chevronLeftIcon = createIcon(
  <g strokeWidth={1}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M11 7l-5 5l5 5" />
    <path d="M17 7l-5 5l5 5" />
  </g>,
  tablerIconProps,
);

export const sidebarRightIcon = createIcon(
  <g strokeWidth="1.75">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" />
    <path d="M15 4l0 16" />
  </g>,
  tablerIconProps,
);

export const messageCircleIcon = createIcon(
  <g strokeWidth="1.25">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1" />
  </g>,
  tablerIconProps,
);

export const presentationIcon = createIcon(
  <g strokeWidth="1.25">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 4l18 0" />
    <path d="M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10" />
    <path d="M12 16l0 4" />
    <path d="M9 20l6 0" />
    <path d="M8 12l3 -3l2 2l3 -3" />
  </g>,
  tablerIconProps,
);

// empty placeholder icon (used for alignment in menus)
export const emptyIcon = <div style={{ width: "1rem", height: "1rem" }} />;

//tabler-icons: chevron-right
export const chevronRight = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <polyline points="9 6 15 12 9 18" />
  </g>,
  tablerIconProps,
);

// tabler-icons: adjustments-horizontal
export const settingsIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M14 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M4 6l8 0" />
    <path d="M16 6l4 0" />
    <path d="M8 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M4 12l2 0" />
    <path d="M10 12l10 0" />
    <path d="M17 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M4 18l11 0" />
    <path d="M19 18l1 0" />
  </g>,
  tablerIconProps,
);
