import { flushSync } from "react-dom";

import {
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
  fixBindingsAfterDeletion,
  getCommonBounds,
  getEmbedLink,
  getLineHeightInPx,
  getTextAnchorRatios,
  isTextElement,
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
import {
  isMaybeMermaidDefinition,
  MERMAID_TO_EXCALIDRAW_CONFIG,
} from "../mermaid";
import { withBatchedUpdates } from "../reactUtils";
import { scrollBoundsIntoView } from "../viewport";

import type React from "react";

import type {
  ClipboardData,
  ParsedDataTransferFile,
  PastedMixedContent,
} from "../clipboard";
import type App from "./App";
import type { AppState, Offsets } from "../types";

let IS_PLAIN_PASTE = false;
let IS_PLAIN_PASTE_TIMER = 0;

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
  /**
   * The toast offering to have the text pasted last the other way (split
   * into lines, or as one element), while it's offered.
   */
  private pasteToast: AppState["toast"] = null;

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
              { renderEnvironment: this.app.renderEnvironment },
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
      try {
        // if this fails to load (e.g. offline), fall through and paste as text
        const api = await import("@excalidraw/mermaid-to-excalidraw");
        const { elements: skeletonElements, files = {} } =
          await api.parseMermaidToExcalidraw(
            data.text,
            MERMAID_TO_EXCALIDRAW_CONFIG,
          );

        const elements = convertToExcalidrawElements(skeletonElements, {
          regenerateIds: true,
          renderEnvironment: this.app.renderEnvironment,
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
      .filter(Boolean)
      // some embed codes (e.g. Instagram) put the provider's loader <script>
      // on a separate line, which isn't an embed by itself
      .filter(
        (s) =>
          !/^<script\b[^>]*>\s*<\/script\b[^>]*>\s*$/i.test(s) ||
          maybeParseEmbedSrc(s) !== s,
      );
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
            ? prevEmbeddable.x + prevEmbeddable.width + 20
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

      // the offer for the text pasted before is for the last paste only
      if (this.pasteToast && this.app.state.toast === this.pasteToast) {
        this.app.setToast(null);
      }
      this.pasteToast = null;

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
      strokeWidth: this.app.getCurrentItemStrokeWidth("text"),
      strokeStyle: this.app.state.currentItemStrokeStyle,
      roundness: null,
      roughness: this.app.state.currentItemRoughness,
      opacity: this.app.state.currentItemOpacity,
      text,
      fontSize: this.app.state.currentItemFontSize,
      fontFamily: this.app.state.currentItemFontFamily,
      textAlign: this.app.state.currentItemTextAlign,
      verticalAlign: DEFAULT_VERTICAL_ALIGN,
      locked: false,
    };
    const fontString = getFontString({
      fontSize: textElementProps.fontSize,
      fontFamily: textElementProps.fontFamily,
    });
    const lineHeight = getLineHeight(textElementProps.fontFamily);

    const originalText = normalizeText(text).trim();
    // a phone shows no toast, to have a text the other way from
    const isPhone = this.app.editorInterface.formFactor === "phone";
    // as last chosen from the toast after a paste (kept by the host, with
    // the app state it stores)
    const asLines = !isPlainPaste && !isPhone && this.app.state.splitOnPaste;
    /** the text as one element, as laid out last: what its lines are of */
    let singleTextElement: ExcalidrawTextElement | null = null;
    // one element, centered at the pointer — or, as chosen from the toast
    // before, its lines, as splitting it lays them out (either can be had
    // the other way after, from the toast)
    const createTextElements = (maxTextWidth: number) => {
      if (!originalText.length) {
        return [];
      }
      const wraps =
        measureText(
          originalText,
          fontString,
          lineHeight,
          this.app.renderEnvironment,
        ).width > maxTextWidth;
      const wrappedText = wraps
        ? wrapText(
            originalText,
            fontString,
            maxTextWidth,
            this.app.renderEnvironment,
          )
        : originalText;
      const metrics = measureText(
        wrappedText,
        fontString,
        lineHeight,
        this.app.renderEnvironment,
      );
      const topLayerFrame = this.app.getTopLayerFrameAtSceneCoords({ x, y });
      // a text's placed at its anchor: its left edge, center or right edge,
      // as it's aligned
      const { x: anchorRatio } = getTextAnchorRatios(textElementProps);
      const textElement = newTextElement({
        ...textElementProps,
        x: x + metrics.width * (anchorRatio - 0.5),
        y: y - metrics.height / 2,
        text: wrappedText,
        originalText,
        lineHeight,
        autoResize: !wraps,
        frameId: topLayerFrame ? topLayerFrame.id : null,
        renderEnvironment: this.app.renderEnvironment,
      });
      singleTextElement = textElement;
      const lines = asLines && this.layoutTextLines(textElement);
      if (!lines) {
        return [textElement];
      }
      // the lines are centered at the pointer as what they take themselves:
      // less than the text does, with blank lines between them
      const [x1, y1, x2, y2] = getCommonBounds(lines);
      return (
        this.layoutTextLines(
          newElementWith(textElement, {
            x: textElement.x + x - (x1 + x2) / 2,
            y: textElement.y + y - (y1 + y2) / 2,
          }),
        ) ?? lines
      );
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

    if (isPlainPaste || isPhone) {
      return;
    }
    const single: ExcalidrawTextElement | null = singleTextElement;
    if (textElements.length > 1 && single) {
      const lineIds = textElements.map((element) => element.id);
      this.showPasteToast(
        t("toast.pastedAsTextElements"),
        t("toast.pasteAsSingleText"),
        () => {
          this.app.setState({ splitOnPaste: false });
          this.replaceTextLines(lineIds, single);
        },
      );
    } else if (getTextLines(textElements[0]).length > 1) {
      const [{ id }] = textElements;
      this.showPasteToast(
        t("toast.pastedAsSingleText"),
        t("toast.splitIntoTextElements"),
        () => {
          this.app.setState({ splitOnPaste: true });
          this.splitTextIntoLines(id);
        },
      );
    }
  }

  /** the toast offering to have the text just pasted the other way */
  private showPasteToast(message: string, label: string, onClick: () => void) {
    this.pasteToast = {
      message,
      action: {
        label,
        onClick: () => {
          onClick();
          // the button's gone with the toast, and the focus with it
          this.app.focusContainer();
        },
      },
      duration: 8000,
    };
    this.app.setToast(this.pasteToast);
  }

  /** splits a text into an element per line, in its place (one step to undo) */
  private splitTextIntoLines(elementId: ExcalidrawTextElement["id"]) {
    const element = this.app.scene.getElement(elementId);
    if (
      !element ||
      element.isDeleted ||
      !isTextElement(element) ||
      element.containerId
    ) {
      return;
    }
    const lines = this.layoutTextLines(element);
    if (lines) {
      this.replaceTextElements([element], lines);
    }
  }

  /**
   * A text's lines (blank ones dropped) as elements of their own, laid out
   * as in it: each line where it was across, indented and wrapped as it
   * was, and stacked top to bottom from its top, half a line height apart.
   * None for a text of one line.
   */
  private layoutTextLines(element: ExcalidrawTextElement) {
    const lines = getTextLines(element);
    if (lines.length < 2) {
      return null;
    }

    const fontString = getFontString(element);
    const { lineHeight } = element;
    const lineGap = getLineHeightInPx(element.fontSize, lineHeight) / 2;
    // a text's placed at its anchor: its left edge, center or right edge,
    // as it's aligned (and its top, middle or bottom)
    const anchorRatios = getTextAnchorRatios(element);
    const anchorX = element.x + element.width * anchorRatios.x;
    let currentY = element.y;
    return lines.map(({ originalText, text }) => {
      const { width, height } = measureText(
        text,
        fontString,
        lineHeight,
        this.app.renderEnvironment,
      );
      // moved down by the gaps, a line may've left the frame: each is in
      // the one at its center, as a pasted text is
      const topLayerFrame = this.app.getTopLayerFrameAtSceneCoords({
        x: anchorX + width * (0.5 - anchorRatios.x),
        y: currentY + height / 2,
      });
      const textElement = newTextElement({
        x: anchorX,
        y: currentY + height * anchorRatios.y,
        text,
        originalText,
        autoResize: !text.includes("\n"),
        fontSize: element.fontSize,
        fontFamily: element.fontFamily,
        textAlign: element.textAlign,
        verticalAlign: element.verticalAlign,
        lineHeight,
        strokeColor: element.strokeColor,
        backgroundColor: element.backgroundColor,
        fillStyle: element.fillStyle,
        strokeWidth: element.strokeWidth,
        strokeStyle: element.strokeStyle,
        roughness: element.roughness,
        roundness: element.roundness,
        opacity: element.opacity,
        groupIds: element.groupIds,
        frameId: topLayerFrame ? topLayerFrame.id : null,
        locked: element.locked,
        renderEnvironment: this.app.renderEnvironment,
      });
      currentY += height + lineGap;
      return textElement;
    });
  }

  /**
   * Replaces the lines a text was pasted split into with the text as one
   * element — the very one it'd have been pasted as — where they are now:
   * at the first one's top, as aligned. One step to undo.
   */
  private replaceTextLines(
    lineIds: readonly ExcalidrawTextElement["id"][],
    /** the text as one element, as laid out when pasted */
    single: ExcalidrawTextElement,
  ) {
    const lines: ExcalidrawTextElement[] = [];
    for (const id of lineIds) {
      const line = this.app.scene.getElement(id);
      if (!line || line.isDeleted || !isTextElement(line) || line.containerId) {
        return;
      }
      lines.push(line);
    }

    const [first] = lines;
    const { x: anchorRatio } = getTextAnchorRatios(first);
    const x = first.x + (first.width - single.width) * anchorRatio;
    const topLayerFrame = this.app.getTopLayerFrameAtSceneCoords({
      x: x + single.width / 2,
      y: first.y + single.height / 2,
    });
    this.replaceTextElements(lines, [
      newElementWith(single, {
        x,
        y: first.y,
        frameId: topLayerFrame ? topLayerFrame.id : null,
      }),
    ]);
  }

  /**
   * Replaces texts with others, selected: in the first one's place in the
   * layer order (but for those in another frame, which join its children),
   * arrows bound to the replaced ones let go of. One step to undo.
   */
  private replaceTextElements(
    previous: readonly ExcalidrawTextElement[],
    next: readonly ExcalidrawTextElement[],
  ) {
    const [first] = previous;
    fixBindingsAfterDeletion(this.app.scene.getNonDeletedElements(), previous);
    for (const element of previous) {
      this.app.scene.mutateElement(element, { isDeleted: true });
    }
    const [inPlace, inOtherFrame] = next.reduce(
      (acc: [ExcalidrawTextElement[], ExcalidrawTextElement[]], element) => {
        acc[
          element.frameId === null || element.frameId === first.frameId ? 0 : 1
        ].push(element);
        return acc;
      },
      [[], []],
    );
    this.app.scene.insertElementsAtIndex(
      inPlace,
      this.app.scene.getElementIndex(first.id),
    );
    this.app.insertNewElements(inOtherFrame);
    this.app.store.scheduleCapture();
    this.app.setState({
      selectedElementIds: makeNextSelectedElementIds(
        Object.fromEntries(next.map((element) => [element.id, true])),
        this.app.state,
      ),
    });
  }
}

/**
 * A text's lines (blank ones dropped), each as it's wrapped in the text:
 * the rows it takes there are told by what's in them, as wrapping drops
 * nothing but whitespace. Wrapping a line anew may break it elsewhere (the
 * text's width is what its rows measure, not what they were wrapped to).
 */
const getTextLines = (element: ExcalidrawTextElement) => {
  // normalized, as text is for wrapping (a row may be shorter than what
  // it's of in the line)
  const getLength = (text: string) =>
    text.replace(/\s/g, "").normalize("NFC").length;
  const rows = element.text.split("\n");
  let rowIndex = 0;
  return element.originalText.split("\n").flatMap((line) => {
    const length = getLength(line);
    let text = rows[rowIndex++] ?? "";
    while (rowIndex < rows.length && getLength(text) < length) {
      text += `\n${rows[rowIndex++]}`;
    }
    return length
      ? [{ originalText: line.trimEnd(), text: text.trimEnd() }]
      : [];
  });
};
