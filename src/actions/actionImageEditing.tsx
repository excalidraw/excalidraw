import { getSelectedElements, isSomeElementSelected } from "../scene";
import { ToolButton } from "../components/ToolButton";
import { backgroundIcon } from "../components/icons";
import { register } from "./register";
import { getNonDeletedElements } from "../element";
import { isInitializedImageElement } from "../element/typeChecks";
import Scene from "../scene/Scene";

export const actionEditImageAlpha = register({
  name: "editImageAlpha",
  perform: async (elements, appState, _, app) => {
    if (appState.editingImageElement) {
      return {
        appState: {
          ...appState,
          editingImageElement: null,
        },
        commitToHistory: false,
      };
    }

    const selectedElements = getSelectedElements(elements, appState);
    const selectedElement = selectedElements[0];
    if (
      selectedElements.length === 1 &&
      isInitializedImageElement(selectedElement)
    ) {
      const imgData = app.imageCache.get(selectedElement.fileId);
      if (!imgData) {
        return false;
      }

      const image = await imgData.image;
      const { width, height } = image;

      const canvas = document.createElement("canvas");
      canvas.height = height;
      canvas.width = width;
      const context = canvas.getContext("2d")!;

      context.drawImage(image, 0, 0, width, height);

      const imageData = context.getImageData(0, 0, width, height);

      Scene.mapElementToScene(selectedElement.id, app.scene);

      return {
        appState: {
          ...appState,
          editingImageElement: {
            editorType: "alpha",
            elementId: selectedElement.id,
            origImageData: imageData,
            imageData,
            pointerDownState: { screenX: 0, screenY: 0, sampledPixel: null },
          },
        },
        commitToHistory: false,
      };
    }
    return false;
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={backgroundIcon}
      label="Edit Image Alpha"
      className={appState.editingImageElement ? "active" : ""}
      title={"Edit image alpha"}
      aria-label={"Edit image alpha"}
      onClick={() => updateData(null)}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
