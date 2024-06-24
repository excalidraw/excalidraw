import { generateIdFromFile, getDataURL } from "../data/blob";
import { mutateElement } from "../element/mutateElement";
import { isInitializedImageElement } from "../element/typeChecks";
import type { InitializedExcalidrawImageElement } from "../element/types";
import type { BinaryFileData } from "../types";
import { register } from "./register";

export const actionRemoveBackground = register({
  name: "removeBackground",
  label: "stats.fullTitle",
  trackEvent: false,
  viewMode: false,
  async perform(elements, appState, type, app) {
    const selectedElements = app.scene.getSelectedElements(appState);

    if (
      selectedElements.length > 0 &&
      selectedElements.every(isInitializedImageElement)
    ) {
      const filesToProcess = selectedElements.reduce(
        (
          acc: Map<
            BinaryFileData["id"],
            {
              file: BinaryFileData;
              elements: InitializedExcalidrawImageElement[];
            }
          >,
          imageElement,
        ) => {
          const file = app.files[imageElement.fileId];

          if (file) {
            const fileWithRemovedBackground = Object.values(app.files).find(
              (_file) =>
                _file.customData?.source === "backgroundRemoval" &&
                _file.customData.parentFileId === file.id,
            );

            if (fileWithRemovedBackground) {
              mutateElement(
                imageElement,
                { fileId: fileWithRemovedBackground.id },
                false,
              );
            } else if (acc.has(file.id)) {
              acc.get(file.id)!.elements.push(imageElement);
            } else {
              acc.set(file.id, { file, elements: [imageElement] });
            }
          }
          return acc;
        },
        new Map(),
      );

      if (filesToProcess.size) {
        const backgroundRemoval = await await import(
          "@imgly/background-removal"
        );

        console.time("removeBackground");

        for (const [, { file, elements }] of filesToProcess) {
          const res = await backgroundRemoval.removeBackground(file.dataURL, {
            debug: true,
            progress: (...args) => {
              console.log("progress", args);
            },
            device: type === "auto" ? undefined : type,
            proxyToWorker: true,
          });

          const fileId = await generateIdFromFile(res);
          const dataURL = await getDataURL(res);

          for (const imageElement of elements) {
            mutateElement(imageElement, { fileId }, false);
          }

          app.addFiles([
            {
              ...file,
              id: fileId,
              dataURL,
              customData: {
                source: "backgroundRemoval",
                version: 1,
                parentFileId: file.id,
              },
            },
          ]);
        }

        console.timeEnd("removeBackground");
      }

      app.scene.triggerUpdate();
    }
    return false as false;
  },
  PanelComponent: ({ updateData }) => {
    return (
      <>
        <button
          onClick={() => {
            updateData("auto");
          }}
        >
          Remove background (auto)
        </button>
        <button
          onClick={() => {
            updateData("gpu");
          }}
        >
          Remove background (gpu)
        </button>
        <button
          onClick={() => {
            updateData("cpu");
          }}
        >
          Remove background (cpu)
        </button>
      </>
    );
  },
});
