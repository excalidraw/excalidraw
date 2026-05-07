import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tldraw, type Editor, type TLShapePartial } from "tldraw";
import { UploadPanel } from "./UploadPanel";
import {
  collapseAllKeys,
  expandAllKeys,
  filterTerraformShapes,
  getSelectedExplodeTriggerKey,
  getSelectedExplodeTriggerKeys,
  toggleExpandedKey,
} from "./terraformVisibility";

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
  const [allShapes, setAllShapes] = useState<TLShapePartial[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [dependencyLayerEnabled, setDependencyLayerEnabled] = useState(true);
  const [dataFlowLayerEnabled, setDataFlowLayerEnabled] = useState(true);
  const [selectedTriggerKey, setSelectedTriggerKey] = useState<string | null>(
    null,
  );
  const [selectedTriggerKeys, setSelectedTriggerKeys] = useState<string[]>([]);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const visibleShapes = useMemo(
    () =>
      filterTerraformShapes(allShapes, expandedKeys, {
        dependencyLayerEnabled,
        dataFlowLayerEnabled,
      }),
    [allShapes, expandedKeys, dependencyLayerEnabled, dataFlowLayerEnabled],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.run(() => {
      const existing = editor.getCurrentPageShapes();
      if (existing.length > 0) {
        editor.deleteShapes(existing.map((s) => s.id));
      }
      if (visibleShapes.length > 0) {
        editor.createShapes(visibleShapes);
      }
      if (allShapes.length > 0) {
        editor.zoomToFit({ animation: { duration: 300 } });
      }
    });
  }, [visibleShapes, allShapes.length]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const selected = editor.getSelectedShapes() as TLShapePartial[];
      setSelectedTriggerKey(getSelectedExplodeTriggerKey(selected, allShapes));
      setSelectedTriggerKeys(getSelectedExplodeTriggerKeys(selected, allShapes));
    }, 200);
    return () => window.clearInterval(handle);
  }, [allShapes]);

  const handleScene = useCallback((sceneJson: unknown) => {
    const doc = sceneJson as TldrawRenderDocument;
    const shapes = sanitizeShapes(Array.isArray(doc.shapes) ? doc.shapes : []);
    setAllShapes(shapes);
    setExpandedKeys(new Set());
    setDependencyLayerEnabled(true);
    setDataFlowLayerEnabled(true);
    setSelectedTriggerKey(null);
    setSelectedTriggerKeys([]);
  }, []);

  const handleToggleDependency = useCallback(
    () => setDependencyLayerEnabled((value) => !value),
    [],
  );
  const handleToggleDataFlow = useCallback(
    () => setDataFlowLayerEnabled((value) => !value),
    [],
  );
  const handleExplodeSelected = useCallback(() => {
    setExpandedKeys((prev) => {
      let next = prev;
      for (const key of selectedTriggerKeys) {
        next = toggleExpandedKey(allShapes, next, key);
      }
      if (selectedTriggerKeys.length === 0) {
        next = toggleExpandedKey(allShapes, next, selectedTriggerKey);
      }
      return next;
    });
  }, [allShapes, selectedTriggerKey, selectedTriggerKeys]);
  const handleExpandAll = useCallback(() => {
    setExpandedKeys(expandAllKeys(allShapes));
  }, [allShapes]);
  const handleCollapseAll = useCallback(() => {
    setExpandedKeys(collapseAllKeys());
  }, []);

  return (
    <div className="app">
      <UploadPanel
        onSceneLoaded={handleScene}
        hasScene={allShapes.length > 0}
        dependencyLayerEnabled={dependencyLayerEnabled}
        dataFlowLayerEnabled={dataFlowLayerEnabled}
        hasSelectedExplodeTarget={Boolean(selectedTriggerKey)}
        onToggleDependency={handleToggleDependency}
        onToggleDataFlow={handleToggleDataFlow}
        onExplodeSelected={handleExplodeSelected}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
      />
      <div className="canvas-wrap">
        <Tldraw onMount={handleMount} />
      </div>
    </div>
  );
}
