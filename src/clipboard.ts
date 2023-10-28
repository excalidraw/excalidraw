import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "./element/types";
import { BinaryFiles } from "./types";
import { tryParseSpreadsheet, Spreadsheet, VALID_SPREADSHEET } from "./charts";
import {
  ALLOWED_PASTE_MIME_TYPES,
  EXPORT_DATA_TYPES,
  MIME_TYPES,
} from "./constants";
import { isInitializedImageElement } from "./element/typeChecks";
import { deepCopyElement } from "./element/newElement";
import { mutateElement } from "./element/mutateElement";
import { getContainingFrame } from "./frame";
import { isMemberOf, isPromiseLike } from "./utils";
import { t } from "./i18n";

type ElementsClipboard = {
  type: typeof EXPORT_DATA_TYPES.excalidrawClipboard;
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles | undefined;
};

export type PastedMixedContent = { type: "text" | "imageUrl"; value: string }[];

export interface ClipboardData {
  spreadsheet?: Spreadsheet;
  elements?: readonly ExcalidrawElement[];
  files?: BinaryFiles;
  text?: string;
  mixedContent?: PastedMixedContent;
  errorMessage?: string;
  programmaticAPI?: boolean;
}

type AllowedPasteMimeTypes = typeof ALLOWED_PASTE_MIME_TYPES[number];

type ParsedClipboardEvent =
  | { type: "text"; value: string }
  | { type: "mixedContent"; value: PastedMixedContent };

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
      EXPORT_DATA_TYPES.excalidrawClipboardWithAPI,
    ].includes(contents?.type) &&
    Array.isArray(contents.elements)
  ) {
    return true;
  }
  return false;
};

export const createPasteEvent = ({
  types,
  files,
}: {
  types?: { [key in AllowedPasteMimeTypes]?: string };
  files?: File[];
}) => {
  if (!types && !files) {
    console.warn("createPasteEvent: no types or files provided");
  }

  const event = new ClipboardEvent("paste", {
    clipboardData: new DataTransfer(),
  });

  if (types) {
    for (const [type, value] of Object.entries(types)) {
      try {
        event.clipboardData?.setData(type, value);
        if (event.clipboardData?.getData(type) !== value) {
          throw new Error(`Failed to set "${type}" as clipboardData item`);
        }
      } catch (error: any) {
        throw new Error(error.message);
      }
    }
  }

  if (files) {
    let idx = -1;
    for (const file of files) {
      idx++;
      try {
        event.clipboardData?.items.add(file);
        if (event.clipboardData?.files[idx] !== file) {
          throw new Error(
            `Failed to set file "${file.name}" as clipboardData item`,
          );
        }
      } catch (error: any) {
        throw new Error(error.message);
      }
    }
  }

  return event;
};

export const serializeAsClipboardJSON = ({
  elements,
  files,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles | null;
}) => {
  const framesToCopy = new Set(
    elements.filter((element) => element.type === "frame"),
  );
  let foundFile = false;

  const _files = elements.reduce((acc, element) => {
    if (isInitializedImageElement(element)) {
      foundFile = true;
      if (files && files[element.fileId]) {
        acc[element.fileId] = files[element.fileId];
      }
    }
    return acc;
  }, {} as BinaryFiles);

  if (foundFile && !files) {
    console.warn(
      "copyToClipboard: attempting to file element(s) without providing associated `files` object.",
    );
  }

  // select bound text elements when copying
  const contents: ElementsClipboard = {
    type: EXPORT_DATA_TYPES.excalidrawClipboard,
    elements: elements.map((element) => {
      if (
        getContainingFrame(element) &&
        !framesToCopy.has(getContainingFrame(element)!)
      ) {
        const copiedElement = deepCopyElement(element);
        mutateElement(copiedElement, {
          frameId: null,
        });
        return copiedElement;
      }

      return element;
    }),
    files: files ? _files : undefined,
  };

  return JSON.stringify(contents);
};

export const copyToClipboard = async (
  elements: readonly NonDeletedExcalidrawElement[],
  files: BinaryFiles | null,
  /** supply if available to make the operation more certain to succeed */
  clipboardEvent?: ClipboardEvent | null,
) => {
  await copyTextToSystemClipboard(
    serializeAsClipboardJSON({ elements, files }),
    clipboardEvent,
  );
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

/** internal, specific to parsing paste events. Do not reuse. */
function parseHTMLTree(el: ChildNode) {
  let result: PastedMixedContent = [];
  for (const node of el.childNodes) {
    if (node.nodeType === 3) {
      const text = node.textContent?.trim();
      if (text) {
        result.push({ type: "text", value: text });
      }
    } else if (node instanceof HTMLImageElement) {
      const url = node.getAttribute("src");
      if (url && url.startsWith("http")) {
        result.push({ type: "imageUrl", value: url });
      }
    } else {
      result = result.concat(parseHTMLTree(node));
    }
  }
  return result;
}

const maybeParseHTMLPaste = (
  event: ClipboardEvent,
): { type: "mixedContent"; value: PastedMixedContent } | null => {
  const html = event.clipboardData?.getData("text/html");

  if (!html) {
    return null;
  }

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    const content = parseHTMLTree(doc.body);

    if (content.length) {
      return { type: "mixedContent", value: content };
    }
  } catch (error: any) {
    console.error(`error in parseHTMLFromPaste: ${error.message}`);
  }

  return null;
};

