import { exportToCanvas, exportToSvg } from "../scene/export";
import { getDefaultAppState } from "../appState";

// Export functions

function getElements(input) {
  let json;
  if (typeof input === "string") {
    json = JSON.parse(input);
  } else {
    json = input;
  }
  let elements;
  if (json.elements) {
    elements = json.elements;
  } else {
    elements = json;
  }
  return elements;
}

/**
 * Convert the Excalidraw diagram to SVG
 * @param {string|Object} input - an Excalidraw diagram as a JSON string or as a JSON object.
 * @param options - export options
 * @returns {string} the Excalidraw diagram as a SVG string
 */
export function convertToSvg(input, options) {
  if (options == null) {
    options = {
      exportBackground: false,
      viewBackgroundColor: "#ffffff",
      shouldAddWatermark: false,
    };
  }
  if (options.exportPadding == null) {
    options.exportPadding = 10;
  }
  if (options.metadata == null) {
    options.metadata = "";
  }
  const elements = getElements(input);
  const svgElement = exportToSvg(elements, options);
  return svgElement.outerHTML;
}

/**
 * Convert the Excalidraw diagram to PNG
 * @param {string|Object} input - an Excalidraw diagram as a JSON string or as a JSON object.
 * @param options - export options
 * @returns {Promise<string>} the Excalidraw diagram as a PNG string
 */
export async function convertToPng(input, options) {
  if (options == null) {
    options = {
      exportBackground: false,
      viewBackgroundColor: "#ffffff",
      shouldAddWatermark: false,
    };
  }
  if (options.exportPadding == null) {
    options.exportPadding = 10;
  }
  if (options.scale == null) {
    options.scale = -1;
  }
  const elements = getElements(input);
  const canvas = exportToCanvas(
    elements,
    {
      ...getDefaultAppState(),
      offsetTop: 0,
      offsetLeft: 0,
    },
    {
      exportBackground: true,
      viewBackgroundColor: "#ffffff",
      shouldAddWatermark: false,
      scale: 1,
    },
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (blob) {
        const buf = await blob.arrayBuffer();
        // @ts-ignore
        resolve(String.fromCharCode.apply(null, new Uint16Array(buf)));
        return;
      }
      reject(new Error("Unable to convert to PNG"));
    });
  });
}
