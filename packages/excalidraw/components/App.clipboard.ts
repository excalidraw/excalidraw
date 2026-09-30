import { flushSync } from "react-dom";

import {
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  getFontString,
  getLineHeight,
  isWritableElement,
  normalizeEOL,
  normalizeLink,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  convertToExcalidrawElements,
  embeddableURLValidator,
  getAuthoringScale,
  getCommonBounds,
  getEmbedLink,
  getLineHeightInPx,
  makeNextSelectedElementIds,
  maybeParseEmbedSrc,
  measureText,
  newElementWith,
  newTextElement,
  normalizeText,
  wrapText,
} from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { actionCopy, actionCut } from "../actions";
import { tryParseSpreadsheet } from "../charts";
import { parseClipboard, parseDataTransferEvent } from "../clipboard";
import { ImageURLToFile, SVGStringToFile } from "../data/blob";
import { t } from "../i18n";
import { isMaybeMermaidDefinition } from "../mermaid";
import { withBatchedUpdates } from "../reactUtils";
import { getShortcutKey } from "../shortcut";
import { scrollBoundsIntoView } from "../viewport";

import type React from "react";

import type {
  ClipboardData,
  ParsedDataTransferFile,
  PastedMixedContent,
} from "../clipboard";
import type App from "./App";
import type { Offsets } from "../types";

let IS_PLAIN_PASTE = false;
let IS_PLAIN_PASTE_TIMER = 0;
let PLAIN_PASTE_TOAST_SHOWN = false;

type AppClipboardDependencies = {
  getContainer: () => HTMLDivElement | null;
};

/**
 * The clipboard: cut and copy (through their actions), and paste — the
 * pasted data parsed (`pasteFromClipboard`) and inserted as whatever it is
 * (`insertClipboardContent`): images or SVG code, elements, a Mermaid
 * definition, embeddable URLs, a spreadsheet (as a chart), mixed content,
 * or text. Pasted elements go in through `app.addElementsFromPasteOrLibrary`,
 * as a library item or a drop does.
 */
export class AppClipboard {
  constructor(
    private app: App,
    private dependencies: AppClipboardDependencies,
  ) {}

  // Copy/paste

  public onCut = withBatchedUpdates((event: ClipboardEvent) => {
    if (!this.app.isInteractionEnabled()) {
      return;
    }
    const isExcalidrawActive = this.dependencies
      .getContainer()
      ?.contains(this.app.ownerDocument.activeElement);
    if (!isExcalidrawActive || isWritableElement(event.target)) {
      return;
    }
    this.app.actionManager.executeAction(actionCut, "keyboard", event);
    event.preventDefault();
    event.stopPropagation();
  });

  public onCopy = withBatchedUpdates((event: ClipboardEvent) => {
    if (!this.app.isInteractionEnabled()) {
      return;
    }
    const isExcalidrawActive = this.dependencies
      .getContainer()
      ?.contains(this.app.ownerDocument.activeElement);
    if (!isExcalidrawActive || isWritableElement(event.target)) {
      return;
    }
    this.app.actionManager.executeAction(actionCopy, "keyboard", event);
    event.preventDefault();
    event.stopPropagation();
  });

  // TODO: Cover with tests
  private async insertClipboardContent(
    data: ClipboardData,
    dataTransferFiles: ParsedDataTransferFile[],
    isPlainPaste: boolean,
  ) {
    const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      {
        clientX: this.app.viewport.lastPosition.x,
        clientY: this.app.viewport.lastPosition.y,
      },
      this.app.state,
    );

    // ------------------- Error -------------------
    if (data.errorMessage) {
      this.app.setState({ errorMessage: data.errorMessage });
      return;
    }

    // ------------------- Mixed content with no files -------------------
    if (dataTransferFiles.length === 0 && !isPlainPaste && data.mixedContent) {
      await this.addElementsFromMixedContentPaste(data.mixedContent, {
        isPlainPaste,
        sceneX,
        sceneY,
      });
      return;
    }

    // ------------------- Spreadsheet -------------------

    if (!isPlainPaste && data.text) {
      const result = tryParseSpreadsheet(data.text);
      if (result.ok) {
        this.app.setState({
          openDialog: {
            name: "charts",
            data: result.data,
            rawText: data.text,
          },
        });
        return;
      }
    }

    // ------------------- Images or SVG code -------------------
    const imageFiles = dataTransferFiles.map((data) => data.file);

    if (imageFiles.length === 0 && data.text && !isPlainPaste) {
      const trimmedText = data.text.trim();
      if (trimmedText.startsWith("<svg") && trimmedText.endsWith("</svg>")) {
        // ignore SVG validation/normalization which will be done during image
        // initialization
        imageFiles.push(SVGStringToFile(trimmedText));
      }
    }

