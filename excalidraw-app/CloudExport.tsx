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

const verifyJWT = async ({
  token,
  publicKey,
}: {
  token: string;
  publicKey: string;
}) => {
  try {
    if (!publicKey) {
      throw new Error("Public key is undefined");
    }

    const [header, payload, signature] = token.split(".");

    if (!header || !payload || !signature) {
      throw new Error("Invalid JWT format");
    }

    const decodeBase64Url = (str: string) => {
      return atob(
        str
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(str.length + ((4 - (str.length % 4)) % 4), "="),
      );
    };

    const decodedPayload = decodeBase64Url(payload);
    const decodedSignature = decodeBase64Url(signature);

    const data = `${header}.${payload}`;
    const signatureArrayBuffer = Uint8Array.from(decodedSignature, (c) =>
      c.charCodeAt(0),
    );

    const keyData = publicKey.replace(/-----\w+ PUBLIC KEY-----/g, "");
    const keyArrayBuffer = Uint8Array.from(atob(keyData), (c) =>
      c.charCodeAt(0),
    );

    const key = await crypto.subtle.importKey(
      "spki",
      keyArrayBuffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["verify"],
    );

    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signatureArrayBuffer,
      new TextEncoder().encode(data),
    );

    if (!isValid) {
      throw new Error("Invalid JWT");
    }

    const parsedPayload = JSON.parse(decodedPayload);

    // Check for expiration
    const currentTime = Math.floor(Date.now() / 1000);
    if (parsedPayload.exp && parsedPayload.exp < currentTime) {
      throw new Error("JWT has expired");
    }
  } catch (error) {
    console.error("Failed to verify JWT:", error);
    throw new Error(error instanceof Error ? error.message : "Invalid JWT");
  }
};

export const CloudExport = () => {
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== EXCALIDRAW_PLUS_ORIGIN) {
        return;
      }

      if (event.data.type === REQUEST_SCENE && event.data.jwt) {
        const token = event.data.jwt;

        try {
          await verifyJWT({
            token,
            publicKey: import.meta.env.VITE_APP_OSS_SCENE_IMPORT_PUBLIC_KEY,
          });

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
        } catch (error) {
          console.error("Failed to verify JWT:", error);
          if (event.source) {
            const responseData: ParsedSceneData = {
              status: "error",
              errorMsg: error instanceof Error ? error.message : "Invalid JWT",
            };
            event.source.postMessage(responseData, {
              targetOrigin: event.origin,
            });
          }
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
