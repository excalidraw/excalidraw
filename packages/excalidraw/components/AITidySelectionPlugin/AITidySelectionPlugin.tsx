import { useLayoutEffect } from "react";

import { useApp } from "../App";

import type { GenerateAITidySelection } from "../../types";

export const AITidySelectionPlugin = (props: {
  tidy: GenerateAITidySelection;
}) => {
  const app = useApp();

  useLayoutEffect(() => {
    app.setPlugins({
      aiTidySelection: { tidy: props.tidy },
    });
  }, [app, props.tidy]);

  return null;
};
