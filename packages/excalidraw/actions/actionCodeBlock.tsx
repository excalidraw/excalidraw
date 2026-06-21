import { CaptureUpdateAction } from "@excalidraw/element";

import { codeIcon } from "../components/icons";

import { register } from "./register";

export const actionInsertCodeBlock = register({
  name: "insertCodeBlock",
  icon: codeIcon,
  keywords: ["code", "snippet", "syntax", "highlight", "programming"],
  label: "toolBar.codeBlock",
  viewMode: false,
  trackEvent: { category: "toolbar" },
  perform: (elements, appState) => {
    return {
      elements,
      appState: {
        ...appState,
        openDialog: { name: "codeBlock" },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  predicate: (_elements, _appState, props) => props.viewModeEnabled !== true,
});
