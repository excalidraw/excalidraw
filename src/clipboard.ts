import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "./element/types";
import { getSelectedElements } from "./scene";
import { AppState, BinaryFiles } from "./types";
import { SVG_EXPORT_TAG } from "./scene/export";
import { tryParseSpreadsheet, Spreadsheet, VALID_SPREADSHEET } from "./charts";
import { EXPORT_DATA_TYPES, MIME_TYPES } from "./constants";
import { isInitializedImageElement } from "./element/typeChecks";
import { isPromiseLike } from "./utils";

type ElementsClipboard = {
  type: typeof EXPORT_DATA_TYPES.excalidrawClipboard;
  elements: ExcalidrawElement[];
  files: BinaryFiles | undefined;
};

export interface ClipboardData {
  spreadsheet?: Spreadsheet;
  elements?: readonly ExcalidrawElement[];
  files?: BinaryFiles;
  text?: string;
  errorMessage?: string;
}

let CLIPBOARD = "";
let PREFER_APP_CLIPBOARD = false;

export const probablySupportsClipboardReadText =
  "clipboard" in navigator && "readText" in navigator.clipboard;

export const probablySupportsClipboardWriteText =
  "clipboard" in navigator && "writeText" in navigator.clipboard;

export const probablySupportsClipboardBlob =
  "clipboard" in navigator &&
  "write" in navigator.clipboard &&
  "ClipboardItem" in window &&
  "toBlob" in HTMLCanvasElement.prototype;

const clipboardContainsElements = (
  contents: any,
): contents is { elements: ExcalidrawElement[]; files?: BinaryFiles } => {
  if (
    [
      EXPORT_DATA_TYPES.excalidraw,
      EXPORT_DATA_TYPES.excalidrawClipboard,
    ].includes(contents?.type) &&
    Array.isArray(contents.elements)
  ) {
    return true;
  }
  return false;
};

export const copyToClipboard = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) => {
  // select binded text elements when copying
  const selectedElements = getSelectedElements(elements, appState, true);
  const contents: ElementsClipboard = {
    type: EXPORT_DATA_TYPES.excalidrawClipboard,
    elements: selectedElements,
    files: selectedElements.reduce((acc, element) => {
      if (isInitializedImageElement(element) && files[element.fileId]) {
        acc[element.fileId] = files[element.fileId];
      }
      return acc;
    }, {} as BinaryFiles),
  };
  const json = JSON.stringify(contents);
  CLIPBOARD = json;
  try {
    PREFER_APP_CLIPBOARD = false;
    await copyTextToSystemClipboard(json);
  } catch (error: any) {
    PREFER_APP_CLIPBOARD = true;
    console.error(error);
  }
};

const getAppClipboard = (): Partial<ElementsClipboard> => {
  if (!CLIPBOARD) {
    return {};
  }

  try {
    return JSON.parse(CLIPBOARD);
  } catch (error: any) {
    console.error(error);
    return {};
  }
};

const parsePotentialSpreadsheet = (
  text: string,
): { spreadsheet: Spreadsheet } | { errorMessage: string } | null => {
  const result = tryParseSpreadsheet(text);
  if (result.type === VALID_SPREADSHEET) {
    return { spreadsheet: result.spreadsheet };
  }
  return null;
};

/**
 * Retrieves content from system clipboard (either from ClipboardEvent or
 *  via async clipboard API if supported)
 */
const getSystemClipboard = async (
  event: ClipboardEvent | null,
): Promise<string> => {
  try {
    const text = event
      ? event.clipboardData?.getData("text/plain").trim()
      : probablySupportsClipboardReadText &&
        (await navigator.clipboard.readText());

    return text || "";
  } catch {
    return "";
  }
};

/**
 * Attempts to parse clipboard. Prefers system clipboard.
 */
export const parseClipboard = async (
  event: ClipboardEvent | null,
): Promise<ClipboardData> => {
  const systemClipboard = await getSystemClipboard(event);

  // if system clipboard empty, couldn't be resolved, or contains previously
  // copied excalidraw scene as SVG, fall back to previously copied excalidraw
  // elements
  if (!systemClipboard || systemClipboard.includes(SVG_EXPORT_TAG)) {
    return getAppClipboard();
  }

  // if system clipboard contains spreadsheet, use it even though it's
  // technically possible it's staler than in-app clipboard
  const spreadsheetResult = parsePotentialSpreadsheet(systemClipboard);
  if (spreadsheetResult) {
    return spreadsheetResult;
  }

  const appClipboardData = getAppClipboard();

  try {
    const systemClipboardData = JSON.parse(systemClipboard);
    if (clipboardContainsElements(systemClipboardData)) {
      return {
        elements: systemClipboardData.elements,
        files: systemClipboardData.files,
      };
    }
    return appClipboardData;
  } catch {
    // system clipboard doesn't contain excalidraw elements → return plaintext
    // unless we set a flag to prefer in-app clipboard because browser didn't
    // support storing to system clipboard on copy
    return PREFER_APP_CLIPBOARD && appClipboardData.elements
      ? appClipboardData
      : { text: systemClipboard };
  }
};

export const copyBlobToClipboardAsPng = async (blob: Blob | Promise<Blob>) => {
  let promise;
  try {
    // in Safari so far we need to construct the ClipboardItem synchronously
    // (i.e. in the same tick) otherwise browser will complain for lack of
    // user intent. Using a Promise ClipboardItem constructor solves this.
    // https://bugs.webkit.org/show_bug.cgi?id=222262
    //
    // not await so that we can detect whether the thrown error likely relates
    // to a lack of support for the Promise ClipboardItem constructor
    promise = navigator.clipboard.write([
      new window.ClipboardItem({
        [MIME_TYPES.png]: blob,
      }),
    ]);
  } catch (error: any) {
    // if we're using a Promise ClipboardItem, let's try constructing
    // with resolution value instead
    if (isPromiseLike(blob)) {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          [MIME_TYPES.png]: await blob,
        }),
      ]);
    } else {
      throw error;
    }
  }
  await promise;
};

export const copyTextToSystemClipboard = async (text: string | null) => {
  let copied = false;
  if (probablySupportsClipboardWriteText) {
    try {
      // NOTE: doesn't work on FF on non-HTTPS domains, or when document
      // not focused
      await navigator.clipboard.writeText(text || "");
      copied = true;
    } catch (error: any) {
      console.error(error);
    }
  }

  // Note that execCommand doesn't allow copying empty strings, so if we're
  // clearing clipboard using this API, we must copy at least an empty char
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
  } catch (error: any) {
    console.error(error);
  }

  textarea.remove();

  return success;
};
