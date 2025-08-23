import { CaptureUpdateAction } from "@excalidraw/element";
import { register } from "./register";
import type { AppState } from "../types";
import type { GridType } from "../types";

export const actionChangeGridType = register({
	name: "changeGridType",
	label: "labels.changeGridType",
	trackEvent: { category: "canvas" },
    viewMode: true,
	perform(elements, appState: Readonly<AppState>, value: { gridType: GridType }) {
		return {
			appState: { ...appState, gridType: value.gridType },
			captureUpdate: CaptureUpdateAction.EVENTUALLY,
		};
	}
}); 