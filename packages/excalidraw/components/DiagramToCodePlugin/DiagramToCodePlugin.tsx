import { useLayoutEffect } from "react";

import { useApp } from "../App";

import type {
  GenerateDiagramToCode,
  RenderDiagramToCodeError,
} from "../../types";

export { DiagramToCodeError } from "./DiagramToCodeError";

export const DiagramToCodePlugin = (props: {
  generate: GenerateDiagramToCode;
  /**
   * Optionally render the error shown over a failed generation, e.g. for
   * a host-specific error code. Rendered as app UI (not inside the
   * sandboxed frame). Keep the reference stable to avoid rerenders.
   */
  renderError?: RenderDiagramToCodeError;
}) => {
  const app = useApp();

  useLayoutEffect(() => {
    app.setPlugins({
      diagramToCode: {
        generate: props.generate,
        renderError: props.renderError,
      },
    });
  }, [app, props.generate, props.renderError]);

  return null;
};
