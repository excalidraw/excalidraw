import type {
    ExcalidrawArrowElement,
    ExcalidrawDiamondElement,
    ExcalidrawElement,
    ExcalidrawEllipseElement,
    ExcalidrawFreeDrawElement,
    ExcalidrawLinearElement,
    ExcalidrawRectangleElement,
  } from "../excalidraw/element/types";
  import type { BoundingBox } from "../excalidraw/element/bounds";
  import { getCommonBoundingBox } from "../excalidraw/element/bounds";
  import { newElement } from "../excalidraw/element";
  // @ts-ignore
  import shapeit from "@amaplex-software/shapeit";
  
  type Shape =
    | ExcalidrawRectangleElement["type"]
    | ExcalidrawEllipseElement["type"]
    | ExcalidrawDiamondElement["type"]
    // | ExcalidrawArrowElement["type"]
    // | ExcalidrawLinearElement["type"]
    | ExcalidrawFreeDrawElement["type"];
  
  interface ShapeRecognitionResult {
    type: Shape;
    confidence: number;
    boundingBox: BoundingBox;
  }
  
  /**
   * Recognizes common shapes from free-draw input
   * @param element The freedraw element to analyze
   * @returns Information about the recognized shape, or null if no shape is recognized
   */
  export const recognizeShape = (
    element: ExcalidrawFreeDrawElement,
  ): ShapeRecognitionResult => {
    const boundingBox = getCommonBoundingBox([element]);
  
    // We need at least a few points to recognize a shape
    if (!element.points || element.points.length < 3) {
      return { type: "freedraw", confidence: 1, boundingBox };
    }
  
    console.log("Recognizing shape from points:", element.points);
  
    const shapethat = shapeit.new({
      atlas: {},
      output: {},
      thresholds: {},
    });
  
    const shape = shapethat(element.points);
  
    console.log("Shape recognized:", shape);
  
    const mappedShape = (name: string): Shape => {
      switch (name) {
        case "rectangle":
          return "rectangle";
        case "square":
          return "rectangle";
        case "circle":
          return "ellipse";
        case "open polygon":
          return "diamond";
        default:
          return "freedraw";
      }
    };
  
    const recognizedShape: ShapeRecognitionResult = {
      type: mappedShape(shape.name),
      confidence: 0.8,
      boundingBox,
    };
  
    return recognizedShape;
  };
  
  /**
   * Creates a new element based on the recognized shape from a freedraw element
   * @param freedrawElement The original freedraw element
   * @param recognizedShape The recognized shape information
   * @returns A new element of the recognized shape type
   */
  export const createElementFromRecognizedShape = (
    freedrawElement: ExcalidrawFreeDrawElement,
    recognizedShape: ShapeRecognitionResult,
  ): ExcalidrawElement => {
    if (!recognizedShape.type || recognizedShape.type === "freedraw") {
      return freedrawElement;
    }
  
    // if (recognizedShape.type === "rectangle") {
    return newElement({
      ...freedrawElement,
      type: recognizedShape.type,
      x: recognizedShape.boundingBox.minX,
      y: recognizedShape.boundingBox.minY,
      width: recognizedShape.boundingBox.width!,
      height: recognizedShape.boundingBox.height!,
    });
  };
  
  /**
   * Determines if shape recognition should be applied based on app state
   * @param element The freedraw element to potentially snap
   * @param minConfidence The minimum confidence level required to apply snapping
   * @returns Whether to apply shape snapping
   */
  export const shouldApplyShapeSnapping = (
    recognizedShape: ShapeRecognitionResult,
    minConfidence: number = 0.75,
  ): boolean => {
    return (
      !!recognizedShape.type && (recognizedShape.confidence || 0) >= minConfidence
    );
  };
  
  /**
   * Converts a freedraw element to the detected shape
   */
  export const convertToShape = (
    freeDrawElement: ExcalidrawFreeDrawElement,
  ): ExcalidrawElement => {
    const recognizedShape = recognizeShape(freeDrawElement);
  
    if (shouldApplyShapeSnapping(recognizedShape)) {
      return createElementFromRecognizedShape(freeDrawElement, recognizedShape);
    }
  
    // Add more shape conversions as needed
    return freeDrawElement;
  };
  