import { THEME } from "@excalidraw/common";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  exportToBlob,
  exportToClipboard,
  exportToSvg,
} from "@excalidraw/excalidraw";
import { nanoid } from "nanoid";

import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

type ExportFormat = "svg" | "png" | "clipboard";

const DEFAULT_DARK_BACKGROUND = "#121212";

export interface ExcalidrawAPIRequest {
  action: "create" | "export" | "import";
  elements?: ExcalidrawElement[];
  appState?: AppState | null;
  files?: BinaryFiles | null;
  format?: ExportFormat;
}

export interface ExcalidrawAPIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class ExcalidrawAPI {
  private static instance: ExcalidrawAPI;
  private excalidrawRef: ExcalidrawImperativeAPI | null = null;

  private constructor() {}

  static getInstance(): ExcalidrawAPI {
    if (!ExcalidrawAPI.instance) {
      ExcalidrawAPI.instance = new ExcalidrawAPI();
    }
    return ExcalidrawAPI.instance;
  }

  setExcalidrawRef(ref: ExcalidrawImperativeAPI | null) {
    this.excalidrawRef = ref;
  }

  async handleRequest(
    request: ExcalidrawAPIRequest,
  ): Promise<ExcalidrawAPIResponse> {
    try {
      switch (request.action) {
        case "create":
          return this.createElements(request.elements || []);
        case "export":
          return await this.exportDrawing(
            request.elements || [],
            request.appState,
            request.files,
            request.format,
          );
        case "import":
          return this.importElements(request.elements || [], request.appState);
        default:
          return {
            success: false,
            error: "Invalid action. Supported actions: create, export, import",
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown error occurred",
      };
    }
  }

  private createElements(elements: ExcalidrawElement[]): ExcalidrawAPIResponse {
    if (!this.excalidrawRef) {
      return {
        success: false,
        error: "Excalidraw not initialized",
      };
    }

    // Normalize elements to ensure all required properties are present
    const normalizedElements = elements.map((element) =>
      this.normalizeElement(element),
    );

    const currentAppState = this.excalidrawRef.getAppState();
    this.excalidrawRef.updateScene({
      elements: normalizedElements,
      appState: this.withDarkTheme(currentAppState),
    });

    return {
      success: true,
      data: { elements: normalizedElements },
    };
  }

  private normalizeElement(element: any): ExcalidrawElement {
    // Generate random seed and versionNonce if not provided
    const seed = element.seed ?? Math.floor(Math.random() * 2 ** 31);
    const versionNonce =
      element.versionNonce ?? Math.floor(Math.random() * 2 ** 31);

    // Base properties required for all elements
    const baseElement = {
      id: element.id || nanoid(),
      type: element.type,
      x: element.x ?? 0,
      y: element.y ?? 0,
      angle: element.angle ?? 0,
      strokeColor: element.strokeColor ?? "#1e1e1e",
      backgroundColor: element.backgroundColor ?? "transparent",
      fillStyle: element.fillStyle ?? "solid",
      strokeWidth: element.strokeWidth ?? 2,
      strokeStyle: element.strokeStyle ?? "solid",
      roughness: element.roughness ?? 0,
      opacity: element.opacity ?? 100,
      groupIds: element.groupIds ?? [],
      frameId: element.frameId ?? null,
      seed,
      versionNonce,
      isDeleted: false,
      boundElements: element.boundElements ?? null,
      updated: element.updated ?? 1,
      link: element.link ?? null,
      locked: element.locked ?? false,
    };

    // Type-specific properties
    switch (element.type) {
      case "rectangle":
      case "diamond":
      case "ellipse":
        return {
          ...baseElement,
          width: element.width ?? 100,
          height: element.height ?? 100,
          roundness:
            element.roundness ??
            (element.type === "rectangle" ? { type: 3 } : null),
        } as any;

      case "arrow":
      case "line":
        return {
          ...baseElement,
          width: element.width ?? 0,
          height: element.height ?? 0,
          points: element.points ?? [
            [0, 0],
            [100, 0],
          ],
          lastCommittedPoint: element.lastCommittedPoint ?? null,
          startBinding: element.startBinding ?? null,
          endBinding: element.endBinding ?? null,
          startArrowhead: element.startArrowhead ?? null,
          endArrowhead:
            element.endArrowhead ?? (element.type === "arrow" ? "arrow" : null),
          roundness: element.roundness ?? null,
        } as any;

      case "text":
        return {
          ...baseElement,
          width: element.width ?? 100,
          height: element.height ?? 25,
          text: element.text ?? "",
          fontSize: element.fontSize ?? 20,
          fontFamily: element.fontFamily ?? 1,
          textAlign: element.textAlign ?? "left",
          verticalAlign: element.verticalAlign ?? "top",
          containerId: element.containerId ?? null,
          originalText: element.originalText ?? element.text ?? "",
          lineHeight: element.lineHeight ?? 1.25,
          autoResize: element.autoResize ?? true,
        } as any;

      case "image":
        return {
          ...baseElement,
          width: element.width ?? 100,
          height: element.height ?? 100,
          fileId: element.fileId ?? null,
          scale: element.scale ?? [1, 1],
          status: element.status ?? "pending",
          roundness: element.roundness ?? null,
        } as any;

      case "freedraw":
        return {
          ...baseElement,
          width: element.width ?? 0,
          height: element.height ?? 0,
          points: element.points ?? [[0, 0]],
          pressures: element.pressures ?? [],
          simulatePressure: element.simulatePressure ?? true,
          lastCommittedPoint: element.lastCommittedPoint ?? null,
          roundness: element.roundness ?? null,
        } as any;

      default:
        // Fallback for unknown types
        return {
          ...baseElement,
          width: element.width ?? 100,
          height: element.height ?? 100,
        } as any;
    }
  }

  private async exportDrawing(
    elements: ExcalidrawElement[],
    appState: AppState | null | undefined,
    files: BinaryFiles | null | undefined,
    format: ExportFormat = "svg",
  ): Promise<ExcalidrawAPIResponse> {
    if (!this.excalidrawRef) {
      return {
        success: false,
        error: "Excalidraw not initialized",
      };
    }

    try {
      const activeElements = elements || [];
      const binaryFiles = files ?? null;
      const exportAppState = this.getDarkModeExportAppState(appState);

      switch (format) {
        case "svg": {
          const svg = await exportToSvg({
            elements: activeElements,
            appState: exportAppState,
            files: binaryFiles ?? null,
          });

          return {
            success: true,
            data: {
              export: svg.outerHTML,
              format,
            },
          };
        }

        case "png": {
          const blob = await exportToBlob({
            elements: activeElements,
            appState: exportAppState,
            files: binaryFiles ?? null,
            mimeType: "image/png",
          });

          return {
            success: true,
            data: {
              export: await this.blobToDataURL(blob),
              format,
            },
          };
        }

        case "clipboard": {
          await exportToClipboard({
            elements: activeElements,
            appState: exportAppState,
            files: binaryFiles ?? null,
            type: "png",
          });

          return {
            success: true,
            data: { export: "Copied to clipboard", format },
          };
        }

        default:
          return {
            success: false,
            error: "Unsupported export format. Use: svg, png, or clipboard",
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Export failed: ${error?.message || "Unknown error"}`,
      };
    }
  }

  private importElements(
    elements: ExcalidrawElement[],
    appState: AppState | null | undefined,
  ): ExcalidrawAPIResponse {
    if (!this.excalidrawRef) {
      return {
        success: false,
        error: "Excalidraw not initialized",
      };
    }

    // Normalize elements to ensure all required properties are present
    const normalizedElements = elements.map((element) =>
      this.normalizeElement(element),
    );

    const baseAppState = appState
      ? { ...this.excalidrawRef.getAppState(), ...appState }
      : this.excalidrawRef.getAppState();
    const updatePayload = {
      elements: normalizedElements,
      appState: this.withDarkTheme(baseAppState),
    } as Parameters<ExcalidrawImperativeAPI["updateScene"]>[0];

    this.excalidrawRef.updateScene(updatePayload);

    return {
      success: true,
      data: { imported: normalizedElements.length },
    };
  }

  private getDarkModeExportAppState(
    appState?: AppState | null,
  ): Partial<Omit<AppState, "offsetTop" | "offsetLeft">> {
    const baseAppState =
      appState ??
      this.excalidrawRef?.getAppState() ??
      this.createFallbackAppState();
    const darkAppState = this.withDarkTheme(baseAppState, { forExport: true });
    const {
      offsetLeft: _offsetLeft,
      offsetTop: _offsetTop,
      ...rest
    } = darkAppState;
    return rest;
  }

  private withDarkTheme(
    baseAppState: AppState,
    opts: { forExport?: boolean } = {},
  ): AppState {
    const state: AppState = { ...baseAppState };
    state.theme = THEME.DARK;
    state.viewBackgroundColor =
      state.viewBackgroundColor || DEFAULT_DARK_BACKGROUND;
    if (opts.forExport) {
      state.exportWithDarkMode = true;
      state.exportBackground = true;
    }
    return state;
  }

  private createFallbackAppState(): AppState {
    return {
      width: 0,
      height: 0,
      offsetTop: 0,
      offsetLeft: 0,
      ...getDefaultAppState(),
    } as AppState;
  }

  private blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to convert blob to data URL"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  // Helper method to create basic shapes. Useful for quick demos of the API.
  createBasicShapes() {
    const rectangle = {
      id: nanoid(),
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      angle: 0,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      seed: Math.floor(Math.random() * 2 ** 31),
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
    };

    const circle = {
      id: nanoid(),
      type: "ellipse",
      x: 400,
      y: 100,
      width: 150,
      height: 150,
      angle: 0,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: Math.floor(Math.random() * 2 ** 31),
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
    };

    return [rectangle, circle];
  }
}

// Global API instance
export const excalidrawAPI = ExcalidrawAPI.getInstance();

// Expose API globally for browser access
declare global {
  interface Window {
    ExcalidrawAPI: typeof ExcalidrawAPI;
    excalidrawAPI: ExcalidrawAPI;
  }
}

if (typeof window !== "undefined") {
  window.ExcalidrawAPI = ExcalidrawAPI;
  window.excalidrawAPI = excalidrawAPI;
}
