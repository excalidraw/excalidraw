import fs from "fs";
import path from "path";
import util from "util";

import { pointFrom, type LocalPoint, type Radians } from "@excalidraw/math";

import { DEFAULT_VERTICAL_ALIGN, ROUNDNESS, assertNever } from "@excalidraw/common";

import {
  newArrowElement,
  newElement,
  newEmbeddableElement,
  newFrameElement,
  newFreeDrawElement,
  newIframeElement,
  newImageElement,
  newLinearElement,
  newMagicFrameElement,
  newTextElement,
} from "@excalidraw/element";

import { isLinearElementType } from "@excalidraw/element";
import { getSelectedElements } from "@excalidraw/element";
import { selectGroupsForSelectedElements } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawGenericElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawImageElement,
  FileId,
  ExcalidrawFrameElement,
  ExcalidrawElementType,
  ExcalidrawMagicFrameElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawArrowElement,
  FixedSegment,
} from "@excalidraw/element/types";

import type { Mutable } from "@excalidraw/common/utility-types";

import { getMimeType } from "../../data/blob";
import { createTestHook } from "../../components/App";
import { getDefaultAppState } from "../../appState";
import { GlobalTestState, createEvent, fireEvent, act } from "../test-utils";

import type { Action } from "../../actions/types";
import type App from "../../components/App";
import type { AppState } from "../../types";


const readFile = util.promisify(fs.readFile);
// so that window.h is available when App.tsx is not imported as well.
createTestHook();

const { h } = window;

export class API {
  static updateScene: InstanceType<typeof App>["updateScene"] = (...args) => {
    act(() => {
      h.app.updateScene(...args);
    });
  };
  static setAppState: React.Component<any, AppState>["setState"] = (
    state,
    cb,
  ) => {
    act(() => {
      h.setState(state, cb);
    });
  };

  static setElements = (elements: readonly ExcalidrawElement[]) => {
    act(() => {
      h.elements = elements;
    });
  };

  static setSelectedElements = (elements: ExcalidrawElement[], editingGroupId?: string | null) => {
    act(() => {
      h.setState({
        ...selectGroupsForSelectedElements(
        {
          editingGroupId: editingGroupId ?? null,
          selectedElementIds: elements.reduce((acc, element) => {
            acc[element.id] = true;
            return acc;
          }, {} as Record<ExcalidrawElement["id"], true>),
        },
        elements,
        h.state,
        h.app,
        )
      });
    });
  };

  // eslint-disable-next-line prettier/prettier
  static updateElement = <T extends ExcalidrawElement>(
    ...args: Parameters<typeof h.app.scene.mutateElement<T>>
  ) => {
    act(() => {
      h.app.scene.mutateElement(...args);
    });
  };

  static getSelectedElements = (
    includeBoundTextElement: boolean = false,
    includeElementsInFrames: boolean = false,
  ): ExcalidrawElement[] => {
    return getSelectedElements(h.elements, h.state, {
      includeBoundTextElement,
      includeElementsInFrames,
    });
  };

  static getSelectedElement = (): ExcalidrawElement => {
    const selectedElements = API.getSelectedElements();
    if (selectedElements.length !== 1) {
      throw new Error(
        `expected 1 selected element; got ${selectedElements.length}`,
      );
    }
    return selectedElements[0];
  };

  static getUndoStack = () => {
    // @ts-ignore
    return h.history.undoStack;
  };

  static getRedoStack = () => {
    // @ts-ignore
    return h.history.redoStack;
  };

  static getSnapshot = () => {
    return Array.from(h.store.snapshot.elements.values());
  };

  static clearSelection = () => {
    act(() => {
      // @ts-ignore
      h.app.clearSelection(null);
    });
    expect(API.getSelectedElements().length).toBe(0);
  };

  static getElement = <T extends ExcalidrawElement>(element: T): T => {
    return h.app.scene.getElementsMapIncludingDeleted().get(element.id) as T || element;
  }

