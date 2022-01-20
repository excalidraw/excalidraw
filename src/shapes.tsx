import { ExcalidrawElement } from "./element/types";
import { KEYS } from "./keys";
import { DataURL } from "./types";

// We inline font-awesome icons in order to save on js size rather than including the font awesome react library
export const SHAPES: readonly {
  icon: React.ReactElement<any, any>;
  value: ExcalidrawElement["type"];
  key: string | readonly string[] | null;
}[] = [
  {
    icon: (
      // fa-mouse-pointer
      <svg viewBox="0 0 320 512" className="">
        <path d="M302.189 329.126H196.105l55.831 135.993c3.889 9.428-.555 19.999-9.444 23.999l-49.165 21.427c-9.165 4-19.443-.571-23.332-9.714l-53.053-129.136-86.664 89.138C18.729 472.71 0 463.554 0 447.977V18.299C0 1.899 19.921-6.096 30.277 5.443l284.412 292.542c11.472 11.179 3.007 31.141-12.5 31.141z" />
      </svg>
    ),
    value: "selection",
    key: KEYS.V,
  },
  {
    icon: (
      // fa-square
      <svg viewBox="0 0 448 512">
        <path d="M400 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48z" />
      </svg>
    ),
    value: "rectangle",
    key: KEYS.R,
  },
  {
    icon: (
      // custom
      <svg viewBox="0 0 223.646 223.646">
        <path d="M111.823 0L16.622 111.823 111.823 223.646 207.025 111.823z" />
      </svg>
    ),
    value: "diamond",
    key: KEYS.D,
  },
  {
    icon: (
      // fa-circle
      <svg viewBox="0 0 512 512">
        <path d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z" />
      </svg>
    ),
    value: "ellipse",
    key: KEYS.E,
  },
  {
    icon: (
      // fa-long-arrow-alt-right
      <svg viewBox="0 0 448 512" className="rtl-mirror">
        <path d="M313.941 216H12c-6.627 0-12 5.373-12 12v56c0 6.627 5.373 12 12 12h301.941v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.569 0-33.941l-86.059-86.059c-15.119-15.119-40.971-4.411-40.971 16.971V216z" />
      </svg>
    ),
    value: "arrow",
    key: KEYS.A,
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
          stroke="currentColor"
          strokeLinecap="round"
        />
      </svg>
    ),
    value: "line",
    key: [KEYS.P, KEYS.L],
  },
  {
    icon: (
      // fa-pencil
      <svg viewBox="0 0 512 512">
        <path
          fill="currentColor"
          d="M290.74 93.24l128.02 128.02-277.99 277.99-114.14 12.6C11.35 513.54-1.56 500.62.14 485.34l12.7-114.22 277.9-277.88zm207.2-19.06l-60.11-60.11c-18.75-18.75-49.16-18.75-67.91 0l-56.55 56.55 128.02 128.02 56.55-56.55c18.75-18.76 18.75-49.16 0-67.91z"
        ></path>
      </svg>
    ),
    value: "freedraw",
    key: [KEYS.X, KEYS.P.toUpperCase()],
  },
  {
    icon: (
      // fa-font
      <svg viewBox="0 0 448 512">
        <path d="M432 416h-23.41L277.88 53.69A32 32 0 0 0 247.58 32h-47.16a32 32 0 0 0-30.3 21.69L39.41 416H16a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16v-32a16 16 0 0 0-16-16h-19.58l23.3-64h152.56l23.3 64H304a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16v-32a16 16 0 0 0-16-16zM176.85 272L224 142.51 271.15 272z" />
      </svg>
    ),
    value: "text",
    key: KEYS.T,
  },
  {
    icon: (
      // fa-image
      <svg viewBox="0 0 512 512">
        <path
          fill="currentColor"
          d="M464 64H48C21.49 64 0 85.49 0 112v288c0 26.51 21.49 48 48 48h416c26.51 0 48-21.49 48-48V112c0-26.51-21.49-48-48-48zm-6 336H54a6 6 0 0 1-6-6V118a6 6 0 0 1 6-6h404a6 6 0 0 1 6 6v276a6 6 0 0 1-6 6zM128 152c-22.091 0-40 17.909-40 40s17.909 40 40 40 40-17.909 40-40-17.909-40-40-40zM96 352h320v-80l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L192 304l-39.515-39.515c-4.686-4.686-12.284-4.686-16.971 0L96 304v48z"
        ></path>
      </svg>
    ),
    value: "image",
    key: null,
  },
  {
    // fa-table
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1792"
        height="1792"
        viewBox="0 0 1792 1792"
      >
        <path d="M576 1376v-192q0-14-9-23t-23-9h-320q-14 0-23 9t-9 23v192q0 14 9 23t23 9h320q14 0 23-9t9-23zm0-384v-192q0-14-9-23t-23-9h-320q-14 0-23 9t-9 23v192q0 14 9 23t23 9h320q14 0 23-9t9-23zm512 384v-192q0-14-9-23t-23-9h-320q-14 0-23 9t-9 23v192q0 14 9 23t23 9h320q14 0 23-9t9-23zm-512-768v-192q0-14-9-23t-23-9h-320q-14 0-23 9t-9 23v192q0 14 9 23t23 9h320q14 0 23-9t9-23zm512 384v-192q0-14-9-23t-23-9h-320q-14 0-23 9t-9 23v192q0 14 9 23t23 9h320q14 0 23-9t9-23zm512 384v-192q0-14-9-23t-23-9h-320q-14 0-23 9t-9 23v192q0 14 9 23t23 9h320q14 0 23-9t9-23zm-512-768v-192q0-14-9-23t-23-9h-320q-14 0-23 9t-9 23v192q0 14 9 23t23 9h320q14 0 23-9t9-23zm512 384v-192q0-14-9-23t-23-9h-320q-14 0-23 9t-9 23v192q0 14 9 23t23 9h320q14 0 23-9t9-23zm0-384v-192q0-14-9-23t-23-9h-320q-14 0-23 9t-9 23v192q0 14 9 23t23 9h320q14 0 23-9t9-23zm128-320v1088q0 66-47 113t-113 47h-1344q-66 0-113-47t-47-113v-1088q0-66 47-113t113-47h1344q66 0 113 47t47 113z" />
      </svg>
    ),
    value: "table",
    key: null,
  },
] as const;

