import rough from "roughjs/bin/wrappers/rough";

import { ExcalidrawElement } from "../element/types";

import { getElementAbsoluteCoords } from "../element";

import { renderScene } from "../renderer";
import { AppState } from "../types";

const LOCAL_STORAGE_KEY = "excalidraw";
const LOCAL_STORAGE_KEY_STATE = "excalidraw-state";

function saveFile(name: string, data: string) {
  // create a temporary <a> elem which we'll use to download the image
  const link = document.createElement("a");
  link.setAttribute("download", name);
  link.setAttribute("href", data);
  link.click();

  // clean up
  link.remove();
}

export function saveAsJSON(elements: ExcalidrawElement[], name: string) {
  const serialized = JSON.stringify({
    version: 1,
    source: window.location.origin,
    elements
  });

  saveFile(
    `${name}.json`,
    "data:text/plain;charset=utf-8," + encodeURIComponent(serialized)
  );
}

export function loadFromJSON(elements: ExcalidrawElement[]) {
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

  return new Promise(resolve => {
    reader.onloadend = () => {
      if (reader.readyState === FileReader.DONE) {
        const data = JSON.parse(reader.result as string);
        restore(elements, data.elements, null);
        resolve();
      }
    };
  });
}

export function exportAsPNG(
  elements: ExcalidrawElement[],
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

  saveFile(`${name}.png`, tempCanvas.toDataURL("image/png"));

  // clean up the DOM
  if (tempCanvas !== canvas) tempCanvas.remove();
}

function restore(
  elements: ExcalidrawElement[],
  savedElements: string | ExcalidrawElement[] | null,
  savedState: string | null
) {
  try {
    if (savedElements) {
      elements.splice(
        0,
        elements.length,
        ...(typeof savedElements === "string"
          ? JSON.parse(savedElements)
          : savedElements)
      );
      elements.forEach((element: ExcalidrawElement) => {
        element.fillStyle = element.fillStyle || "hachure";
        element.strokeWidth = element.strokeWidth || 1;
        element.roughness = element.roughness || 1;
        element.opacity =
          element.opacity === null || element.opacity === undefined
            ? 100
            : element.opacity;
      });
    }

    return savedState ? JSON.parse(savedState) : null;
  } catch (e) {
    elements.splice(0, elements.length);
    return null;
  }
}

export function restoreFromLocalStorage(elements: ExcalidrawElement[]) {
  const savedElements = localStorage.getItem(LOCAL_STORAGE_KEY);
  const savedState = localStorage.getItem(LOCAL_STORAGE_KEY_STATE);

  return restore(elements, savedElements, savedState);
}

export function saveToLocalStorage(
  elements: ExcalidrawElement[],
  state: AppState
) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(elements));
  localStorage.setItem(LOCAL_STORAGE_KEY_STATE, JSON.stringify(state));
}

export function restoreFromURL(elements: ExcalidrawElement[]) {
  try {
    const [savedElements, savedState] = document.location.hash
      .slice(1)
      .split(":")
      .map(atob);
    return restore(elements, savedElements, savedState);
  } catch (ex) {
    return null;
  }
}

export function saveToURL(elements: ExcalidrawElement[], state: AppState) {
  const hash = [JSON.stringify(elements), JSON.stringify(state)]
    .map(btoa)
    .join(":");
  document.location.replace("#" + hash);
}
