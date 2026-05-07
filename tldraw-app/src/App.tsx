import { useCallback, useRef } from "react";
import { Tldraw, type Editor, type TLShapePartial } from "tldraw";
import { UploadPanel } from "./UploadPanel";

type TldrawRenderDocument = {
  type?: string;
  shapes?: TLShapePartial[];
};

function sanitizeShapes(input: TLShapePartial[]): TLShapePartial[] {
  return input
    .map((shape) => {
      if (!shape || typeof shape !== "object" || !("type" in shape)) {
        return null;
      }
      if (shape.type === "arrow") {
        const props = (shape.props || {}) as Record<string, unknown>;
        return {
          id: shape.id,
          type: "arrow",
          x: shape.x,
          y: shape.y,
          props: {
            start: props.start as { x: number; y: number },
            end: props.end as { x: number; y: number },
            bend: typeof props.bend === "number" ? props.bend : 0,
            color: (props.color as
              | "black"
              | "grey"
              | "light-violet"
              | "violet"
              | "blue"
              | "light-blue"
              | "yellow"
              | "orange"
              | "green"
              | "light-green"
              | "light-red"
              | "red") || "grey",
            fill: (props.fill as "none" | "semi" | "solid" | "pattern") || "none",
            dash: (props.dash as "draw" | "solid" | "dashed" | "dotted") || "solid",
            size: (props.size as "s" | "m" | "l" | "xl") || "m",
            arrowheadStart:
              (props.arrowheadStart as "none" | "arrow" | "triangle" | "square" | "dot" | "pipe" | "diamond" | "inverted" | "bar") ||
              "none",
            arrowheadEnd:
              (props.arrowheadEnd as "none" | "arrow" | "triangle" | "square" | "dot" | "pipe" | "diamond" | "inverted" | "bar") ||
              "arrow",
          },
          meta: shape.meta,
        } as TLShapePartial;
      }
      if (shape.type === "geo") {
        const props = (shape.props || {}) as Record<string, unknown>;
        return {
          id: shape.id,
          type: "geo",
          x: shape.x,
          y: shape.y,
          props: {
            geo: (props.geo as "rectangle" | "ellipse" | "triangle" | "diamond" | "cloud" | "pentagon" | "hexagon" | "octagon" | "star" | "rhombus" | "rhombus-2" | "oval" | "trapezoid" | "arrow-right" | "arrow-left" | "arrow-up" | "arrow-down" | "x-box" | "check-box") || "rectangle",
            w: typeof props.w === "number" ? props.w : 1,
            h: typeof props.h === "number" ? props.h : 1,
            color: (props.color as
              | "black"
              | "grey"
              | "light-violet"
              | "violet"
              | "blue"
              | "light-blue"
              | "yellow"
              | "orange"
              | "green"
              | "light-green"
              | "light-red"
              | "red") || "grey",
            fill: (props.fill as "none" | "semi" | "solid" | "pattern") || "none",
            dash: (props.dash as "draw" | "solid" | "dashed" | "dotted") || "solid",
            size: (props.size as "s" | "m" | "l" | "xl") || "m",
          },
          meta: shape.meta,
        } as TLShapePartial;
      }
      return shape;
    })
    .filter((shape): shape is TLShapePartial => Boolean(shape));
}

export default function App() {
  const editorRef = useRef<Editor | null>(null);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const handleScene = useCallback((sceneJson: unknown) => {
    const editor = editorRef.current;
    if (!editor) return;
    const doc = sceneJson as TldrawRenderDocument;
    const shapes = sanitizeShapes(Array.isArray(doc.shapes) ? doc.shapes : []);

    editor.run(() => {
      const existing = editor.getCurrentPageShapes();
      if (existing.length > 0) {
        editor.deleteShapes(existing.map((s) => s.id));
      }
      if (shapes.length > 0) {
        editor.createShapes(shapes);
        editor.zoomToFit({ animation: { duration: 300 } });
      }
    });
  }, []);

  return (
    <div className="app">
      <UploadPanel onSceneLoaded={handleScene} />
      <div className="canvas-wrap">
        <Tldraw onMount={handleMount} />
      </div>
    </div>
  );
}