  static createElement = <
    T extends Exclude<ExcalidrawElementType, "selection"> = "rectangle",
  >({
    // @ts-ignore
    type = "rectangle",
    id,
    x = 0,
    y = x,
    width = 100,
    height = width,
    isDeleted = false,
    groupIds = [],
    ...rest
  }: {
    type?: T;
    x?: number;
    y?: number;
    height?: number;
    width?: number;
    angle?: number;
    id?: string;
    isDeleted?: boolean;
    frameId?: ExcalidrawElement["id"] | null;
    index?: ExcalidrawElement["index"];
    groupIds?: ExcalidrawElement["groupIds"];
    // generic element props
    strokeColor?: ExcalidrawGenericElement["strokeColor"];
    backgroundColor?: ExcalidrawGenericElement["backgroundColor"];
    fillStyle?: ExcalidrawGenericElement["fillStyle"];
    strokeWidth?: ExcalidrawGenericElement["strokeWidth"];
    strokeStyle?: ExcalidrawGenericElement["strokeStyle"];
    roundness?: ExcalidrawGenericElement["roundness"];
    roughness?: ExcalidrawGenericElement["roughness"];
    opacity?: ExcalidrawGenericElement["opacity"];
    // text props
    text?: T extends "text" ? ExcalidrawTextElement["text"] : never;
    fontSize?: T extends "text" ? ExcalidrawTextElement["fontSize"] : never;
    fontFamily?: T extends "text" ? ExcalidrawTextElement["fontFamily"] : never;
    textAlign?: T extends "text" ? ExcalidrawTextElement["textAlign"] : never;
    verticalAlign?: T extends "text"
      ? ExcalidrawTextElement["verticalAlign"]
      : never;
    boundElements?: ExcalidrawGenericElement["boundElements"];
    containerId?: T extends "text"
      ? ExcalidrawTextElement["containerId"]
      : never;
    points?: T extends "arrow" | "line" | "freedraw" ? readonly LocalPoint[] : never;
    locked?: boolean;
    fileId?: T extends "image" ? string : never;
    scale?: T extends "image" ? ExcalidrawImageElement["scale"] : never;
    status?: T extends "image" ? ExcalidrawImageElement["status"] : never;
    startBinding?: T extends "arrow"
      ? ExcalidrawArrowElement["startBinding"] | ExcalidrawElbowArrowElement["startBinding"]
      : never;
    endBinding?: T extends "arrow"
      ? ExcalidrawArrowElement["endBinding"] | ExcalidrawElbowArrowElement["endBinding"]
      : never;
    startArrowhead?: T extends "arrow"
      ? ExcalidrawArrowElement["startArrowhead"] | ExcalidrawElbowArrowElement["startArrowhead"]
      : never;
    endArrowhead?: T extends "arrow"
      ? ExcalidrawArrowElement["endArrowhead"] | ExcalidrawElbowArrowElement["endArrowhead"]
      : never;
    elbowed?: boolean;
    fixedSegments?: FixedSegment[] | null;
  }): T extends "arrow" | "line"
    ? ExcalidrawLinearElement
    : T extends "freedraw"
    ? ExcalidrawFreeDrawElement
    : T extends "text"
    ? ExcalidrawTextElement
    : T extends "image"
    ? ExcalidrawImageElement
    : T extends "frame"
    ? ExcalidrawFrameElement
    : T extends "magicframe"
    ? ExcalidrawMagicFrameElement
    : ExcalidrawGenericElement => {
    let element: Mutable<ExcalidrawElement> = null!;

    const appState = h?.state || getDefaultAppState();

    const base: Omit<
      ExcalidrawGenericElement,
      | "id"
      | "type"
      | "version"
      | "versionNonce"
      | "isDeleted"
      | "groupIds"
      | "link"
      | "updated"
    > = {
      seed: 1,
      x,
      y,
      width,
      height,
      frameId: rest.frameId ?? null,
      index: rest.index ?? null,
      angle: (rest.angle ?? 0) as Radians,
      strokeColor: rest.strokeColor ?? appState.currentItemStrokeColor,
      backgroundColor:
        rest.backgroundColor ?? appState.currentItemBackgroundColor,
      fillStyle: rest.fillStyle ?? appState.currentItemFillStyle,
      strokeWidth: rest.strokeWidth ?? appState.currentItemStrokeWidth,
      strokeStyle: rest.strokeStyle ?? appState.currentItemStrokeStyle,
      roundness: (
        rest.roundness === undefined
          ? appState.currentItemRoundness === "round"
          : rest.roundness
      )
        ? {
            type: isLinearElementType(type)
              ? ROUNDNESS.PROPORTIONAL_RADIUS
              : ROUNDNESS.ADAPTIVE_RADIUS,
          }
        : null,
      roughness: rest.roughness ?? appState.currentItemRoughness,
      opacity: rest.opacity ?? appState.currentItemOpacity,
      boundElements: rest.boundElements ?? null,
      locked: rest.locked ?? false,
    };
    switch (type) {
      case "rectangle":
      case "diamond":
      case "ellipse":
        element = newElement({
          type: type as "rectangle" | "diamond" | "ellipse",
          ...base,
        });
        break;
      case "embeddable":
        element = newEmbeddableElement({
          type: "embeddable",
          ...base,
        });
        break;
      case "iframe":
        element = newIframeElement({
          type: "iframe",
          ...base,
        });
        break;
      case "text":
        const fontSize = rest.fontSize ?? appState.currentItemFontSize;
        const fontFamily = rest.fontFamily ?? appState.currentItemFontFamily;
        element = newTextElement({
          ...base,
          text: rest.text || "test",
          fontSize,
          fontFamily,
          textAlign: rest.textAlign ?? appState.currentItemTextAlign,
          verticalAlign: rest.verticalAlign ?? DEFAULT_VERTICAL_ALIGN,
          containerId: rest.containerId ?? undefined,
        });
        element.width = width;
        element.height = height;
        break;
      case "freedraw":
        element = newFreeDrawElement({
          type: type as "freedraw",
          simulatePressure: true,
          points: rest.points,
          ...base,
        });
        break;
      case "arrow":
        element = newArrowElement({
          ...base,
          width,
          height,
          type,
          points: rest.points ?? [
            pointFrom<LocalPoint>(0, 0),
            pointFrom<LocalPoint>(100, 100),
          ],
          elbowed: rest.elbowed ?? false,
        });
        break;
      case "line":
        element = newLinearElement({
          ...base,
          width,
          height,
          type,
          points: rest.points ?? [
            pointFrom<LocalPoint>(0, 0),
            pointFrom<LocalPoint>(100, 100),
          ],
        });
        break;
      case "image":
        element = newImageElement({
          ...base,
          width,
          height,
          type,
          fileId: (rest.fileId as string as FileId) ?? null,
          status: rest.status || "saved",
          scale: rest.scale || [1, 1],
        });
        break;
      case "frame":
        element = newFrameElement({ ...base, width, height });
        break;
      case "magicframe":
        element = newMagicFrameElement({ ...base, width, height });
        break;
      default:
        assertNever(
          type,
          `API.createElement: unimplemented element type ${type}}`,
        );
        break;
    }
    if (element.type === "arrow") {
      element.startBinding = rest.startBinding ?? null;
      element.endBinding = rest.endBinding ?? null;
      element.startArrowhead = rest.startArrowhead ?? null;
      element.endArrowhead = rest.endArrowhead ?? null;
    }
    if (id) {
      element.id = id;
    }
    if (isDeleted) {
      element.isDeleted = isDeleted;
    }
    if (groupIds) {
      element.groupIds = groupIds;
    }
    return element as any;
  };