    if (imageFiles.length > 0) {
      if (this.app.isToolSupported("image")) {
        await this.app.insertImages(imageFiles, sceneX, sceneY);
      } else {
        this.app.setState({ errorMessage: t("errors.imageToolNotSupported") });
      }
      return;
    }

    // ------------------- Elements -------------------
    if (data.elements) {
      const elements = (
        data.programmaticAPI
          ? convertToExcalidrawElements(
              data.elements as ExcalidrawElementSkeleton[],
            )
          : data.elements
      ) as readonly ExcalidrawElement[];
      // TODO: remove formatting from elements if isPlainPaste
      this.app.addElementsFromPasteOrLibrary({
        elements,
        files: data.files || null,
        position:
          this.app.editorInterface.formFactor === "desktop"
            ? "cursor"
            : "center",
        retainSeed: isPlainPaste,
        preserveFrameChildrenOrder: true,
      });
      return;
    }

    // ------------------- Only textual stuff remaining -------------------
    if (!data.text) {
      return;
    }

    // ------------------- Successful Mermaid -------------------
    if (!isPlainPaste && isMaybeMermaidDefinition(data.text)) {
      const api = await import("@excalidraw/mermaid-to-excalidraw");
      try {
        const { elements: skeletonElements, files = {} } =
          await api.parseMermaidToExcalidraw(data.text);

        const elements = convertToExcalidrawElements(skeletonElements, {
          regenerateIds: true,
        });

        this.app.addElementsFromPasteOrLibrary({
          elements,
          files,
          position:
            this.app.editorInterface.formFactor === "desktop"
              ? "cursor"
              : "center",
        });

        return;
      } catch (err: any) {
        console.warn(
          `parsing pasted text as mermaid definition failed: ${err.message}`,
        );
      }
    }

    // ------------------- Pure embeddable URLs -------------------
    const nonEmptyLines = normalizeEOL(data.text)
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const embbeddableUrls = nonEmptyLines
      .map((str) => maybeParseEmbedSrc(str))
      .filter(
        (string) =>
          embeddableURLValidator(string, this.app.props.validateEmbeddable) &&
          (/^(http|https):\/\/[^\s/$.?#].[^\s]*$/.test(string) ||
            getEmbedLink(string)?.type === "video"),
      );

    if (
      !isPlainPaste &&
      embbeddableUrls.length > 0 &&
      embbeddableUrls.length === nonEmptyLines.length
    ) {
      const embeddables: NonDeleted<ExcalidrawEmbeddableElement>[] = [];
      for (const url of embbeddableUrls) {
        const prevEmbeddable: ExcalidrawEmbeddableElement | undefined =
          embeddables[embeddables.length - 1];
        const embeddable = this.app.insertEmbeddableElement({
          sceneX: prevEmbeddable
            ? prevEmbeddable.x +
              prevEmbeddable.width +
              20 * getAuthoringScale(this.app.state)
            : sceneX,
          sceneY,
          link: normalizeLink(url),
        });
        if (embeddable) {
          embeddables.push(embeddable);
        }
      }
      if (embeddables.length) {
        this.app.store.scheduleCapture();
        this.app.setState({
          selectedElementIds: Object.fromEntries(
            embeddables.map((embeddable) => [embeddable.id, true]),
          ),
        });
      }
      return;
    }

    // ------------------- Text -------------------
    this.addTextFromPaste(data.text, isPlainPaste);
  }

  /**
   * Ctrl/Cmd+V: whether the paste event that follows is a plain one (with
   * Shift)
   */
  public onPasteShortcut = (event: React.KeyboardEvent | KeyboardEvent) => {
    IS_PLAIN_PASTE = event.shiftKey;
    clearTimeout(IS_PLAIN_PASTE_TIMER);
    // reset (100ms to be safe that we it runs after the ensuing
    // paste event). Though, technically unnecessary to reset since we
    // (re)set the flag before each paste event.
    IS_PLAIN_PASTE_TIMER = this.app.ownerWindow.setTimeout(() => {
      IS_PLAIN_PASTE = false;
    }, 100);
  };

  public clearPlainPaste = () => {
    clearTimeout(IS_PLAIN_PASTE_TIMER);
    IS_PLAIN_PASTE_TIMER = 0;
    IS_PLAIN_PASTE = false;
  };

