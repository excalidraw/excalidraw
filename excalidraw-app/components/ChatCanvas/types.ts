import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawElementSkeleton,
} from "@excalidraw/element";

export type SelectionContextPayload = {
  selectedElements: string[];
  elementCount: number;
};

export type ElementContext = {
  id: string;
  type: ExcalidrawElement["type"];
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: ExcalidrawElement["angle"];
  strokeColor: string;
  backgroundColor: string;
  fillStyle: ExcalidrawElement["fillStyle"];
  strokeWidth: number;
  fontSize?: ExcalidrawTextElement["fontSize"];
  fontFamily?: ExcalidrawTextElement["fontFamily"];
  textAlign?: ExcalidrawTextElement["textAlign"];
  frameId: ExcalidrawElement["frameId"];
  groupIds: ExcalidrawElement["groupIds"];
};

export type ElementStyleUpdate = {
  strokeColor?: ExcalidrawElement["strokeColor"];
  backgroundColor?: ExcalidrawElement["backgroundColor"];
  strokeWidth?: ExcalidrawElement["strokeWidth"];
  fillStyle?: ExcalidrawElement["fillStyle"];
  textAlign?: ExcalidrawTextElement["textAlign"];
  fontSize?: ExcalidrawTextElement["fontSize"];
  fontFamily?: ExcalidrawTextElement["fontFamily"];
};

export type AgentAction =
  | {
      type: "addElements";
      payload: {
        elements: ExcalidrawElementSkeleton[];
      };
    }
  | {
      type: "updateSelected";
      payload: ElementStyleUpdate;
    }
  | {
      type: "deleteElements";
      payload: {
        elementIds: string[];
      };
    }
  | {
      type: "applyStyle";
      payload: {
        style: ElementStyleUpdate;
      };
    };

export interface AgentRequest {
  message: string;
  selectedElements: string[];
  elementCount: number;
  elementDetails: ElementContext[];
}

export interface AgentResponse {
  success: boolean;
  message: string;
  actions?: AgentAction[];
  error?: string;
}

export type ImageToolAction =
  | "crop"
  | "edit"
  | "extend"
  | "upscale"
  | "layers";

export type ImageToolRequest = {
  action: ImageToolAction;
  elementId: string;
};
