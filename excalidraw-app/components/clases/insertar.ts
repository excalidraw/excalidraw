import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";

/** Esquina superior izquierda visible del canvas, en coords de escena. */
export function origenViewport(api: ExcalidrawImperativeAPI): {
  x: number;
  y: number;
} {
  const appState = api.getAppState();
  return { x: -appState.scrollX + 80, y: -appState.scrollY + 80 };
}

/** Convierte un punto de pantalla (drop) a coords de escena (aprox). */
export function pantallaAScena(
  api: ExcalidrawImperativeAPI,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const appState = api.getAppState();
  const zoom = appState.zoom.value;
  const rect = document
    .querySelector(".excalidraw-container")
    ?.getBoundingClientRect();
  const left = rect?.left ?? 0;
  const top = rect?.top ?? 0;
  return {
    x: Math.round((clientX - left - appState.scrollX) / zoom),
    y: Math.round((clientY - top - appState.scrollY) / zoom),
  };
}

export function insertarSkeletons(
  api: ExcalidrawImperativeAPI,
  skeletons: ExcalidrawElementSkeleton[],
  dx: number,
  dy: number,
) {
  const desplazados = skeletons.map((sk) => ({
    ...sk,
    x: (sk as { x: number }).x + dx,
    y: (sk as { y: number }).y + dy,
  })) as ExcalidrawElementSkeleton[];
  const nuevos = convertToExcalidrawElements(desplazados);
  api.updateScene({
    elements: [...api.getSceneElements(), ...nuevos],
    appState: {
      selectedElementIds: Object.fromEntries(nuevos.map((el) => [el.id, true])),
    },
  });
  return nuevos;
}

export function insertarTexto(
  api: ExcalidrawImperativeAPI,
  text: string,
  opts?: { fontSize?: number; strokeColor?: string; dx?: number; dy?: number },
) {
  const { x, y } = origenViewport(api);
  return insertarSkeletons(
    api,
    [
      {
        type: "text",
        text,
        fontSize: opts?.fontSize ?? 24,
        strokeColor: opts?.strokeColor ?? "#1e1e1e",
      } as unknown as ExcalidrawElementSkeleton,
    ],
    x + (opts?.dx ?? 0),
    y + (opts?.dy ?? 0),
  );
}
