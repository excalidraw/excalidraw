import { base64urlToString } from "@excalidraw/excalidraw/data/encode";
import { ExcalidrawError } from "@excalidraw/excalidraw/errors";
import { useLayoutEffect, useRef, useMemo } from "react";

import type {
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type { AppState, BinaryFileData } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "./app_constants";
import { LocalData } from "./data/LocalData";

const EVENT_REQUEST_SCENE = "REQUEST_SCENE";
const EXCALIDRAW_PLUS_ORIGIN = import.meta.env.VITE_APP_PLUS_APP;

// Tipagens (mantidas do original)
type MESSAGE_REQUEST_SCENE = { type: "REQUEST_SCENE"; jwt: string };
type MESSAGE_FROM_PLUS = MESSAGE_REQUEST_SCENE;
type MESSAGE_READY = { type: "READY" };
type MESSAGE_ERROR = { type: "ERROR"; message: string };
type MESSAGE_SCENE_DATA = {
  type: "SCENE_DATA";
  elements: OrderedExcalidrawElement[];
  appState: Pick<AppState, "viewBackgroundColor">;
  files: { loadedFiles: BinaryFileData[]; erroredFiles: Map<FileId, true> };
};
type MESSAGE_FROM_EDITOR = MESSAGE_ERROR | MESSAGE_SCENE_DATA | MESSAGE_READY;

// ============================================================================
// 1. Aplicação do SRP (Princípio da Responsabilidade Única)
// Serviço dedicado exclusivamente a lidar com JWT e Criptografia
// ============================================================================
class JwtValidatorService {
  static async verify(token: string, publicKey: string): Promise<void> {
    try {
      if (!publicKey) {
        throw new ExcalidrawError("Public key is undefined");
      }

      const [header, payload, signature] = token.split(".");
      if (!header || !payload || !signature) {
        throw new ExcalidrawError("Invalid JWT format");
      }

      const decodedPayload = base64urlToString(payload);
      const decodedSignature = base64urlToString(signature);
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
      const currentTime = Math.floor(Date.now() / 1000);
      if (parsedPayload.exp && parsedPayload.exp < currentTime) {
        throw new Error("JWT has expired");
      }
    } catch (error) {
      console.error("Failed to verify JWT:", error);
      throw new Error(error instanceof Error ? error.message : "Invalid JWT");
    }
  }
}

// ============================================================================
// 2. Aplicação do DIP (Inversão de Dependência) e Design Pattern ADAPTER
// O sistema agora depende de uma abstração (Interface) e não do LocalStorage direto.
// ============================================================================
interface ISceneDataStorage {
  getRawElements(): string | null;
  getRawAppState(): string | null;
}

class LocalStorageSceneAdapter implements ISceneDataStorage {
  getRawElements(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
  }
  getRawAppState(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
  }
}

// ============================================================================
// 3. Aplicação do Design Pattern FACADE
// Esconde a complexidade de buscar, parsear e montar a mensagem.
// ============================================================================
class SceneExportFacade {
  private storageAdapter: ISceneDataStorage;

  constructor(storageAdapter: ISceneDataStorage) {
    this.storageAdapter = storageAdapter;
  }

  async exportSceneData(jwtToken: string): Promise<MESSAGE_SCENE_DATA> {
    // 1. Valida o Token
    await JwtValidatorService.verify(
      jwtToken,
      import.meta.env.VITE_APP_PLUS_EXPORT_PUBLIC_KEY,
    );

    // 2. Pega os dados através do adaptador (sem saber que é LocalStorage)
    const rawElementsString = this.storageAdapter.getRawElements();
    const rawAppStateString = this.storageAdapter.getRawAppState();

    if (!rawElementsString || !rawAppStateString) {
      throw new ExcalidrawError("Elements or appstate is missing.");
    }

    const elements = JSON.parse(
      rawElementsString,
    ) as OrderedExcalidrawElement[];
    if (!elements.length) {
      throw new ExcalidrawError("Scene is empty, nothing to export.");
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

    return { type: "SCENE_DATA", elements, appState, files };
  }
}

// ============================================================================
// COMPONENTE REACT REFATORADO
// Agora ele só se preocupa em escutar mensagens e delegar o trabalho para a Fachada.
// ============================================================================
export const ExcalidrawPlusIframeExport = () => {
  const readyRef = useRef(false);

  // Instanciando a Fachada usando useMemo para manter a referência estável entre as renderizações
  const exportFacade = useMemo(() => {
    const adapter = new LocalStorageSceneAdapter();
    return new SceneExportFacade(adapter);
  }, []);

  useLayoutEffect(() => {
    const handleMessage = async (event: MessageEvent<MESSAGE_FROM_PLUS>) => {
      if (event.origin !== EXCALIDRAW_PLUS_ORIGIN) {
        throw new ExcalidrawError("Invalid origin");
      }

      if (event.data.type === EVENT_REQUEST_SCENE) {
        if (!event.data.jwt) {
          throw new ExcalidrawError("JWT is missing");
        }

        try {
          // Todo o trabalho sujo de validar JWT, buscar e parsear dados acontece aqui, em 1 linha
          const parsedSceneData = await exportFacade.exportSceneData(
            event.data.jwt,
          );

          event.source!.postMessage(parsedSceneData, {
            targetOrigin: EXCALIDRAW_PLUS_ORIGIN,
          });
        } catch (error: any) {
          console.error(error);
          const responseData: MESSAGE_ERROR = {
            type: "ERROR",
            message:
              error instanceof ExcalidrawError || error instanceof Error
                ? error.message
                : "Failed to export scene data",
          };
          event.source!.postMessage(responseData, {
            targetOrigin: EXCALIDRAW_PLUS_ORIGIN,
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);

    if (!readyRef.current) {
      readyRef.current = true;
      const message: MESSAGE_FROM_EDITOR = { type: "READY" };
      window.parent.postMessage(message, EXCALIDRAW_PLUS_ORIGIN);
    }

    return () => window.removeEventListener("message", handleMessage);
  }, [exportFacade]);

  return null;
};
