import { useEffect } from "react";
import { STORAGE_KEYS } from "./app_constants";
import { LocalData } from "./data/LocalData";
import type {
  FileId,
  OrderedExcalidrawElement,
} from "../packages/excalidraw/element/types";
import type { AppState, BinaryFileData } from "../packages/excalidraw/types";

const REQUEST_SCENE = "REQUEST_SCENE";
const E_PLUS_DEV_URL = "http://localhost:3000";

const EXCALIDRAW_PLUS_ORIGIN = import.meta.env.PROD
  ? import.meta.env.VITE_APP_PLUS_APP
  : E_PLUS_DEV_URL;

type ParsedSceneData =
  | {
      status: "success";
      elements: OrderedExcalidrawElement[];
      appState: Pick<AppState, "viewBackgroundColor">;
      files: { loadedFiles: BinaryFileData[]; erroredFiles: Map<FileId, true> };
    }
  | { status: "error"; errorMsg: string };

const parseSceneData = async ({
  rawElementsString,
  rawAppStateString,
}: {
  rawElementsString: string | null;
  rawAppStateString: string | null;
}): Promise<ParsedSceneData> => {
  if (!rawElementsString || !rawAppStateString) {
    return { status: "error", errorMsg: "Elements or appstate is missing." };
  }

  try {
    const elements = JSON.parse(
      rawElementsString,
    ) as OrderedExcalidrawElement[];

    if (!elements.length) {
      return {
        status: "error",
        errorMsg: "Scene is empty, nothing to export.",
      };
    }

    const appState = JSON.parse(rawAppStateString) as Pick<
      AppState,
      "viewBackgroundColor"
    >;

    const fileIds = elements.reduce((acc, el) => {
      if ("fileId" in el && el.fileId) {
        acc.push(el.fileId);
      }
      return acc;
    }, [] as FileId[]);

    const files = await LocalData.fileStorage.getFiles(fileIds);

    return {
      status: "success",
      elements,
      appState,
      files,
    };
  } catch {
    return { status: "error", errorMsg: "Failed to parse scene data." };
  }
};

export const CloudExport = () => {
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== EXCALIDRAW_PLUS_ORIGIN) {
        return;
      }

      if (event.data.msg === REQUEST_SCENE) {
        const parsedSceneData = await parseSceneData({
          rawAppStateString: localStorage.getItem(
            STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
          ),
          rawElementsString: localStorage.getItem(
            STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
          ),
        });

        const responseData: ParsedSceneData =
          parsedSceneData.status === "success"
            ? parsedSceneData
            : { status: "error", errorMsg: parsedSceneData.errorMsg };

        if (event.source) {
          event.source.postMessage(responseData, {
            targetOrigin: event.origin,
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Since this component is expected to run in a hidden iframe on Excaildraw+,
  // it doesn't need to render anything. All the data we need is available in
  // LocalStorage and IndexedDB. It only needs to handle the messaging between
  // the parent window and the iframe with the relevant data.
  return null;
};
