import { ReactNode } from "react";
import { useMutatedElements } from "../../hooks/useMutatedElements";
import { AppState } from "../../types";
import { NonDeletedExcalidrawElement } from "../../element/types";
import Scene from "../../scene/Scene";

type CanvasesWrapperProps = {
  appState: AppState;
  scene: Scene;
  children: (
    elements: readonly NonDeletedExcalidrawElement[],
    versionNonce: number | undefined,
  ) => ReactNode;
};

const CanvasesWrapper = (props: CanvasesWrapperProps) => {
  const [elements, versionNonce] = useMutatedElements({
    appState: props.appState,
    scene: props.scene,
  });

  return <main>{props.children(elements, versionNonce)}</main>;
};

export default CanvasesWrapper;
