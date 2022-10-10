import { KEYS } from "./keys";

export const SHAPES = [
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        strokeWidth="1.2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <line x1="3" y1="12" x2="6" y2="12" />
        <line x1="12" y1="3" x2="12" y2="6" />
        <line x1="7.8" y1="7.8" x2="5.6" y2="5.6" />
        <line x1="16.2" y1="7.8" x2="18.4" y2="5.6" />
        <line x1="7.8" y1="16.2" x2="5.6" y2="18.4" />
        <path d="M12 12l9 3l-4 2l-2 4l-3 -9" />
      </svg>
    ),
    value: "selection",
    key: KEYS.V,
    fillable: true,
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        strokeWidth="1.2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </svg>
    ),
    value: "rectangle",
    key: KEYS.R,
    fillable: true,
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        strokeWidth="1.2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M10.5 20.4l-6.9 -6.9c-.781 -.781 -.781 -2.219 0 -3l6.9 -6.9c.781 -.781 2.219 -.781 3 0l6.9 6.9c.781 .781 .781 2.219 0 3l-6.9 6.9c-.781 .781 -2.219 .781 -3 0z" />
      </svg>
    ),
    value: "diamond",
    key: KEYS.D,
    fillable: true,
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        strokeWidth="1.2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
    value: "ellipse",
    key: KEYS.O,
    fillable: true,
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        strokeWidth="1.2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <line x1="5" y1="12" x2="19" y2="12" />
        <line x1="15" y1="16" x2="19" y2="12" />
        <line x1="15" y1="8" x2="19" y2="12" />
      </svg>
    ),
    value: "arrow",
    key: KEYS.A,
    fillable: true,
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        strokeWidth="1.2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    value: "line",
    key: [KEYS.P, KEYS.L],
    fillable: true,
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        strokeWidth="1.2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M4 20h4l10.5 -10.5a1.5 1.5 0 0 0 -4 -4l-10.5 10.5v4" />
        <line x1="13.5" y1="6.5" x2="17.5" y2="10.5" />
      </svg>
    ),
    value: "freedraw",
    key: [KEYS.X, KEYS.P.toUpperCase()],
    fillable: false,
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        strokeWidth="1.2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <line x1="4" y1="20" x2="7" y2="20" />
        <line x1="14" y1="20" x2="21" y2="20" />
        <line x1="6.9" y1="15" x2="13.8" y2="15" />
        <line x1="10.2" y1="6.3" x2="16" y2="20" />
        <polyline points="5 20 11 4 13 4 20 20" />
      </svg>
    ),
    value: "text",
    key: KEYS.T,
    fillable: false,
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        strokeWidth="1.2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <line x1="15" y1="8" x2="15.01" y2="8" />
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M4 15l4 -4a3 5 0 0 1 3 0l5 5" />
        <path d="M14 14l1 -1a3 5 0 0 1 3 0l2 2" />
      </svg>
    ),
    value: "image",
    key: null,
    fillable: false,
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        strokeWidth="1.2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M19 19h-11l-4 -4a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9 9" />
        <line x1="18" y1="12.3" x2="11.7" y2="6" />
      </svg>
    ),
    value: "eraser",
    key: KEYS.E,
    fillable: false,
  },
] as const;

export const findShapeByKey = (key: string) => {
  const shape = SHAPES.find((shape, index) => {
    return (
      key === (shape.value === "eraser" ? 0 : index + 1).toString() ||
      (shape.key &&
        (typeof shape.key === "string"
          ? shape.key === key
          : (shape.key as readonly string[]).includes(key)))
    );
  });
  return shape?.value || null;
};
