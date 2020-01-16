import rough from "roughjs/bin/rough";

import { ExcalidrawElement } from "../element/types";

import { getElementAbsoluteCoords } from "../element";

import { renderScene } from "../renderer";
import { AppState } from "../types";
import { ExportType } from "./types";
import nanoid from "nanoid";

const LOCAL_STORAGE_KEY = "excalidraw";
const LOCAL_STORAGE_KEY_STATE = "excalidraw-state";
const JSONSTOREIO_SHORTLINK_ENDPOINT = new URL(
  "https://www.jsonstore.io/7535731590bfdc991d38b97d0fec2b722f5701c15118e0b1896968c7fe9f07a9"
);

function saveFile(name: string, data: string) {
  // create a temporary <a> elem which we'll use to download the image
  const link = document.createElement("a");
  link.setAttribute("download", name);
  link.setAttribute("href", data);
  link.click();

  // clean up
  link.remove();
}

interface DataState {
  elements: readonly ExcalidrawElement[];
  appState: any;
}

function serializeAsJSON(elements: readonly ExcalidrawElement[]) {
  return JSON.stringify({
    version: 1,
    source: window.location.origin,
    elements: elements.map(({ shape, ...el }) => el)
  });
}

export function saveAsJSON(
  elements: readonly ExcalidrawElement[],
  name: string
) {
  saveFile(
    `${name}.json`,
    "data:text/plain;charset=utf-8," +
      encodeURIComponent(serializeAsJSON(elements))
  );
}

export async function exportToShortlink(
  elements: readonly ExcalidrawElement[]
) {
  // Generating a random unique shortcode
  // https://stackoverflow.com/questions/6248666/
  const firstPart = (Math.random() * 46656) | 0;
  const secondPart = (Math.random() * 46656) | 0;
  const shortcode =
    ("000" + firstPart.toString(36)).slice(-3) +
    ("000" + secondPart.toString(36)).slice(-3);

  const response = await fetch(
    JSONSTOREIO_SHORTLINK_ENDPOINT + "/" + shortcode,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: serializeAsJSON(elements)
    }
  );
  const json = await response.json();
  if (json.ok) {
    const url = new URL(window.location.href);
    url.searchParams.append("share_js", shortcode);

    await navigator.clipboard.writeText(url.toString());
    window.alert("Copied shareable link " + url.toString() + " to clipboard");
  } else {
    window.alert("Couldn't create shareable link");
  }
}

export async function importFromShortlink(shortcode: string | null) {
  let elements: readonly ExcalidrawElement[] = [];
  const response = await fetch(
    JSONSTOREIO_SHORTLINK_ENDPOINT + "/" + shortcode
  ).then(data => data.text());
  if (response != null) {
    try {
      const json = JSON.parse(response);
      elements = json.result.elements || [];
    } catch (e) {
      window.alert("Importing from shortlink failed");
      console.error(e);
    }
  }
  return restore(elements, null);
}

export function loadFromJSON() {
  const input = document.createElement("input");
  const reader = new FileReader();
  input.type = "file";
  input.accept = ".json";

  input.onchange = () => {
    if (!input.files!.length) {
      alert("A file was not selected.");
      return;
    }

    reader.readAsText(input.files![0], "utf8");
  };

  input.click();

  return new Promise<DataState>(resolve => {
    reader.onloadend = () => {
      if (reader.readyState === FileReader.DONE) {
        let elements = [];
        try {
          const data = JSON.parse(reader.result as string);
          elements = data.elements || [];
        } catch (e) {
          // Do nothing because elements array is already empty
        }
        resolve(restore(elements, null));
      }
    };
  });
}

