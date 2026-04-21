import { useLayoutEffect } from "react";

import { useApp } from "../App";

import type { GenerateAISmartConnectorLabels } from "../../types";

export const AISmartConnectorLabelsPlugin = (props: {
  suggest: GenerateAISmartConnectorLabels;
}) => {
  const app = useApp();

  useLayoutEffect(() => {
    app.setPlugins({
      aiSmartConnectorLabels: { suggest: props.suggest },
    });
  }, [app, props.suggest]);

  return null;
};