  public pasteFromClipboard = withBatchedUpdates(
    async (event: ClipboardEvent) => {
      if (!this.app.isInteractionEnabled()) {
        return;
      }

      const isPlainPaste = !!IS_PLAIN_PASTE;

      // #686
      const target = this.app.ownerDocument.activeElement;
      const isExcalidrawActive = this.dependencies
        .getContainer()
        ?.contains(target);
      if (event && !isExcalidrawActive) {
        return;
      }

      const elementUnderCursor = this.app.ownerDocument.elementFromPoint(
        this.app.viewport.lastPosition.x,
        this.app.viewport.lastPosition.y,
      );
      if (
        event &&
        (!(
          elementUnderCursor instanceof this.app.ownerWindow.HTMLCanvasElement
        ) ||
          isWritableElement(target))
      ) {
        return;
      }

      // must be called in the same frame (thus before any awaits) as the paste
      // event else some browsers (FF...) will clear the clipboardData
      // (something something security)
      const dataTransferList = await parseDataTransferEvent(event);

      const filesList = dataTransferList.getFiles();

      const data = await parseClipboard(dataTransferList, isPlainPaste);

      if (this.app.props.onPaste) {
        try {
          if ((await this.app.props.onPaste(data, event)) === false) {
            return;
          }
        } catch (error: any) {
          console.error(error);
        }
      }

      await this.insertClipboardContent(data, filesList, isPlainPaste);

      this.app.setActiveTool(
        { type: this.app.state.preferredSelectionTool.type },
        { keepSelection: true },
      );
      event?.preventDefault();
    },
  );

  // TODO rewrite this to paste both text & images at the same time if
  // pasted data contains both
  private async addElementsFromMixedContentPaste(
    mixedContent: PastedMixedContent,
    {
      isPlainPaste,
      sceneX,
      sceneY,
    }: { isPlainPaste: boolean; sceneX: number; sceneY: number },
  ) {
    if (
      !isPlainPaste &&
      mixedContent.some((node) => node.type === "imageUrl") &&
      this.app.isToolSupported("image")
    ) {
      const imageURLs = mixedContent
        .filter((node) => node.type === "imageUrl")
        .map((node) => node.value);
      const responses = await Promise.all(
        imageURLs.map(async (url) => {
          try {
            return { file: await ImageURLToFile(url) };
          } catch (error: any) {
            let errorMessage = error.message;
            if (error.cause === "FETCH_ERROR") {
              errorMessage = t("errors.failedToFetchImage");
            } else if (error.cause === "UNSUPPORTED") {
              errorMessage = t("errors.unsupportedFileType");
            }
            return { errorMessage };
          }
        }),
      );

      const imageFiles = responses
        .filter((response): response is { file: File } => !!response.file)
        .map((response) => response.file);
      await this.app.insertImages(imageFiles, sceneX, sceneY);
      const error = responses.find((response) => !!response.errorMessage);
      if (error && error.errorMessage) {
        this.app.setState({ errorMessage: error.errorMessage });
      }
    } else {
      const textNodes = mixedContent.filter((node) => node.type === "text");
      if (textNodes.length) {
        this.addTextFromPaste(
          textNodes.map((node) => node.value).join("\n\n"),
          isPlainPaste,
        );
      }
    }
  }

