import { useCallback, useRef } from "react";
import { Tldraw, type Editor } from "tldraw";
import { UploadPanel } from "./UploadPanel";
import {
  excalidrawSceneToTldrawShapes,
  type ExcalidrawScene,
} from "./excalidrawToTldraw";

export default function App() {
  const editorRef = useRef<Editor | null>(null);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const handleScene = useCallback((sceneJson: unknown) => {
    const editor = editorRef.current;
    if (!editor) return;
    const scene = sceneJson as ExcalidrawScene;
    const { shapes } = excalidrawSceneToTldrawShapes(scene);

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