  static createTextContainer = (opts?: {
    frameId?: ExcalidrawElement["id"];
    groupIds?: ExcalidrawElement["groupIds"];
    label?: {
      text?: string;
      frameId?: ExcalidrawElement["id"] | null;
      groupIds?: ExcalidrawElement["groupIds"];
    };
  }) => {
    const rectangle = API.createElement({
      type: "rectangle",
      frameId: opts?.frameId || null,
      groupIds: opts?.groupIds,
    });

    const text = API.createElement({
      type: "text",
      text: opts?.label?.text || "sample-text",
      width: 50,
      height: 20,
      fontSize: 16,
      containerId: rectangle.id,
      frameId:
        opts?.label?.frameId === undefined
          ? opts?.frameId ?? null
          : opts?.label?.frameId ?? null,
      groupIds: opts?.label?.groupIds === undefined
      ? opts?.groupIds
      : opts?.label?.groupIds ,

    });

    h.app.scene.mutateElement(
      rectangle,
      {
        boundElements: [{ type: "text", id: text.id }],
      },
    );

    return [rectangle, text];
  };

  static createLabeledArrow = (opts?: {
    frameId?: ExcalidrawElement["id"];
    label?: {
      text?: string;
      frameId?: ExcalidrawElement["id"] | null;
    };
  }) => {
    const arrow = API.createElement({
      type: "arrow",
      frameId: opts?.frameId || null,
    });

    const text = API.createElement({
      type: "text",
      width: 50,
      height: 20,
      containerId: arrow.id,
      frameId:
        opts?.label?.frameId === undefined
          ? opts?.frameId ?? null
          : opts?.label?.frameId ?? null,
    });

    h.app.scene.mutateElement(
      arrow,
      {
        boundElements: [{ type: "text", id: text.id }],
      },
    );

    return [arrow, text];
  };