  private addTextFromPaste(text: string, isPlainPaste = false) {
    const { x, y } = viewportCoordsToSceneCoords(
      {
        clientX: this.app.viewport.lastPosition.x,
        clientY: this.app.viewport.lastPosition.y,
      },
      this.app.state,
    );

    const textElementProps = {
      x,
      y,
      strokeColor: this.app.state.currentItemStrokeColor,
      backgroundColor: this.app.state.currentItemBackgroundColor,
      fillStyle: this.app.state.currentItemFillStyle,
      ...this.app.getCurrentItemScale("text"),
      strokeStyle: this.app.state.currentItemStrokeStyle,
      roundness: null,
      roughness: this.app.state.currentItemRoughness,
      opacity: this.app.state.currentItemOpacity,
      text,
      fontSize: this.app.getCurrentItemFontSize(),
      fontFamily: this.app.state.currentItemFontFamily,
      textAlign: DEFAULT_TEXT_ALIGN,
      verticalAlign: DEFAULT_VERTICAL_ALIGN,
      locked: false,
    };
    const fontString = getFontString({
      fontSize: textElementProps.fontSize,
      fontFamily: textElementProps.fontFamily,
    });
    const lineHeight = getLineHeight(textElementProps.fontFamily);
    const LINE_GAP = 10 * getAuthoringScale(this.app.state);

    const lines = isPlainPaste ? [text] : text.split("\n");
    const createTextElements = (maxTextWidth: number) => {
      let currentY = y;
      return lines.reduce((acc: ExcalidrawTextElement[], line, idx) => {
        const originalText = normalizeText(line).trim();
        if (originalText.length) {
          const topLayerFrame = this.app.getTopLayerFrameAtSceneCoords({
            x,
            y: currentY,
          });

          let metrics = measureText(originalText, fontString, lineHeight);
          const isTextUnwrapped = metrics.width > maxTextWidth;

          const text = isTextUnwrapped
            ? wrapText(originalText, fontString, maxTextWidth)
            : originalText;

          metrics = isTextUnwrapped
            ? measureText(text, fontString, lineHeight)
            : metrics;

          const startX = x - metrics.width / 2;
          const startY = currentY - metrics.height / 2;

          const element = newTextElement({
            ...textElementProps,
            x: startX,
            y: startY,
            text,
            originalText,
            lineHeight,
            autoResize: !isTextUnwrapped,
            frameId: topLayerFrame ? topLayerFrame.id : null,
          });
          acc.push(element);
          currentY += element.height + LINE_GAP;
        } else {
          const prevLine = lines[idx - 1]?.trim();
          // add paragraph only if previous line was not empty, IOW don't add
          // more than one empty line
          if (prevLine) {
            currentY +=
              getLineHeightInPx(textElementProps.fontSize, lineHeight) +
              LINE_GAP;
          }
        }

        return acc;
      }, []);
    };

    // long texts wrap as a typed one does; wrapped to fit the view, all of
    // it is brought in view, too — by moving it there (as far as the view
    // would have to scroll), not the view
    const pasteWithin = (offsets: Required<Offsets>) => {
      const textElements = createTextElements(
        this.app.text.getMaxTextWidth(offsets),
      );
      const scroll =
        textElements.length && textElements.some((el) => !el.autoResize)
          ? scrollBoundsIntoView({
              bounds: getCommonBounds(textElements),
              appState: this.app.state,
              offsets,
            })
          : null;
      if (!scroll) {
        return textElements;
      }
      const dx = scroll.scrollX - this.app.state.scrollX;
      const dy = scroll.scrollY - this.app.state.scrollY;
      return textElements.map((element) => {
        const nextX = element.x + dx;
        const nextY = element.y + dy;
        // at the point it's pasted at: its center
        const topLayerFrame = this.app.getTopLayerFrameAtSceneCoords({
          x: nextX + element.width / 2,
          y: nextY + element.height / 2,
        });
        return newElementWith(element, {
          x: nextX,
          y: nextY,
          frameId: topLayerFrame ? topLayerFrame.id : null,
        });
      });
    };
    // laid out as if the stats panel weren't there, to see where it lands:
    // it counts only beside it
    const offsets = this.app.text.getTextViewportOffsets();
    let textElements = pasteWithin(offsets);
    if (textElements.length === 0) {
      return;
    }
    const getSelectedElementIds = () =>
      makeNextSelectedElementIds(
        Object.fromEntries(textElements.map((el) => [el.id, true])),
        this.app.state,
      );

    if (this.app.viewport.getSideUIRect("stats")) {
      // selected, it's in the stats panel, which grows to show its
      // properties: rendered so (not captured yet), the panels are measured
      // as they'll be — the styles panel, too, shown then, not reserved
      flushSync(() => {
        this.app.insertNewElements(textElements);
        this.app.setState({ selectedElementIds: getSelectedElementIds() });
      });
      const besideOffsets = this.app.text.getTextViewportOffsets(
        getCommonBounds(textElements),
      );
      if (
        besideOffsets.left !== offsets.left ||
        besideOffsets.right !== offsets.right
      ) {
        // beside the stats panel, or the styles panel's not as reserved:
        // laid out again, as the same elements (for anyone who's seen them
        // rendered already)
        const relaid = pasteWithin(besideOffsets);
        const pastedIds = new Set(textElements.map((element) => element.id));
        textElements = textElements.map((element, index) => {
          const { x, y, width, height, text, autoResize, frameId } =
            relaid[index];
          return newElementWith(element, {
            x,
            y,
            width,
            height,
            text,
            autoResize,
            frameId,
          });
        });
        this.app.scene.replaceAllElements(
          this.app.scene
            .getElementsIncludingDeleted()
            .filter((element) => !pastedIds.has(element.id)),
        );
        this.app.insertNewElements(textElements);
      }
    } else {
      this.app.insertNewElements(textElements);
    }
    this.app.store.scheduleCapture();
    this.app.setState({ selectedElementIds: getSelectedElementIds() });

    if (
      !isPlainPaste &&
      textElements.length > 1 &&
      PLAIN_PASTE_TOAST_SHOWN === false &&
      this.app.editorInterface.formFactor !== "phone"
    ) {
      this.app.setToast({
        message: t("toast.pasteAsSingleElement", {
          shortcut: getShortcutKey("CtrlOrCmd+Shift+V"),
        }),
        duration: 5000,
      });
      PLAIN_PASTE_TOAST_SHOWN = true;
    }
  }
}