export const findShapeByKey = (key: string) => {
  const shape = SHAPES.find((shape, index) => {
    return (
      key === (index + 1).toString() ||
      (shape.key &&
        (typeof shape.key === "string"
          ? shape.key === key
          : (shape.key as readonly string[]).includes(key)))
    );
  });
  return shape?.value || null;
};

export const generateThumbnail = async (file: File) => {
  try {
    return tableThumbnailForFilename(file.name);
  } catch (ex) {
    console.error("Error generating thumbnail, defaulting");
    console.error(ex);
    return "data:image/png;base64,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" as DataURL;
  }
};

const blobToDataURL = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      resolve(e.target?.result as string);
    };
    reader.readAsDataURL(blob);
  });

const tableThumbnailForFilename = async (name: string) => {
  const parser = new DOMParser();
  const svg = parser.parseFromString(tableThumbnail, "image/svg+xml")
    .children[0];
  const text = svg.getElementsByTagName("text")[0];
  const title =
    name.length > 20 ? `${name.slice(0, 14)}..${name.slice(-4)}` : name;
  text.innerHTML = title;
  const blob = new Blob([svg.outerHTML], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = await blobToDataURL(blob);
  return svgUrl as DataURL;
};

export const tableThumbnail = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 134.75319602272725 112.60475852272754" width="134.75319602272725" height="112.60475852272754" id="thumbnail">
<!-- svg-source:excalidraw -->
<rect x="0" y="0" width="134.75319602272725" height="112.60475852272754" fill="#ffffff"></rect><g stroke-linecap="round" transform="translate(20.66781349960621 45.003538860937454) rotate(0 46.52889397755334 23.04816235900455)"><path d="M-0.22 0.73 C35.71 2.19, 72.56 -0.4, 91.35 0.14 M0.78 0.38 C18.2 -0.06, 38.11 -1.15, 93.34 -0.54 M94.21 -0.12 C92.8 12.25, 91.53 24.29, 92.48 47.68 M92.21 0.88 C92.34 10.41, 93.59 21.51, 92.17 45.38 M93.34 44.26 C58.94 45.82, 26.45 45.72, 0.73 44.53 M94.04 46.48 C68.42 46.61, 42.89 46.64, 0.79 46.41 M0.03 47.03 C-0.07 35.23, -0.7 23.33, 0.46 1.45 M0.31 46.87 C-0.4 33.92, -0.59 20.73, 0.63 0.24" stroke="#000000" stroke-width="1" fill="none"></path></g><g stroke-linecap="round"><g transform="translate(83.39736673523504 45.984363099462655) rotate(0 -0.3465298150168792 22.45519605669125)"><path d="M0.02 1.03 C0.16 8.15, 0.89 36.01, 0.71 43.12 M-1.43 0.53 C-1.38 7.76, -0.32 36.96, 0.14 44.38" stroke="#000000" stroke-width="1" fill="none"></path></g></g><g stroke-linecap="round" transform="translate(20.631296238238804 45.05317113751147) rotate(0 45.9982278249914 5.984606956664777)"><path d="M0 0 C0 0, 0 0, 0 0 M0 0 C0 0, 0 0, 0 0 M0.14 7.15 C1.38 4.27, 2.28 2.94, 5.77 0.31 M0.06 6.27 C1.5 3.98, 4.19 1.83, 5.1 0.67 M-0.24 11.42 C4.95 9.5, 7.07 4.91, 10.59 0.06 M-0.44 12.69 C2.89 7.87, 6.41 4.33, 11.05 -0.29 M5.2 11.09 C8.59 9.91, 11.83 6.95, 16.16 -0.05 M5.19 12.6 C9.3 8.5, 13.3 3.11, 16.35 0.3 M9.91 11.77 C14 8.55, 16.98 5.54, 20.86 0.06 M10.49 12.23 C12.63 9.79, 15.75 6.58, 20.7 -0.36 M14.61 13.64 C17.91 7.98, 23.05 3.31, 25.62 -0.57 M15.35 12 C20.05 7.27, 24.65 2.65, 27.04 -0.07 M21.44 10.54 C25.54 7.52, 25.88 5.41, 30.51 1.03 M20.64 12.76 C23.74 7.75, 27.63 4.37, 31.66 -0.49 M25.63 13.47 C29.4 9.2, 32.46 2.69, 35.96 0.09 M26.95 12.35 C28.84 10, 31.18 7.16, 37.32 0.52 M33.59 10.89 C35.21 9.98, 39.11 4.49, 41.72 -1.19 M32.55 12.4 C35.43 7.13, 40.7 2.43, 43.23 -0.27 M35.44 11.43 C39.99 7.15, 44.36 3.59, 48.09 1.04 M36.95 11.58 C40.17 8.09, 44.23 3.73, 46.93 -0.57 M42.27 10.55 C46.52 8.81, 46.56 5.72, 51.7 1.39 M42.03 12.45 C47.01 6.84, 51.19 3.11, 53.55 -0.16 M49.06 10.9 C50 9.78, 54.79 4.98, 59.54 -0.86 M47.61 11.52 C50.9 9.5, 53.48 5.34, 58.46 0.38 M52.8 11.38 C56.3 7.7, 59.23 7.77, 62.32 0.12 M52.59 12.49 C57.69 6.94, 61.24 2.03, 64.47 0.1 M56.95 11.44 C61.89 10.64, 63.13 6.32, 67.72 -1.38 M58.48 11.51 C62.18 8.36, 64.65 4.41, 69.37 0.57 M63.99 13 C68.79 9.25, 72.18 2.67, 73.71 -1.52 M64.2 12.04 C65.78 8.45, 69.08 7.1, 75.09 -0.11 M70.24 11.93 C73.25 8.84, 76.74 5.91, 79.46 1.44 M69.56 11.66 C73.22 7.89, 76.96 2.98, 80.02 0.36 M74.48 12.77 C77.37 7.18, 80.4 4.9, 84.23 -0.67 M74.9 12.16 C78.26 7.7, 82.24 2.36, 85 -0.68 M79.1 10.62 C83.32 9.1, 85.61 4.94, 88.66 0.92 M79.74 12.77 C82.93 8.76, 86.31 3.48, 90.43 0.02 M85.81 12.14 C87.25 8.41, 90.09 6.59, 94.7 0.95 M85.53 12.13 C88.45 8.4, 90.66 5.69, 93.85 1.58 M90.53 11.89 C91.64 10.53, 92.49 9.09, 94.55 7.92 M90.09 11.92 C90.8 11.51, 91.44 10.14, 93.96 7.48" stroke="#868e96" stroke-width="0.5" fill="none"></path><path d="M-1.71 0.14 C33.52 1.99, 72.12 1.96, 92.76 -0.97 M0.28 -0.54 C31.64 0.62, 64.39 1.15, 91.94 -0.14 M91.65 0.95 C91.01 2.66, 91.75 5.29, 93.05 11.33 M91.46 -0.43 C92.46 3.58, 92.64 7.35, 91.45 11.87 M92.73 10.4 C68.97 11.24, 46.81 13.35, 0.76 12.36 M92.78 12.28 C57.38 13, 22.79 12.68, 0.47 12.01 M0.28 12.84 C-0.28 7.84, 0.82 3.41, 0.92 -0.32 M0.38 12.11 C-0.2 8.24, 0.32 3.62, 0.38 -0.56" stroke="#000000" stroke-width="1" fill="none"></path></g><g stroke-linecap="round"><g transform="translate(21.406995738636795 68.29856722316873) rotate(0 45.742818379529496 -0.2660316199343242)"><path d="M-0.15 -0.43 C15.41 -0.28, 77.84 -0.38, 93.17 -0.24 M-1.69 -1.71 C13.82 -1.28, 77.26 1.18, 92.69 1.17" stroke="#000000" stroke-width="1" fill="none"></path></g></g><g stroke-linecap="round"><g transform="translate(21.880588056340514 79.02936775567997) rotate(0 44.92629768118823 0.14434190404983838)"><path d="M-0.64 0.22 C14.5 0.36, 75.06 1.2, 90.49 1.06 M1.22 -0.71 C16.19 -0.9, 74.18 -0.69, 89.25 -0.5" stroke="#000000" stroke-width="1" fill="none"></path></g></g><g stroke-linecap="round"><g transform="translate(51.38436563601084 45.606587179820906) rotate(0 -0.5727240662329223 22.328677256879473)"><path d="M0.17 0.77 C0.08 8.05, -0.06 36.29, -0.07 43.49 M-1.2 0.13 C-1.5 7.55, -1.16 37.04, -1.05 44.53" stroke="#000000" stroke-width="1" fill="none"></path></g></g><g stroke-linecap="round" transform="translate(10 10) rotate(0 57.376598011363626 46.30237926136377)"><path d="M0.26 -1.66 C36.9 -1.28, 73.83 0.4, 116.08 0.06 M-0.48 -0.23 C40.54 -1.32, 80.29 -1.41, 114.49 -0.44 M116.48 1.85 C112.99 32.4, 115.23 69.7, 112.92 90.7 M113.79 -0.98 C114.83 32.39, 114.38 65.13, 115.39 93.37 M116.44 91.92 C76.67 94.04, 38.69 91.11, 0.29 93.69 M115.33 92.25 C90.48 94.46, 64.07 93.8, 0.95 93.59 M-1.93 91.74 C-1.04 56.45, 2.53 23.39, -1.73 1.62 M-0.66 92.92 C1.81 73.34, 0.25 53.34, 0.53 -0.68" stroke="#000000" stroke-width="1" fill="none"></path></g><g transform="translate(41.392223011363626 20.628272118506572) rotate(0 28 6.5)"><text x="28" y="9" font-size="10px" fill="#000000" text-anchor="middle" style="white-space: pre;" direction="ltr">FILE_TEMPLATE</text></g></svg>`;
