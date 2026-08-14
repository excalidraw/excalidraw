import { convertToExcalidrawElements } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { MermaidConfig } from "@excalidraw/mermaid-to-excalidraw";

import { getSharedMermaidInstance } from "../../obsidianUtils";

import type { MermaidToExcalidrawLibProps } from "./types";
import { BinaryFiles } from "@excalidraw/excalidraw/types";

let mermaidToExcalidrawLib: MermaidToExcalidrawLibProps | null = null;
let queue: Promise<any> = Promise.resolve();

export const loadMermaidToExcalidrawLib =
  async (): Promise<MermaidToExcalidrawLibProps> => {
    //zsviczian - BEGIN
    if (!mermaidToExcalidrawLib?.loaded) {
      try {
        const sharedMermaid = await getSharedMermaidInstance();
        // Cache only ready instances so users can retry after enabling Mermaid.
        mermaidToExcalidrawLib = sharedMermaid.loaded ? sharedMermaid : null;
        return sharedMermaid;
      } catch (error) {
        mermaidToExcalidrawLib = null;
        throw error;
      }
    }
    //zsviczian - END
    return mermaidToExcalidrawLib as MermaidToExcalidrawLibProps;
  };

//zsviczian (replaced bundled mermaid-to-excalidraw with instance from obsidianUtils > Excalidraw Extras plugin)
export const loadMermaidLib =
  async (): Promise<MermaidToExcalidrawLibProps> => {
    if (!mermaidToExcalidrawLib?.loaded) {
      const sharedMermaid = await getSharedMermaidInstance();
      mermaidToExcalidrawLib = sharedMermaid.loaded ? sharedMermaid : null;
      return sharedMermaid;
    }
    return mermaidToExcalidrawLib;
  };

//zsviczian
export const mermaidToExcalidraw = async (
  mermaidDefinition: string,
  opts: MermaidConfig,
): Promise<
  | {
      elements?: ExcalidrawElement[];
      files?: BinaryFiles;
      error?: string;
    }
  | undefined
> => {
  return (queue = queue.then(async () => {
    try {
      const { api } = await loadMermaidToExcalidrawLib();
      const { parseMermaidToExcalidraw } = await api;
      const { elements, files } = await parseMermaidToExcalidraw(
        mermaidDefinition,
        opts,
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
  }));
};
