import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { CaptureUpdateAction, isImageElement } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import { ChatCanvasShell } from "./ChatCanvasShell";
import { SidebarDrawer } from "./SidebarDrawer";
import { InspectorPanel } from "./InspectorPanel";
import { LayersPanel, type LayerReorderDirection } from "./LayersPanel";
import { CropModal } from "./CropModal";
import { ImageEditorModal } from "./ImageEditorModal";
import { ExtendModal } from "./ExtendModal";
import { UpscaleModal } from "./UpscaleModal";
import { useSelectionContext } from "./useSelectionContext";
import {
  dataURLToBlob,
  duplicateImageElement,
  getSelectedImageElement,
  replaceImageFile,
} from "../../chatcanvas/image/ImageOps";
import { extendImage, upscaleImage } from "../../chatcanvas/api/imageJobs";
import type { ImageToolAction, ImageToolRequest } from "./types";

interface ExcalidrawChatCanvasWrapperProps {
  children: ReactNode;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onExport?: () => void;
  onSettings?: () => void;
  title?: string;
  imageToolRequest?: ImageToolRequest | null;
  onImageToolRequestHandled?: () => void;
}

/**
 * This component wraps Excalidraw with ChatCanvas functionality.
 * It should be used inside the Excalidraw component as a child.
 */
export const ExcalidrawChatCanvasWrapper: React.FC<
  ExcalidrawChatCanvasWrapperProps
