import { ReactNode } from "react";
import { useCanvasElements } from "../../hooks/useMutatedElements";
import { CommonCanvasAppState } from "../../types";
import { NonDeletedExcalidrawElement } from "../../element/types";
import Scene from "../../scene/Scene";
import { useVisibleCanvasElements } from "../../hooks/useVisibleElements";

type CanvasesWrapperProps = {
  appState: CommonCanvasAppState;
  scene: Scene;
  children: (
    versionNonce: number | undefined,
    elements: readonly NonDeletedExcalidrawElement[],
    visibleElements: readonly NonDeletedExcalidrawElement[],
  ) => ReactNode;
};

const CanvasesWrapper = ({
  appState,
  scene,
  children,
}: CanvasesWrapperProps) => {
  const versionNonce = scene.getVersionNonce();
  const elements = useCanvasElements(appState, scene);
  const visibleElements = useVisibleCanvasElements(appState, elements);

  return <main>{children(versionNonce, elements, visibleElements)}</main>;
};

export default CanvasesWrapper;
