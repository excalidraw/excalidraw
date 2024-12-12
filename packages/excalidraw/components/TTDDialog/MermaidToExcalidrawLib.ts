import { MermaidConfig } from "@zsviczian/mermaid-to-excalidraw";
import { convertToExcalidrawElements } from "../../data/transform";
import { ExcalidrawElement } from "../../element/types";
import { MermaidToExcalidrawLibProps } from "./common";

let mermaidToExcalidrawLib: MermaidToExcalidrawLibProps | null = null;
let queue: Promise<any> = Promise.resolve();

export const loadMermaidToExcalidrawLib = async (): Promise<MermaidToExcalidrawLibProps> => {
  if (!mermaidToExcalidrawLib) {
    const api = import("@zsviczian/mermaid-to-excalidraw").then(module => ({
      parseMermaidToExcalidraw: module.parseMermaidToExcalidraw,
    }));
    mermaidToExcalidrawLib = {
      loaded: true,
      api,
    };
  }
  return mermaidToExcalidrawLib;
};

//zsviczian
export const mermaidToExcalidraw = async (
  mermaidDefinition: string,
  opts: MermaidConfig,
  forceSVG: boolean = false,
): Promise<
  | {
      elements?: ExcalidrawElement[];
      files?: any;
      error?: string;
    }
  | undefined
> => {
  return queue = queue.then(async () => {
    try {
      const { api } = await loadMermaidToExcalidrawLib();
      const { parseMermaidToExcalidraw } = await api;
      const { elements, files } = await parseMermaidToExcalidraw(
        mermaidDefinition,
        opts,
        forceSVG,
      );

      return {
        elements: convertToExcalidrawElements(
          elements.map((el) => {
            if (el.type === "image") {
              el.customData = { mermaidText: mermaidDefinition };
            }
            return el;
          }),
          {
            regenerateIds: true,
          },
        ),
        files,
      };
    } catch (e: any) {
      return {
        error: e.message,
      };
    }
  });
};