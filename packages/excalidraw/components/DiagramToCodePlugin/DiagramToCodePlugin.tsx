import { useLayoutEffect } from "react";
import { useApp } from "../App";
import type { GenerateDiagramToCode } from "../../types";

export const DiagramToCodePlugin = (props: {
  generate: GenerateDiagramToCode;
}) => {
  const app = useApp();

  useLayoutEffect(() => {
    app.setPlugins({
      diagramToCode: { generate: props.generate },
    });
  }, [app, props.generate]);

  return null;
};