export const readSystemClipboard = async () => {
  const types: { [key in AllowedPasteMimeTypes]?: string } = {};

  try {
    if (navigator.clipboard?.readText) {
      return { "text/plain": await navigator.clipboard?.readText() };
    }
  } catch (error: any) {
    // @ts-ignore
    if (navigator.clipboard?.read) {
      console.warn(
        `navigator.clipboard.readText() failed (${error.message}). Failling back to navigator.clipboard.read()`,
      );
    } else {
      throw error;
    }
  }

  let clipboardItems: ClipboardItems;

  try {
    clipboardItems = await navigator.clipboard?.read();
  } catch (error: any) {
    if (error.name === "DataError") {
      console.warn(
        `navigator.clipboard.read() error, clipboard is probably empty: ${error.message}`,
      );
      return types;
    }
    throw error;
  }

  for (const item of clipboardItems) {
    for (const type of item.types) {
      if (!isMemberOf(ALLOWED_PASTE_MIME_TYPES, type)) {
        continue;
      }
      try {
        types[type] = await (await item.getType(type)).text();
      } catch (error: any) {
        console.warn(
          `Cannot retrieve ${type} from clipboardItem: ${error.message}`,
        );
      }
    }
  }

  if (Object.keys(types).length === 0) {
    console.warn("No clipboard data found from clipboard.read().");
    return types;
  }

  return types;
};

/**
 * Parses "paste" ClipboardEvent.
 */
const parseClipboardEvent = async (
  event: ClipboardEvent,
  isPlainPaste = false,
): Promise<ParsedClipboardEvent> => {
  try {
    const mixedContent = !isPlainPaste && event && maybeParseHTMLPaste(event);

    if (mixedContent) {
      if (mixedContent.value.every((item) => item.type === "text")) {
        return {
          type: "text",
          value:
            event.clipboardData?.getData("text/plain") ||
            mixedContent.value
              .map((item) => item.value)
              .join("\n")
              .trim(),
        };
      }

      return mixedContent;
    }

    const text = event.clipboardData?.getData("text/plain");

    return { type: "text", value: (text || "").trim() };
  } catch {
    return { type: "text", value: "" };
  }
};

/**
 * Attempts to parse clipboard. Prefers system clipboard.
 */
export const parseClipboard = async (
  event: ClipboardEvent,
  isPlainPaste = false,
): Promise<ClipboardData> => {
  const parsedEventData = await parseClipboardEvent(event, isPlainPaste);

  if (parsedEventData.type === "mixedContent") {
    return {
      mixedContent: parsedEventData.value,
    };
  }

  try {
    // if system clipboard contains spreadsheet, use it even though it's
    // technically possible it's staler than in-app clipboard
    const spreadsheetResult =
      !isPlainPaste && parsePotentialSpreadsheet(parsedEventData.value);

    if (spreadsheetResult) {
      return spreadsheetResult;
    }
  } catch (error: any) {
    console.error(error);
  }

  try {
    const systemClipboardData = JSON.parse(parsedEventData.value);
    const programmaticAPI =
      systemClipboardData.type === EXPORT_DATA_TYPES.excalidrawClipboardWithAPI;
    if (clipboardContainsElements(systemClipboardData)) {
      return {
        elements: systemClipboardData.elements,
        files: systemClipboardData.files,
        text: isPlainPaste
          ? JSON.stringify(systemClipboardData.elements, null, 2)
          : undefined,
        programmaticAPI,
      };
    }
  } catch {}

  return { text: parsedEventData.value };
};

export const copyBlobToClipboardAsPng = async (blob: Blob | Promise<Blob>) => {
  try {
    // in Safari so far we need to construct the ClipboardItem synchronously
    // (i.e. in the same tick) otherwise browser will complain for lack of
    // user intent. Using a Promise ClipboardItem constructor solves this.
    // https://bugs.webkit.org/show_bug.cgi?id=222262
    //
    // Note that Firefox (and potentially others) seems to support Promise
    // ClipboardItem constructor, but throws on an unrelated MIME type error.
    // So we need to await this and fallback to awaiting the blob if applicable.
    await navigator.clipboard.write([
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
};

export const copyTextToSystemClipboard = async (
  text: string | null,
  clipboardEvent?: ClipboardEvent | null,
) => {
  // (1) first try using Async Clipboard API
  if (probablySupportsClipboardWriteText) {
    try {
      // NOTE: doesn't work on FF on non-HTTPS domains, or when document
      // not focused
      await navigator.clipboard.writeText(text || "");
      return;
    } catch (error: any) {
      console.error(error);
    }
  }

  // (2) if fails and we have access to ClipboardEvent, use plain old setData()
  try {
    if (clipboardEvent) {
      clipboardEvent.clipboardData?.setData("text/plain", text || "");
      if (clipboardEvent.clipboardData?.getData("text/plain") !== text) {
        throw new Error("Failed to setData on clipboardEvent");
      }
      return;
    }
  } catch (error: any) {
    console.error(error);
  }

  // (3) if that fails, use document.execCommand
  if (!copyTextViaExecCommand(text)) {
    throw new Error(t("errors.copyToSystemClipboardFailed"));
  }
};

// adapted from https://github.com/zenorocha/clipboard.js/blob/ce79f170aa655c408b6aab33c9472e8e4fa52e19/src/clipboard-action.js#L48
const copyTextViaExecCommand = (text: string | null) => {
  // execCommand doesn't allow copying empty strings, so if we're
  // clearing clipboard using this API, we must copy at least an empty char
  if (!text) {
    text = " ";
  }

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