  static readFile = async <T extends "utf8" | null>(
    filepath: string,
    encoding?: T,
  ): Promise<T extends "utf8" ? string : Buffer> => {
    filepath = path.isAbsolute(filepath)
      ? filepath
      : path.resolve(path.join(__dirname, "../", filepath));
    return readFile(filepath, { encoding }) as any;
  };

  static loadFile = async (filepath: string) => {
    const { base, ext } = path.parse(filepath);
    return new File([await API.readFile(filepath, null)], base, {
      type: getMimeType(ext),
    });
  };

  static drop = async (items: ({kind: "string", value: string, type: string} | {kind: "file", file: File | Blob, type?: string })[]) => {

    const fileDropEvent = createEvent.drop(GlobalTestState.interactiveCanvas);

    const dataTransferFileItems = items.filter(i => i.kind === "file") as {kind: "file", file: File | Blob, type: string }[];

    const files = dataTransferFileItems.map(item => item.file) as File[] & { item: (index: number) => File };
    // https://developer.mozilla.org/en-US/docs/Web/API/FileList/item
    files.item = (index: number) => files[index];

    Object.defineProperty(fileDropEvent, "dataTransfer", {
      value: {
        // https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files
        files,
        // https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/items
        items: items.map((item, idx) => {
          if (item.kind === "string")  {
            return {
              kind: "string",
              type: item.type,
              // https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/getAsString
              getAsString: (cb: (text: string) => any) => cb(item.value),
            };
          }
          return {
            kind: "file",
            type: item.type || item.file.type,
            // https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/getAsFile
            getAsFile: () => item.file,
          };
        }),
        // https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/getData
        getData: (type: string) => {
          return items.find((item) => item.type === "string" && item.type === type) || "";
        },
        // https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/types
        types: Array.from(new Set(items.map((item) => item.kind === "file" ? "Files" : item.type))),
      },
    });
    Object.defineProperty(fileDropEvent, "clientX", {
      value: 0,
    });
    Object.defineProperty(fileDropEvent, "clientY", {
      value: 0,
    });

    await fireEvent(GlobalTestState.interactiveCanvas, fileDropEvent);
  };

  static executeAction = (action: Action) => {
    act(() => {
      h.app.actionManager.executeAction(action);
    });
  };
}
