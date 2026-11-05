import {
  arrayToMap,
  getGridPoint,
  IMAGE_RENDER_TIMEOUT,
  KEYS,
  MIME_TYPES,
} from "@excalidraw/common";
import {
  getInitializedImageElements,
  isInitializedImageElement,
  makeNextSelectedElementIds,
  newElementWith,
  newImageElement,
  normalizeSVG,
  positionElementsOnGrid,
  ShapeCache,
  CaptureUpdateAction,
  updateImageCache as _updateImageCache,
} from "@excalidraw/element";
import throttle from "lodash.throttle";

import type {
  ExcalidrawImageElement,
  FileId,
  InitializedExcalidrawImageElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { actionFinalize } from "../actions";
import {
  generateIdFromFile,
  getDataURL,
  isSupportedImageFile,
  normalizeFile,
  resizeImageFile,
  SVGStringToFile,
} from "../data/blob";
import { t } from "../i18n";

import type App from "./App";
import type { BinaryFileData, BinaryFiles } from "../types";

/**
 * Image insertion and cache orchestration for one editor. The App keeps owning
 * its files and image cache; general input handling delegates image work here.
 */
export class AppImages {
  constructor(
    private app: App,
    private dependencies: {
      addMissingFiles: (files: BinaryFileData[]) => void;
    },
  ) {}

  private newImagePlaceholder = ({
    sceneX,
    sceneY,
    addToFrameUnderCursor = true,
  }: {
    sceneX: number;
    sceneY: number;
    addToFrameUnderCursor?: boolean;
  }) => {
    const [gridX, gridY] = getGridPoint(
      sceneX,
      sceneY,
      this.app.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.app.getEffectiveGridSize(),
    );

    const topLayerFrame = addToFrameUnderCursor
      ? this.app.getTopLayerFrameAtSceneCoords({
          x: gridX,
          y: gridY,
        })
      : null;

    const placeholderSize = 100 / this.app.state.zoom.value;

    return newImageElement({
      type: "image",
      strokeColor: this.app.state.currentItemStrokeColor,
      backgroundColor: this.app.state.currentItemBackgroundColor,
      fillStyle: this.app.state.currentItemFillStyle,
      strokeWidth: this.app.getCurrentItemStrokeWidth("image"),
      strokeStyle: this.app.state.currentItemStrokeStyle,
      roughness: this.app.state.currentItemRoughness,
      roundness: null,
      opacity: this.app.state.currentItemOpacity,
      locked: false,
      frameId: topLayerFrame ? topLayerFrame.id : null,
      x: gridX - placeholderSize / 2,
      y: gridY - placeholderSize / 2,
      width: placeholderSize,
      height: placeholderSize,
    });
  };

  private initializeImage = async (
    placeholderImageElement: ExcalidrawImageElement,
    imageFile: File,
  ) => {
    // at this point this should be guaranteed image file, but we do this check
    // to satisfy TS down the line
    if (!isSupportedImageFile(imageFile)) {
      throw new Error(t("errors.unsupportedFileType"));
    }
    const mimeType = imageFile.type;

    this.app.cursor.set("wait");

    if (mimeType === MIME_TYPES.svg) {
      try {
        imageFile = SVGStringToFile(
          normalizeSVG(await imageFile.text()),
          imageFile.name,
        );
      } catch (error: any) {
        console.warn(error);
        throw new Error(t("errors.svgImageInsertError"));
      }
    }

    // generate image id (by default the file digest) before any
    // resizing/compression takes place to keep it more portable
    const fileId = await ((this.app.props.generateIdForFile?.(
      imageFile,
    ) as Promise<FileId>) || generateIdFromFile(imageFile));

    if (!fileId) {
      console.warn(
        "Couldn't generate file id or the supplied `generateIdForFile` didn't resolve to one.",
      );
      throw new Error(t("errors.imageInsertError"));
    }

    const existingFileData = this.app.files[fileId];
    if (!existingFileData?.dataURL) {
      const { maxWidthOrHeight, maxFileSizeBytes } =
        this.app.props.imageOptions;

      try {
        imageFile = await resizeImageFile(imageFile, {
          maxWidthOrHeight,
        });
      } catch (error: any) {
        console.error(
          "Error trying to resizing image file on insertion",
          error,
        );
      }

      if (imageFile.size > maxFileSizeBytes) {
        throw new Error(
          t("errors.fileTooBig", {
            maxSize: `${Math.trunc(maxFileSizeBytes / 1024 / 1024)}MB`,
          }),
        );
      }
    }

    const dataURL =
      this.app.files[fileId]?.dataURL || (await getDataURL(imageFile));

    return new Promise<NonDeleted<InitializedExcalidrawImageElement>>(
      async (resolve, reject) => {
        try {
          let initializedImageElement = this.getLatestInitializedImageElement(
            placeholderImageElement,
            fileId,
          );

          this.dependencies.addMissingFiles([
            {
              mimeType,
              id: fileId,
              dataURL,
              created: Date.now(),
              lastRetrieved: Date.now(),
            },
          ]);

          if (!this.app.imageCache.get(fileId)) {
            this.addNewImagesToImageCache();

            const { erroredFiles } = await this.updateImageCache([
              initializedImageElement,
            ]);

            if (erroredFiles.size) {
              throw new Error("Image cache update resulted with an error.");
            }
          }

          const imageHTML = await this.app.imageCache.get(fileId)?.image;

          if (
            imageHTML &&
            this.app.state.newElement?.id !== initializedImageElement.id
          ) {
            initializedImageElement = this.getLatestInitializedImageElement(
              placeholderImageElement,
              fileId,
            );

            const naturalDimensions = this.getImageNaturalDimensions(
              initializedImageElement,
              imageHTML,
            );

            // no need to create a new instance anymore, just assign the natural dimensions
            Object.assign(initializedImageElement, naturalDimensions);
          }

          resolve(initializedImageElement);
        } catch (error: any) {
          console.error(error);
          reject(new Error(t("errors.imageInsertError")));
        }
      },
    );
  };

  /**
   * use during async image initialization,
   * when the placeholder image could have been modified in the meantime,
   * and when you don't want to loose those modifications
   */
  private getLatestInitializedImageElement = (
    imagePlaceholder: ExcalidrawImageElement,
    fileId: FileId,
  ) => {
    const latestImageElement =
      this.app.scene.getElement(imagePlaceholder.id) ?? imagePlaceholder;

    return newElementWith(
      latestImageElement as NonDeleted<InitializedExcalidrawImageElement>,
      {
        fileId,
      },
    );
  };

  private getImageNaturalDimensions = (
    imageElement: ExcalidrawImageElement,
    imageHTML: HTMLImageElement,
  ) => {
    const minHeight = Math.max(this.app.state.height - 120, 160);
    // max 65% of canvas height, clamped to <300px, vh - 120px>
    const maxHeight = Math.min(
      minHeight,
      Math.floor(this.app.state.height * 0.5) / this.app.state.zoom.value,
    );

    const height = Math.min(imageHTML.naturalHeight, maxHeight);
    const width = height * (imageHTML.naturalWidth / imageHTML.naturalHeight);

    // add current imageElement width/height to account for previous centering
    // of the placeholder image
    const x = imageElement.x + imageElement.width / 2 - width / 2;
    const y = imageElement.y + imageElement.height / 2 - height / 2;

    return {
      x,
      y,
      width,
      height,
      crop: null,
    };
  };

  /** updates image cache, refreshing updated elements and/or setting status
      to error for images that fail during <img> element creation */
  private updateImageCache = async (
    elements: readonly InitializedExcalidrawImageElement[],
    files = this.app.files,
  ) => {
    const { updatedFiles, erroredFiles } = await _updateImageCache({
      imageCache: this.app.imageCache,
      fileIds: elements.map((element) => element.fileId),
      files,
      createImage: () => this.app.renderEnvironment.createImage(),
    });

    if (erroredFiles.size) {
      this.app.store.scheduleAction(CaptureUpdateAction.NEVER);
      this.app.scene.replaceAllElements(
        this.app.scene.getElementsIncludingDeleted().map((element) => {
          if (
            isInitializedImageElement(element) &&
            erroredFiles.has(element.fileId)
          ) {
            return newElementWith(element, {
              status: "error",
            });
          }
          return element;
        }),
      );
    }

    return { updatedFiles, erroredFiles };
  };

  /** adds new images to imageCache and re-renders if needed */
  public addNewImagesToImageCache = async (
    imageElements: InitializedExcalidrawImageElement[] = getInitializedImageElements(
      this.app.scene.getNonDeletedElements(),
    ),
    files: BinaryFiles = this.app.files,
  ) => {
    const uncachedImageElements = imageElements.filter(
      (element) =>
        !element.isDeleted && !this.app.imageCache.has(element.fileId),
    );

    if (uncachedImageElements.length) {
      const { updatedFiles } = await this.updateImageCache(
        uncachedImageElements,
        files,
      );

      if (updatedFiles.size) {
        for (const element of uncachedImageElements) {
          if (updatedFiles.has(element.fileId)) {
            ShapeCache.delete(element);
          }
        }
      }

      if (updatedFiles.size) {
        this.app.scene.triggerUpdate();
      }
    }
  };

  /** generally you should use `addNewImagesToImageCache()` directly if you need
   *  to render new images. This is just a failsafe  */
  public scheduleImageRefresh = throttle(() => {
    this.addNewImagesToImageCache();
  }, IMAGE_RENDER_TIMEOUT);

  public insertImages = async (
    imageFiles: File[],
    sceneX: number,
    sceneY: number,
  ) => {
    const gridPadding = 50 / this.app.state.zoom.value;
    // Create, position, and insert placeholders
    const placeholders = positionElementsOnGrid(
      imageFiles.map(() => this.newImagePlaceholder({ sceneX, sceneY })),
      sceneX,
      sceneY,
      gridPadding,
    );
    this.app.insertNewElements(placeholders);

    // Create, position, insert and select initialized (replacing placeholders)
    const initialized = await Promise.all(
      placeholders.map(async (placeholder, i) => {
        try {
          return await this.initializeImage(
            placeholder,
            await normalizeFile(imageFiles[i]),
          );
        } catch (error: any) {
          this.app.setState({
            errorMessage: error.message || t("errors.imageInsertError"),
          });
          return newElementWith(placeholder as ExcalidrawImageElement, {
            isDeleted: true,
          });
        }
      }),
    );
    const initializedMap = arrayToMap(initialized);

    const positioned = positionElementsOnGrid(
      initialized.filter((el) => !el.isDeleted),
      sceneX,
      sceneY,
      gridPadding,
    );
    const positionedMap = arrayToMap(positioned);

    const nextElements = this.app.scene
      .getElementsIncludingDeleted()
      .map((el) => positionedMap.get(el.id) ?? initializedMap.get(el.id) ?? el);

    this.app.updateScene({
      appState: {
        selectedElementIds: makeNextSelectedElementIds(
          Object.fromEntries(positioned.map((el) => [el.id, true])),
          this.app.state,
        ),
      },
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    this.app.setState({}, () => {
      // actionFinalize after all state values have been updated
      this.app.actionManager.executeAction(actionFinalize);
    });
  };

  public clearImageShapeCache(filesMap?: BinaryFiles) {
    const files = filesMap ?? this.app.files;
    this.app.scene.getNonDeletedElements().forEach((element) => {
      if (isInitializedImageElement(element) && files[element.fileId]) {
        this.app.imageCache.delete(element.fileId);
        ShapeCache.delete(element);
      }
    });
  }
}