export function getExportCanvasPreview(
  elements: readonly ExcalidrawElement[],
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
  }
) {
  // calculate smallest area to fit the contents in
  let subCanvasX1 = Infinity;
  let subCanvasX2 = 0;
  let subCanvasY1 = Infinity;
  let subCanvasY2 = 0;

  elements.forEach(element => {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    subCanvasX1 = Math.min(subCanvasX1, x1);
    subCanvasY1 = Math.min(subCanvasY1, y1);
    subCanvasX2 = Math.max(subCanvasX2, x2);
    subCanvasY2 = Math.max(subCanvasY2, y2);
  });

  function distance(x: number, y: number) {
    return Math.abs(x > y ? x - y : y - x);
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = distance(subCanvasX1, subCanvasX2) + exportPadding * 2;
  tempCanvas.height = distance(subCanvasY1, subCanvasY2) + exportPadding * 2;

  renderScene(
    elements,
    rough.canvas(tempCanvas),
    tempCanvas,
    {
      viewBackgroundColor: exportBackground ? viewBackgroundColor : null,
      scrollX: 0,
      scrollY: 0
    },
    {
      offsetX: -subCanvasX1 + exportPadding,
      offsetY: -subCanvasY1 + exportPadding,
      renderScrollbars: false,
      renderSelection: false
    }
  );
  return tempCanvas;
}

export function exportCanvas(
  type: ExportType,
  elements: readonly ExcalidrawElement[],
  canvas: HTMLCanvasElement,
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor,
    name
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    scrollX: number;
    scrollY: number;
    name: string;
  }
) {
  if (!elements.length) return window.alert("Cannot export empty canvas.");
  // calculate smallest area to fit the contents in

  let subCanvasX1 = Infinity;
  let subCanvasX2 = 0;
  let subCanvasY1 = Infinity;
  let subCanvasY2 = 0;

  elements.forEach(element => {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    subCanvasX1 = Math.min(subCanvasX1, x1);
    subCanvasY1 = Math.min(subCanvasY1, y1);
    subCanvasX2 = Math.max(subCanvasX2, x2);
    subCanvasY2 = Math.max(subCanvasY2, y2);
  });

  function distance(x: number, y: number) {
    return Math.abs(x > y ? x - y : y - x);
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.style.display = "none";
  document.body.appendChild(tempCanvas);
  tempCanvas.width = distance(subCanvasX1, subCanvasX2) + exportPadding * 2;
  tempCanvas.height = distance(subCanvasY1, subCanvasY2) + exportPadding * 2;

  renderScene(
    elements,
    rough.canvas(tempCanvas),
    tempCanvas,
    {
      viewBackgroundColor: exportBackground ? viewBackgroundColor : null,
      scrollX: 0,
      scrollY: 0
    },
    {
      offsetX: -subCanvasX1 + exportPadding,
      offsetY: -subCanvasY1 + exportPadding,
      renderScrollbars: false,
      renderSelection: false
    }
  );

  if (type === "png") {
    saveFile(`${name}.png`, tempCanvas.toDataURL("image/png"));
  } else if (type === "clipboard") {
    try {
      tempCanvas.toBlob(async function(blob) {
        try {
          await navigator.clipboard.write([
            new window.ClipboardItem({ "image/png": blob })
          ]);
        } catch (err) {
          window.alert("Couldn't copy to clipboard. Try using Chrome browser.");
        }
      });
    } catch (err) {
      window.alert("Couldn't copy to clipboard. Try using Chrome browser.");
    }
  } else if (type === "shortlink") {
    exportToShortlink(elements);
  }

  // clean up the DOM
  if (tempCanvas !== canvas) tempCanvas.remove();
}

function restore(
  savedElements: readonly ExcalidrawElement[],
  savedState: any
): DataState {
  return {
    elements: savedElements.map(element => ({
      ...element,
      id: element.id || nanoid(),
      fillStyle: element.fillStyle || "hachure",
      strokeWidth: element.strokeWidth || 1,
      roughness: element.roughness || 1,
      opacity:
        element.opacity === null || element.opacity === undefined
          ? 100
          : element.opacity
    })),
    appState: savedState
  };
}

export function restoreFromLocalStorage() {
  const savedElements = localStorage.getItem(LOCAL_STORAGE_KEY);
  const savedState = localStorage.getItem(LOCAL_STORAGE_KEY_STATE);

  let elements = [];
  if (savedElements) {
    try {
      elements = JSON.parse(savedElements).map(
        ({ shape, ...element }: ExcalidrawElement) => element
      );
    } catch (e) {
      // Do nothing because elements array is already empty
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = JSON.parse(savedState);
    } catch (e) {
      // Do nothing because appState is already null
    }
  }

  return restore(elements, appState);
}

export function saveToLocalStorage(
  elements: readonly ExcalidrawElement[],
  state: AppState
) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(elements));
  localStorage.setItem(LOCAL_STORAGE_KEY_STATE, JSON.stringify(state));
}
