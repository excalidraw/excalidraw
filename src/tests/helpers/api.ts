import {
  ExcalidrawElement,
  ExcalidrawGenericElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
} from "../../element/types";
import { newElement, newTextElement, newLinearElement } from "../../element";
import { DEFAULT_VERTICAL_ALIGN } from "../../constants";
import { getDefaultAppState } from "../../appState";
import { GlobalTestState, createEvent, fireEvent } from "../test-utils";
import { ImportedDataState } from "../../data/types";

const { h } = window;

export class API {
  static getSelectedElements = (): ExcalidrawElement[] => {
    return h.elements.filter(
      (element) => h.state.selectedElementIds[element.id],
    );
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

  static getStateHistory = () => {
    // @ts-ignore
    return h.history.stateHistory;
  };

  static clearSelection = () => {
    // @ts-ignore
    h.app.clearSelection(null);
    expect(API.getSelectedElements().length).toBe(0);
  };

  static createElement = <
    T extends Exclude<ExcalidrawElement["type"], "selection">
  >({
    type,
    id,
    x = 0,
    y = x,
    width = 100,
    height = width,
    isDeleted = false,
    ...rest
  }: {
    type: T;
    x?: number;
    y?: number;
    height?: number;
    width?: number;
    id?: string;
    isDeleted?: boolean;
    // generic element props
    strokeColor?: ExcalidrawGenericElement["strokeColor"];
    backgroundColor?: ExcalidrawGenericElement["backgroundColor"];
    fillStyle?: ExcalidrawGenericElement["fillStyle"];
    strokeWidth?: ExcalidrawGenericElement["strokeWidth"];
    strokeStyle?: ExcalidrawGenericElement["strokeStyle"];
    strokeSharpness?: ExcalidrawGenericElement["strokeSharpness"];
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
  }): T extends "arrow" | "line" | "draw"
    ? ExcalidrawLinearElement
    : T extends "text"
    ? ExcalidrawTextElement
    : ExcalidrawGenericElement => {
    let element: Mutable<ExcalidrawElement> = null!;

    const appState = h?.state || getDefaultAppState();

    const base = {
      x,
      y,
      strokeColor: rest.strokeColor ?? appState.currentItemStrokeColor,
      backgroundColor:
        rest.backgroundColor ?? appState.currentItemBackgroundColor,
      fillStyle: rest.fillStyle ?? appState.currentItemFillStyle,
      strokeWidth: rest.strokeWidth ?? appState.currentItemStrokeWidth,
      strokeStyle: rest.strokeStyle ?? appState.currentItemStrokeStyle,
      strokeSharpness:
        rest.strokeSharpness ?? appState.currentItemStrokeSharpness,
      roughness: rest.roughness ?? appState.currentItemRoughness,
      opacity: rest.opacity ?? appState.currentItemOpacity,
    };
    switch (type) {
      case "rectangle":
      case "diamond":
      case "ellipse":
        element = newElement({
          type: type as "rectangle" | "diamond" | "ellipse",
          width,
          height,
          ...base,
        });
        break;
      case "text":
        element = newTextElement({
          ...base,
          text: rest.text || "test",
          fontSize: rest.fontSize ?? appState.currentItemFontSize,
          fontFamily: rest.fontFamily ?? appState.currentItemFontFamily,
          textAlign: rest.textAlign ?? appState.currentItemTextAlign,
          verticalAlign: rest.verticalAlign ?? DEFAULT_VERTICAL_ALIGN,
        });
        break;
      case "arrow":
      case "line":
      case "draw":
        element = newLinearElement({
          type: type as "arrow" | "line" | "draw",
          ...base,
        });
        break;
    }
    if (id) {
      element.id = id;
    }
    if (isDeleted) {
      element.isDeleted = isDeleted;
    }
    return element as any;
  };

  static dropFile(data: ImportedDataState | Blob) {
    const fileDropEvent = createEvent.drop(GlobalTestState.canvas);
    const file =
      data instanceof Blob
        ? data
        : new Blob(
            [
              JSON.stringify({
                type: "excalidraw",
                ...data,
              }),
            ],
            {
              type: "application/json",
            },
          );
    Object.defineProperty(fileDropEvent, "dataTransfer", {
      value: {
        files: [file],
        getData: (_type: string) => {
          return "";
        },
      },
    });
    fireEvent(GlobalTestState.canvas, fileDropEvent);
  }
}
