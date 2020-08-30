import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "./element/types";
import { getSelectedElements } from "./scene";
import { AppState } from "./types";
import { SVG_EXPORT_TAG } from "./scene/export";
import { tryParseSpreadsheet, renderSpreadsheet } from "./charts";

const TYPE_ELEMENTS = "excalidraw/elements";

type ElementsClipboard = {
  type: typeof TYPE_ELEMENTS;
  created: number;
  elements: ExcalidrawElement[];
};

let CLIPBOARD = "";

export const probablySupportsClipboardReadText =
  "clipboard" in navigator && "readText" in navigator.clipboard;

export const probablySupportsClipboardWriteText =
  "clipboard" in navigator && "writeText" in navigator.clipboard;

export const probablySupportsClipboardBlob =
  "clipboard" in navigator &&
  "write" in navigator.clipboard &&
  "ClipboardItem" in window &&
  "toBlob" in HTMLCanvasElement.prototype;

const isElementsClipboard = (contents: any): contents is ElementsClipboard => {
  if (contents?.type === TYPE_ELEMENTS) {
    return true;
  }
  return false;
};

export const copyToAppClipboard = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  const contents: ElementsClipboard = {
    type: TYPE_ELEMENTS,
    created: Date.now(),
    elements: getSelectedElements(elements, appState),
  };
  const json = JSON.stringify(contents);
  CLIPBOARD = json;
  try {
    await copyTextToSystemClipboard(json);
  } catch {}
};

const getAppClipboard = (): Partial<ElementsClipboard> => {
  if (!CLIPBOARD) {
    return {};
  }

  try {
    return JSON.parse(CLIPBOARD);
  } catch (error) {
    console.error(error);
  }

  return {};
};

const parsePotentialSpreadsheet = (
  text: string,
  appState: AppState,
  cursorX: number,
  cursorY: number,
) => {
  const result = tryParseSpreadsheet(text);
  if (result.type === "spreadsheet") {
    return {
      elements: renderSpreadsheet(
        appState,
        result.spreadsheet,
        cursorX,
        cursorY,
      ),
    };
  } else if (result.type === "malformed spreadsheet") {
    return { error: result.error };
  }
  return null;
};

export const getClipboardContent = async (
  appState: AppState,
  cursorX: number,
  cursorY: number,
  event: ClipboardEvent | null,
): Promise<{
  text?: string;
  elements?: readonly ExcalidrawElement[];
  error?: string;
}> => {
  try {
    const text = event
      ? event.clipboardData?.getData("text/plain").trim()
      : probablySupportsClipboardReadText &&
        (await navigator.clipboard.readText());

    if (text && !text.includes(SVG_EXPORT_TAG)) {
      const spreadsheetResult = parsePotentialSpreadsheet(
        text,
        appState,
        cursorX,
        cursorX,
      );
      if (spreadsheetResult) {
        return spreadsheetResult;
      }
      const inAppClipboard = getAppClipboard();
      try {
        const contents = JSON.parse(text);
        if (
          isElementsClipboard(contents) &&
          (!inAppClipboard?.created ||
            inAppClipboard.created < contents.created)
        ) {
          return { elements: contents.elements };
        }
        return inAppClipboard;
      } catch {
        return inAppClipboard.elements ? inAppClipboard : { text };
      }
    }
  } catch (error) {
    console.error(error);
  }

  return getAppClipboard();
};

export const copyCanvasToClipboardAsPng = async (canvas: HTMLCanvasElement) =>
  new Promise((resolve, reject) => {
    try {
      canvas.toBlob(async (blob: any) => {
        try {
          await navigator.clipboard.write([
            new window.ClipboardItem({ "image/png": blob }),
          ]);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });

export const copyTextToSystemClipboard = async (text: string | null) => {
  let copied = false;
  if (probablySupportsClipboardWriteText) {
    try {
      // NOTE: doesn't work on FF on non-HTTPS domains, or when document
      //  not focused
      await navigator.clipboard.writeText(text || "");
      copied = true;
    } catch (error) {
      console.error(error);
    }
  }

  // Note that execCommand doesn't allow copying empty strings, so if we're
  //  clearing clipboard using this API, we must copy at least an empty char
  if (!copied && !copyTextViaExecCommand(text || " ")) {
    throw new Error("couldn't copy");
  }
};

// adapted from https://github.com/zenorocha/clipboard.js/blob/ce79f170aa655c408b6aab33c9472e8e4fa52e19/src/clipboard-action.js#L48
const copyTextViaExecCommand = (text: string) => {
  const isRTL = document.documentElement.getAttribute("dir") === "rtl";

  const textarea = document.createElement("textarea");

  textarea.style.border = "0";
  textarea.style.padding = "0";
  textarea.style.margin = "0";
  textarea.style.position = "absolute";
  textarea.style[isRTL ? "right" : "left"] = "-9999px";
  const yPosition = window.pageYOffset || document.documentElement.scrollTop;
  textarea.style.top = `${yPosition}px`;
  // Prevent zooming on iOS
  textarea.style.fontSize = "12pt";

  textarea.setAttribute("readonly", "");
  textarea.value = text;

  document.body.appendChild(textarea);

  let success = false;

  try {
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    success = document.execCommand("copy");
  } catch (error) {
    console.error(error);
  }

  textarea.remove();

  return success;
};
