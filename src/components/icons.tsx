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

const activeElementColor = (appearance: "light" | "dark") =>
  appearance === "light" ? oc.orange[4] : oc.orange[9];
const iconFillColor = (appearance: "light" | "dark") =>
  appearance === "light" ? oc.black : oc.gray[4];

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
      className={mirror && "rtl-mirror"}
      style={style}
    >
      {typeof d === "string" ? (
        <path fill="none" stroke="currentColor" d={d} />
      ) : (
        d
      )}
    </svg>
  );
};

export const link = createIcon(
  <>
    <path
      d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M14 11a5.002 5.002 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24 },
);

export const save = createIcon(
  <>
    <path
      d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M17 21v-8H7v8M7 3v5h8"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24 },
);

export const saveAs = createIcon(
  <>
    <path
      d="M18 9h-7a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-7l-4-4z"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M19 21v-4h-7v4M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9l2 2v1M12 9v4h5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24 },
);

export const load = createIcon(
  <>
    <path
      d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11zM12 11v6M9 14h6"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const clipboard = createIcon(
  <>
    <path
      d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M15 2H9a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const trash = createIcon(
  <>
    <path
      d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const palette = createIcon(
  <>
    <path
      d="M17 3a2.827 2.827 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const exportFile = createIcon(
  <>
    <path
      d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const zoomIn = createIcon(
  <>
    <path
      d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35M11 8v6M8 11h6"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const zoomOut = createIcon(
  <>
    <path
      d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35M8 11h6"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

//where is this icon in the UI?
export const done = createIcon(
  <>
    <path
      d="M20 6L9 17l-5-5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);

export const menu = createIcon(
  <>
    <path
      d="M3 12h18M3 6h18M3 18h18"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const undo = createIcon(
  <>
    <path
      d="M1 4v6h6"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      fill="none"
    />
    <path
      d="M3.51 15a9 9 0 102.13-9.36L1 10"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const redo = createIcon(
  <>
    <path
      d="M23 4v6h-6"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      fill="none"
    />
    <path
      d="M20.49 15a9 9 0 11-2.12-9.36L23 10"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const resetZoom = createIcon(
  <>
    <path
      d="M21 21l-4-4"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      fill="none"
    />
    <g
      clipPath="url(#prefix__clip0)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      fill="none"
    >
      <path d="M.917 3.667v5.5h5.5" />
      <path d="M3.218 13.75A8.25 8.25 0 105.17 5.17L.917 9.167" />
    </g>
    <defs>
      <clipPath id="prefix__clip0">
        <path fill={oc.white} d="M0 0h22v22H0z" />
      </clipPath>
    </defs>
  </>,
  { width: 24, height: 24 },
);

export const BringForwardIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z"
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M13 2H4a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2V4a2 2 0 00-2-2z"
          fill={activeElementColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
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
          d="M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z"
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4 2h9a2 2 0 012 2v5h-4a2 2 0 00-2 2v4H4a2 2 0 01-2-2V4a2 2 0 012-2z"
          fill={activeElementColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
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
          d="M9.615 2h-6.23C2.62 2 2 2.62 2 3.385v6.23C2 10.38 2.62 11 3.385 11h6.23C10.38 11 11 10.38 11 9.615v-6.23C11 2.62 10.38 2 9.615 2zM20.615 13h-6.23C13.62 13 13 13.62 13 14.385v6.23c0 .765.62 1.385 1.385 1.385h6.23C21.38 22 22 21.38 22 20.615v-6.23C22 13.62 21.38 13 20.615 13z"
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M16.154 6H7.846C6.826 6 6 6.827 6 7.846v8.308C6 17.174 6.827 18 7.846 18h8.308c1.02 0 1.846-.827 1.846-1.846V7.846C18 6.826 17.173 6 16.154 6z"
          fill={activeElementColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
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
          d="M9.615 1h-6.23v2h6.23V1zM12 3.385A2.385 2.385 0 009.615 1v2c.213 0 .385.172.385.385h2zm0 6.23v-6.23h-2v6.23h2zM9.615 12A2.385 2.385 0 0012 9.615h-2a.385.385 0 01-.385.385v2zm-6.23 0h6.23v-2h-6.23v2zM1 9.615A2.385 2.385 0 003.385 12v-2A.385.385 0 013 9.615H1zm0-6.23v6.23h2v-6.23H1zM3.385 1A2.385 2.385 0 001 3.385h2C3 3.172 3.172 3 3.385 3V1zm17.23 11h-6.23v2h6.23v-2zM23 14.385A2.385 2.385 0 0020.615 12v2c.213 0 .385.172.385.385h2zm0 6.23v-6.23h-2v6.23h2zM20.615 23A2.385 2.385 0 0023 20.615h-2a.385.385 0 01-.385.385v2zm-6.23 0h6.23v-2h-6.23v2zM12 20.615A2.385 2.385 0 0014.385 23v-2a.385.385 0 01-.385-.385h-2zm0-6.23v6.23h2v-6.23h-2zM14.385 12A2.385 2.385 0 0012 14.385h2c0-.213.172-.385.385-.385v-2z"
          fill={iconFillColor(appearance)}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M6 11v5.154C6 17.174 6.827 18 7.846 18H13v-3.615c0-.765.62-1.385 1.385-1.385H18V7.846C18 6.826 17.173 6 16.154 6H11v3.615C11 10.38 10.38 11 9.615 11H6z"
          fill={activeElementColor(appearance)}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>,
      { width: 24 },
    ),
);

export const users = createIcon(
  <>
    <path
      d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const start = createIcon(
  <>
    <path
      d="M5 3l14 9-14 9V3z"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const stop = createIcon(
  <>
    <path
      d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2zM15 9l-6 6M9 9l6 6"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const close = createIcon(
  <>
    <path
      d="M18 6L6 18M6 6l12 12"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const back = createIcon(
  <>
    <path
      d="M19 12H5M12 19l-7-7 7-7"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const clone = createIcon(
  <>
    <path
      d="M20 15h-9a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v9a2 2 0 01-2 2z"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      fill="none"
    />
    <path
      d="M5 9H4a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-1"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      fill="none"
    />
  </>,
  { width: 24, height: 24 },
);

export const shield = createIcon(
  <>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.351 1.064a1 1 0 00-.702 0l-8 3A1 1 0 003 5v7c0 3.446 2.282 6.2 4.341 8.003a22.686 22.686 0 004.104 2.836l.076.04.022.01.006.004.003.001c.282.14.614.141.895 0L12 22c.447.894.449.894.449.894l.002-.001.006-.004.022-.01a8.28 8.28 0 00.35-.188 22.684 22.684 0 003.83-2.689C18.718 18.2 21 15.447 21 12V5a1 1 0 00-.649-.936l-8-3zM12 22l-.448.894L12 22zm4.698-13.284a1 1 0 10-1.396-1.432l-5.456 5.32-1.148-1.12a1 1 0 10-1.396 1.432l1.846 1.8a1 1 0 001.396 0l6.154-6z"
      fill={oc.green[8]}
    />
  </>,
  { width: 24 },
);

export const GroupIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M19 8h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z"
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4 4.385C4 4.172 4.172 4 4.385 4h6.23c.213 0 .385.172.385.385V8h2V4.385A2.385 2.385 0 0010.615 2h-6.23A2.385 2.385 0 002 4.385v6.23A2.385 2.385 0 004.385 13H8v-2H4.385A.385.385 0 014 10.615v-6.23z"
          fill={iconFillColor(appearance)}
        />
        <circle
          cx={3}
          cy={3}
          r={1}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
        />
        <circle
          cx={3}
          cy={21}
          r={1}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
        />
        <circle
          cx={21}
          cy={21}
          r={1}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
        />
        <circle
          cx={21}
          cy={3}
          r={1}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
        />
      </>,
      { width: 24, height: 24 },
    ),
);

export const UngroupIcon = React.memo(
  ({ appearance }: { appearance: "light" | "dark" }) =>
    createIcon(
      <>
        <path
          d="M19 8h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z"
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4 4.385C4 4.172 4.172 4 4.385 4h6.23c.213 0 .385.172.385.385V8h2V4.385A2.385 2.385 0 0010.615 2h-6.23A2.385 2.385 0 002 4.385v6.23A2.385 2.385 0 004.385 13H8v-2H4.385A.385.385 0 014 10.615v-6.23z"
          fill={iconFillColor(appearance)}
        />
        <circle
          cx={3}
          cy={3}
          r={1}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
        />
        <circle
          cx={3}
          cy={12}
          r={1}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
        />
        <circle
          cx={8}
          cy={8}
          r={1}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
        />
        <circle
          cx={21}
          cy={21}
          r={1}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
        />
        <circle
          cx={8}
          cy={21}
          r={1}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
        />
        <circle
          cx={21}
          cy={8}
          r={1}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
        />
        <circle
          cx={12}
          cy={3}
          r={1}
          stroke={iconFillColor(appearance)}
          strokeWidth={2}
        />
      </>,
      { width: 24, height: 24 },
    ),
);