> = ({
  children,
  excalidrawAPI,
  onExport,
  onSettings,
  title = "ChatCanvas",
  imageToolRequest,
  onImageToolRequestHandled,
}) => {
  const [elements, setElements] = useState<readonly ExcalidrawElement[]>([]);
  const [appState, setAppState] = useState<
    ReturnType<ExcalidrawImperativeAPI["getAppState"]> | null
  >(null);
  const [files, setFiles] = useState<BinaryFiles>({});
  const [activeModal, setActiveModal] = useState<
    Exclude<ImageToolAction, "layers"> | null
  >(null);
  const [showLayersPanel, setShowLayersPanel] = useState(false);

  // Track selection changes
  useSelectionContext(excalidrawAPI);

  useEffect(() => {
    if (!excalidrawAPI) return;

    setElements(excalidrawAPI.getSceneElements());
    setAppState(excalidrawAPI.getAppState());
    setFiles(excalidrawAPI.getFiles());

    const unsubscribe = excalidrawAPI.onChange((nextElements, nextAppState, nextFiles) => {
      setElements(nextElements);
      setAppState(nextAppState);
      setFiles(nextFiles);
    });

    return () => unsubscribe();
  }, [excalidrawAPI]);

  const selectedImage = useMemo(() => {
    if (!appState) {
      return null;
    }
    return getSelectedImageElement(elements, appState.selectedElementIds);
  }, [appState, elements]);

  const selectedElementId = useMemo(() => {
    if (!appState?.selectedElementIds) {
      return null;
    }
    return (
      Object.keys(appState.selectedElementIds).find(
        (id) => appState.selectedElementIds[id],
      ) ?? null
    );
  }, [appState]);

  const imageDataURL = selectedImage ? files[selectedImage.fileId]?.dataURL ?? null : null;

  const sceneStats = useMemo(() => {
    const imageCount = elements.filter((element) => isImageElement(element)).length;
    return { elementCount: elements.length, imageCount };
  }, [elements]);

  useEffect(() => {
    if (!imageToolRequest || !excalidrawAPI) {
      return;
    }

    excalidrawAPI.updateScene({
      appState: {
        selectedElementIds: {
          [imageToolRequest.elementId]: true,
        },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    if (imageToolRequest.action === "layers") {
      setShowLayersPanel((prev) => !prev);
    } else {
      setActiveModal(imageToolRequest.action);
    }

    onImageToolRequestHandled?.();
  }, [imageToolRequest, excalidrawAPI, onImageToolRequestHandled]);

  const handleImageToolAction = (action: ImageToolAction) => {
    if (!selectedImage) {
      return;
    }

    if (action === "layers") {
      setShowLayersPanel((prev) => !prev);
      return;
    }

    setActiveModal(action);
  };

  const handleReplaceImage = async (file: File) => {
    if (!selectedImage || !excalidrawAPI) {
      return;
    }

    await replaceImageFile(
      excalidrawAPI,
      selectedImage.id,
      file,
      file.type,
      undefined,
      undefined,
      {
        source: "replace",
      },
      "replace",
    );
  };

  const handleDuplicateImage = () => {
    if (!selectedImage || !excalidrawAPI) {
      return;
    }
    duplicateImageElement(excalidrawAPI, selectedImage.id);
  };

  const handleReorder = (direction: LayerReorderDirection) => {
    if (!excalidrawAPI || !selectedElementId) {
      return;
    }

    const index = elements.findIndex((el) => el.id === selectedElementId);
    if (index < 0) {
      return;
    }

    const nextElements = [...elements];
    const [element] = nextElements.splice(index, 1);

    if (!element) {
      return;
    }

    switch (direction) {
      case "front":
        nextElements.push(element);
        break;
      case "back":
        nextElements.unshift(element);
        break;
      case "forward": {
        const nextIndex = Math.min(index + 1, nextElements.length);
        nextElements.splice(nextIndex, 0, element);
        break;
      }
      case "backward": {
        const nextIndex = Math.max(index - 1, 0);
        nextElements.splice(nextIndex, 0, element);
        break;
      }
    }

    excalidrawAPI.updateScene({
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const handleSelectElement = (elementId: string) => {
    if (!excalidrawAPI) {
      return;
    }

    excalidrawAPI.updateScene({
      appState: {
        selectedElementIds: {
          [elementId]: true,
        },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    const target = elements.find((el) => el.id === elementId);
    if (target) {
      excalidrawAPI.scrollToContent([target]);
    }
  };

  const handleExportCanvas = () => {
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: {
          openDialog: { name: "imageExport" },
        },
      });
    }
    onExport?.();
  };

  const handleExportSelection = () => {
    if (selectedElementId && excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: {
          selectedElementIds: { [selectedElementId]: true },
          openDialog: { name: "imageExport" },
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
  };

  const handleCropSave = async (blob: Blob, width: number, height: number) => {
    if (!selectedImage || !excalidrawAPI) {
      return;
    }

    await replaceImageFile(
      excalidrawAPI,
      selectedImage.id,
      blob,
      "image/png",
      width,
      height,
      {
        source: "crop",
      },
      "crop",
    );

    setActiveModal(null);
  };

  const handleEditSave = async (dataURL: string) => {
    if (!selectedImage || !excalidrawAPI) {
      return;
    }

    const blob = await dataURLToBlob(dataURL);
    await replaceImageFile(
      excalidrawAPI,
      selectedImage.id,
      blob,
      "image/png",
      undefined,
      undefined,
      {
        source: "edit",
      },
      "edit",
    );

    setActiveModal(null);
  };

  const handleExtendSubmit = async (payload: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    prompt?: string;
  }) => {
    if (!selectedImage || !imageDataURL || !excalidrawAPI) {
      return;
    }

    try {
      const result = await extendImage({
        fileId: selectedImage.fileId,
        imageData: imageDataURL,
        expand: {
          left: payload.left,
          right: payload.right,
          top: payload.top,
          bottom: payload.bottom,
        },
        prompt: payload.prompt,
        mode: "outpaint",
      });

      await replaceImageFile(
        excalidrawAPI,
        selectedImage.id,
        result.blob,
        result.blob.type,
        result.width,
        result.height,
        {
          source: result.source,
        },
        "extend",
      );

      setActiveModal(null);
    } catch (error) {
      excalidrawAPI.setToast({
        message: "Extend failed. Please try again.",
        duration: 4000,
      });
    }
  };

  const handleUpscaleSubmit = async (payload: { scale: number }) => {
    if (!selectedImage || !imageDataURL || !excalidrawAPI) {
      return;
    }

    try {
      const result = await upscaleImage({
        fileId: selectedImage.fileId,
        imageData: imageDataURL,
        scale: payload.scale,
      });

      await replaceImageFile(
        excalidrawAPI,
        selectedImage.id,
        result.blob,
        result.blob.type,
        result.width,
        result.height,
        {
          source: result.source,
        },
        "upscale",
      );

      if (result.source === "mock") {
        excalidrawAPI.setToast({
          message: "Used browser upscale (HQ resize).",
          duration: 4000,
        });
      }

      setActiveModal(null);
    } catch (error) {
      excalidrawAPI.setToast({
        message: "Upscale failed. Please try again.",
        duration: 4000,
      });
    }
  };

  return (
    <>
      <ChatCanvasShell
        title={title}
        onExport={onExport}
        onSettings={onSettings}
        sidebar={
          <SidebarDrawer
            excalidrawAPI={excalidrawAPI}
            elements={elements}
            files={files}
            selectedImageId={selectedImage?.id ?? null}
            onImageToolAction={handleImageToolAction}
            onExportCanvas={handleExportCanvas}
            onExportSelection={handleExportSelection}
          />
        }
        inspector={
          <InspectorPanel
            selectedImage={selectedImage}
            onImageToolAction={handleImageToolAction}
            onReplaceImage={handleReplaceImage}
            onDuplicateImage={handleDuplicateImage}
            sceneStats={sceneStats}
            layersPanel={
              showLayersPanel ? (
                <LayersPanel
                  elements={elements}
                  selectedElementId={selectedElementId}
                  onSelectElement={handleSelectElement}
                  onReorder={handleReorder}
                />
              ) : null
            }
          />
        }
      >
        {children}
      </ChatCanvasShell>

      <CropModal
        open={activeModal === "crop"}
        imageDataURL={imageDataURL}
        onCancel={() => setActiveModal(null)}
        onSave={handleCropSave}
      />
      <ImageEditorModal
        open={activeModal === "edit"}
        imageDataURL={imageDataURL}
        onCancel={() => setActiveModal(null)}
        onSave={handleEditSave}
      />
      <ExtendModal
        open={activeModal === "extend"}
        onCancel={() => setActiveModal(null)}
        onSubmit={handleExtendSubmit}
      />
      <UpscaleModal
        open={activeModal === "upscale"}
        onCancel={() => setActiveModal(null)}
        onSubmit={handleUpscaleSubmit}
      />
    </>
  );
};
