import { Spreadsheet, tryParseSpreadsheet, VALID_SPREADSHEET } from "./charts";
import { contentsContainAppElements } from "./data/json";
import { ExcalidrawElement } from "./element/types";
import { BinaryFiles } from "./types";

export interface ParsedData {
  spreadsheet?: Spreadsheet;
  elements?: readonly ExcalidrawElement[];
  files?: BinaryFiles;
  text?: string;
  errorMessage?: string;
}

export const parsePotentialSpreadsheet = (
  text: string,
): { spreadsheet: Spreadsheet } | { errorMessage: string } | null => {
  const result = tryParseSpreadsheet(text);
  if (result.type === VALID_SPREADSHEET) {
    return { spreadsheet: result.spreadsheet };
  }
  return null;
};

export const parseText = async (text: string): Promise<ParsedData> => {
  const spreadsheetResult = parsePotentialSpreadsheet(text);
  if (spreadsheetResult) {
    return spreadsheetResult;
  }

  try {
    const appData = JSON.parse(text);
    if (contentsContainAppElements(appData)) {
      return {
        elements: appData.elements,
        files: appData.files,
      };
    }
  } catch {}

  return { text };
};

export const isValidLink = (text: string): boolean => {
  const rs_url_origin =
    // protocol identifier
    "(?:(?:(?:https?|ftp)://)|www.)" +
    // host name
    "(?:(?:[a-z\\u00a1-\\uffff0-9]-?)*[a-z\\u00a1-\\uffff0-9]+)" +
    // domain name
    "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-?)*[a-z\\u00a1-\\uffff0-9]+)*" +
    // TLD identifier
    "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))";

  const rs_url_resourcePath = "(?:[/?#]\\S*)?";

  const re_url = new RegExp(`^${rs_url_origin}${rs_url_resourcePath}$`, "i");

  return re_url.test(text);
};
