import { flushSync } from "react-dom";

import {
  DEFAULT_VERTICAL_ALIGN,
  TEXT_MAX_WRAP_WIDTH,
  TEXT_TO_CENTER_SNAP_THRESHOLD,
  TEXT_VIEWPORT_PADDING,
  VERTICAL_ALIGN,
  getFontString,
  getLineHeight,
  sceneCoordsToViewportCoords,
  type Bounds,
  type StylesPanelMode,
} from "@excalidraw/common";
import { pointFrom, type Radians } from "@excalidraw/math";

import {
  DEFAULT_BOUND_TEXT_LABEL_POSITION,
  fixBindingsAfterDeletion,
  getActiveTextElement,
  getApproxMinLineHeight,
  getApproxMinLineWidth,
  getBoundTextPadding,
  getBoundTextElement,
  getContainerCenter,
  getContainerElement,
  getElementAbsoluteCoords,
  getElementBounds,
  getLineHeightInPx,
  getStickyNoteLayout,
  hitElementItself,
  isArrowElement,
  isFrameLikeElement,
  isNonDeletedElement,
  isStickyNoteElement,
  isTextBindableContainer,
  isTextElement,
  isValidTextContainer,
  makeNextSelectedElementIds,
  newElementWith,
  newTextElement,
  refreshTextDimensions,
  updateBoundElements,
} from "@excalidraw/element";

import type { ArrowEndpoint } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { actionTextAutoResize } from "../actions/actionTextAutoResize";
import { withBatchedUpdates } from "../reactUtils";
import { isPointHittingTextAutoResizeHandle } from "../textAutoResizeHandle";
import { scrollBoundsIntoView } from "../viewport";
import { textWysiwyg } from "../wysiwyg/textWysiwyg";

import type App from "./App";
import type { AppState, Offsets, ViewportUIName } from "../types";

type AppTextDependencies = {
  getContainer: () => HTMLDivElement | null;
  getStylesPanelMode: () => StylesPanelMode;
};

/**
 * Texts, but for the text tool's pointer interaction (`AppTextTool`):
 *
 * - the editing session: what text to edit, or create, and where
 *   (`startTextEditing`), and the editor's lifecycle (`handleTextWysiwyg`)
 * - the part of the canvas a typed or pasted text is kept within
 *   (`getTextViewportOffsets`, `getMaxTextWidth`)
 * - the queries that find the text or container to edit at a position
 * - the handle that turns a fixed-width text back into a growing one
 *
 * Every way into editing ends up here: Enter, double-click, pointerup on a
 * selected text or container, the text tool, a drag-created text or sticky
 * note, and a sticky note dropped from the toolbar.
 */
export class AppText {
  constructor(private app: App, private dependencies: AppTextDependencies) {}

  public textWysiwygSubmitHandler: ReturnType<typeof textWysiwyg> | null = null;
  private getTextCreationGridPoint = (x: number, y: number) => {
    const effectiveGridSize = this.app.getEffectiveGridSize();

    if (effectiveGridSize === null) {
      return null;
    }

    const getTextCreationGridCoordinate = (coordinate: number) => {
      const topLeftGridPoint =
        Math.floor(coordinate / effectiveGridSize) * effectiveGridSize;

      return topLeftGridPoint;
    };

    return {
      x: getTextCreationGridCoordinate(x),
      y: getTextCreationGridCoordinate(y),
    };
  };

  /**
   * The side panels, besides the sidebar, that a typed or pasted text is
   * kept clear of: the stats panel, and the full styles panel (desktop),
   * which shows next to a text while it's edited, and once it's pasted and
   * selected.
   */
  public getTextSidePanels = (): ViewportUIName[] =>
    this.dependencies.getStylesPanelMode() === "full" &&
    this.app.isDefaultUIEnabled() &&
    !this.app.state.zenModeEnabled
      ? ["stats", "stylesPanel"]
      : ["stats"];

  /**
   * The part of the canvas a typed or pasted text is kept within, as offsets
   * from its edges (screen px): all of it but the sidebar and the side
   * panels (see getTextSidePanels), less some room at each side. The stats
   * panel covers the top of a side only, and counts only for a text beside
   * it: one (given by its scene bounds) with rows within that room of it.
   */
  public getTextViewportOffsets = (textBounds?: Bounds): Required<Offsets> => {
    const padding = TEXT_VIEWPORT_PADDING;
    const stats = textBounds && this.app.viewport.getSideUIRect("stats");
    const { scrollY, zoom } = this.app.state;
    const isBesideStats =
      !!stats &&
      !!textBounds &&
      (textBounds[1] + scrollY) * zoom.value < stats.bottom + padding &&
      (textBounds[3] + scrollY) * zoom.value > stats.top - padding;
    const { left, right } = this.app.viewport.getSideInsets(
      [
        "sidebar",
        ...this.getTextSidePanels().filter(
          (name) => name !== "stats" || isBesideStats,
        ),
      ],
      // the styles panel isn't shown yet when pasting with nothing selected
      { reserve: { stylesPanel: true } },
    );
    return {
      top: padding,
      right: right + padding,
      bottom: padding,
      left: left + padding,
    };
  };

  /**
   * The widest a text may grow to as it's typed or pasted, in scene units:
   * TEXT_MAX_WRAP_WIDTH, or less, so that a text never outgrows the part of
   * the canvas it's kept within.
   */
  public getMaxTextWidth = (offsets: Required<Offsets>) => {
    const { left, right } = offsets;
    const viewWidth = this.app.state.width - left - right;
    return Math.min(
      viewWidth > 0 ? viewWidth / this.app.state.zoom.value : Infinity,
      TEXT_MAX_WRAP_WIDTH,
    );
  };

  public handleTextWysiwyg(
    element: NonDeleted<ExcalidrawTextElement>,
    {
      isExistingElement = false,
      initialCaretSceneCoords = null,
    }: {
      isExistingElement?: boolean;
      /**
       * supply null if no caret positioning is desired, and instead
       * text should be auto-selected
       */
      initialCaretSceneCoords?: { x: number; y: number } | null;
    },
  ) {
    const elementsMap = this.app.scene.getElementsMapIncludingDeleted();

    const updateElement = (nextOriginalText: string, isDeleted: boolean) => {
      const latestTextElement =
        this.app.scene.getElement<ExcalidrawTextElement>(element.id);

      if (!latestTextElement || !isTextElement(latestTextElement)) {
        return;
      }

      const container = getContainerElement(latestTextElement, elementsMap);
      const stickyContainer =
        container && isStickyNoteElement(container) ? container : null;
      // sticky notes: the fit owns both the label and the note geometry
      const stickyLayout = stickyContainer
        ? getStickyNoteLayout(stickyContainer, latestTextElement, {
            originalText: nextOriginalText,
          })
        : null;
      // a free text stops growing at the view's width (between the side
      // panels beside its rows), or TEXT_MAX_WRAP_WIDTH, and wraps from there
      const textViewportOffsets = this.getTextViewportOffsets(
        getElementBounds(latestTextElement, elementsMap),
      );
      const maxWidth = this.getMaxTextWidth(textViewportOffsets);

      this.app.scene.replaceAllElements([
        // Not sure why we include deleted elements as well hence using deleted elements map
        ...this.app.scene.getElementsIncludingDeleted().map((_element) => {
          if (
            stickyLayout &&
            _element.id === stickyContainer?.id &&
            isStickyNoteElement(_element)
          ) {
            return newElementWith(_element, stickyLayout.container);
          }
          if (_element.id === latestTextElement.id && isTextElement(_element)) {
            return newElementWith(_element, {
              originalText: nextOriginalText,
              isDeleted: isDeleted ?? _element.isDeleted,
              ...(stickyLayout?.text ??
                // returns (wrapped) text and new dimensions
                refreshTextDimensions(
                  _element,
                  getContainerElement(_element, elementsMap),
                  elementsMap,
                  nextOriginalText,
                  maxWidth,
                )),
            });
          }
          return _element;
        }),
      ]);

      const updatedTextElement = this.app.scene.getNonDeletedElement(
        latestTextElement.id,
      );
      if (
        latestTextElement.autoResize &&
        updatedTextElement &&
        isTextElement(updatedTextElement) &&
        !updatedTextElement.autoResize
      ) {
        // it just started wrapping: bring all of it into view, between the
        // side panels (with the same room at the edges as the width left)
        // — vertically only if it fits; the caret follows the rest
        const scroll = scrollBoundsIntoView({
          bounds: getElementBounds(
            updatedTextElement,
            this.app.scene.getNonDeletedElementsMap(),
          ),
          appState: this.app.state,
          offsets: textViewportOffsets,
          tooLarge: "leave",
        });
        if (scroll) {
          this.app.viewport.translate(scroll);
        }
      }

      if (stickyContainer) {
        // the note may have grown or shrunk — arrows bound to it must follow
        const latestContainer = this.app.scene.getNonDeletedElement(
          stickyContainer.id,
        );
        if (latestContainer) {
          updateBoundElements(latestContainer, this.app.scene);
        }
      }
    };

    this.textWysiwygSubmitHandler = textWysiwyg({
      canvas: this.app.canvas,
      getViewportCoords: (x, y) => {
        const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
          {
            sceneX: x,
            sceneY: y,
          },
          this.app.state,
        );
        return [
          viewportX - this.app.state.offsetLeft,
          viewportY - this.app.state.offsetTop,
        ];
      },
      onChange: withBatchedUpdates((nextOriginalText) => {
        updateElement(nextOriginalText, false);
        if (isNonDeletedElement(element)) {
          updateBoundElements(element, this.app.scene);
        }
      }),
      onSubmit: withBatchedUpdates(({ viaKeyboard, nextOriginalText }) => {
        this.textWysiwygSubmitHandler = null;

        const isDeleted = !nextOriginalText.trim();
        updateElement(nextOriginalText, isDeleted);

        // keyboard-submit keeps focus on the edited object. For bound text, keep
        // the container selected even if the text becomes empty and is deleted.
        // The autoshape tool stays active through the editing session and never
        // selects anything — don't fight the finalize action's selection reset.
        const elementIdToSelect =
          viaKeyboard &&
          !this.app.isToolLocked() &&
          this.app.state.activeTool.type !== "autoshape"
            ? element.containerId || (!isDeleted ? element.id : null)
            : null;

        if (elementIdToSelect) {
          // needed to ensure state is updated before "finalize" action
          // that's invoked on keyboard-submit as well
          // TODO either move this into finalize as well, or handle all state
          // updates in one place, skipping finalize action
          flushSync(() => {
            this.app.setState((prevState) => ({
              selectedElementIds: makeNextSelectedElementIds(
                {
                  ...prevState.selectedElementIds,
                  [elementIdToSelect]: true,
                },
                prevState,
              ),
            }));
          });
        }

        if (isDeleted) {
          fixBindingsAfterDeletion(this.app.scene.getNonDeletedElements(), [
            element,
          ]);
        }

        if (!isDeleted || isExistingElement) {
          this.app.store.scheduleCapture();
        }

        flushSync(() => {
          this.app.setState({
            newElement: null,
            editingTextElement: null,
          });
        });

        // tools that survive the submit (locked, or autoshape's
        // double-click-to-type flow) need their cursor back
        if (
          this.app.isToolLocked() ||
          this.app.state.activeTool.type === "autoshape"
        ) {
          this.app.cursor.applyForTool();
        }

        this.app.focusContainer();
      }),
      element,
      excalidrawContainer: this.dependencies.getContainer(),
      app: this.app,
      initialCaretSceneCoords,
      // when text is selected, it's hard (at least on iOS) to re-position the
      // caret (i.e. deselect). There's not much use for always selecting
      // the text on edit anyway (and users can select-all from contextmenu
      // if needed)
      autoSelect: !this.app.editorInterface.isTouchScreen,
    });
    // deselect all other elements when inserting text
    this.app.deselectElements();

    // do an initial update to re-initialize element position since we were
    // modifying element's x/y for sake of editor (case: syncing to remote)
    updateElement(element.originalText, false);
  }

  private getSelectedTextElement(
    container?: ExcalidrawTextContainer | null,
  ): NonDeleted<ExcalidrawTextElement> | null {
    const selectedElements = this.app.scene.getSelectedElements(this.app.state);

    if (selectedElements.length !== 1) {
      return null;
    }

    const selectedElement = selectedElements[0]!;

    if (isTextElement(selectedElement)) {
      return selectedElement;
    }

    if (!container) {
      return null;
    }

    return getBoundTextElement(
      selectedElement,
      this.app.scene.getNonDeletedElementsMap(),
    ) as NonDeleted<ExcalidrawTextElement> | null;
  }

  public getSelectedTextEditingContainerAtPosition(
    hitElement: NonDeletedExcalidrawElement | null,
    sceneCoords: { x: number; y: number },
  ): ExcalidrawTextContainer | null | undefined {
    const selectedElements = this.app.scene.getSelectedElements(this.app.state);

    if (
      selectedElements.length !== 1 ||
      !hitElement ||
      hitElement.id !== selectedElements[0]!.id
    ) {
      return null;
    }

    const selectedElement = selectedElements[0]!;

    if (isTextElement(selectedElement)) {
      return null;
    }

    if (!isValidTextContainer(selectedElement)) {
      return undefined;
    }

    const textElement = this.getSelectedTextElement(selectedElement);
    const hitTextElement = this.getTextElementAtPosition(
      sceneCoords.x,
      sceneCoords.y,
    );

    if (!textElement || hitTextElement?.id !== textElement.id) {
      return undefined;
    }

    return selectedElement;
  }

  getTextElementAtPosition(
    x: number,
    y: number,
  ): NonDeleted<ExcalidrawTextElement> | null {
    const element = this.app.getElementAtPosition(x, y, {
      includeBoundTextElement: true,
    });
    if (element && isTextElement(element) && !element.isDeleted) {
      return element;
    }
    return null;
  }

  public isHittingTextAutoResizeHandle = (
    selectedElements: NonDeleted<ExcalidrawElement>[],
    point: Readonly<{ x: number; y: number }>,
  ): boolean => {
    const activeTextElement = getActiveTextElement(
      selectedElements,
      this.app.state,
    );

    if (
      activeTextElement &&
      !activeTextElement.isDeleted &&
      !activeTextElement.autoResize &&
      isPointHittingTextAutoResizeHandle(
        point,
        activeTextElement,
        this.app.state.zoom.value,
        this.app.editorInterface.formFactor,
      )
    ) {
      return true;
    }

    return false;
  };

  public handleTextAutoResizeHandlePointerDown = (
    selectedElements: NonDeleted<ExcalidrawElement>[],
    point: Readonly<{ x: number; y: number }>,
  ) => {
    const activeTextElement = getActiveTextElement(
      selectedElements,
      this.app.state,
    );
    if (
      !activeTextElement ||
      !this.isHittingTextAutoResizeHandle(selectedElements, point)
    ) {
      return false;
    }

    this.app.actionManager.executeAction(
      actionTextAutoResize,
      "ui",
      // we need to pass down the element since it may already be deselected
      // due to the pointerdown
      activeTextElement,
    );
    this.app.cursor.reset();
    return true;
  };

  /**
   * The text container at a position — an arrow hit on its path, any other
   * container hit anywhere in its bounds (frames are skipped so a container
   * inside one can be hit). Purely positional: the selection plays no part.
   */
  getTextBindableContainerAtPosition(x: number, y: number) {
    const elements = this.app.scene.getNonDeletedElements();
    let hitElement = null;
    // We need to do hit testing from front (end of the array) to back (beginning of the array)
    for (let index = elements.length - 1; index >= 0; --index) {
      if (elements[index].isDeleted) {
        continue;
      }
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(
        elements[index],
        this.app.scene.getNonDeletedElementsMap(),
      );
      if (
        isArrowElement(elements[index]) &&
        hitElementItself({
          point: pointFrom(x, y),
          element: elements[index],
          elementsMap: this.app.scene.getNonDeletedElementsMap(),
          threshold: this.app.getElementHitThreshold(elements[index]),
        })
      ) {
        hitElement = elements[index];
        break;
      } else if (x1 < x && x < x2 && y1 < y && y < y2) {
        // to allow binding to containers within frames,
        // ignore frames in hit testing
        if (isFrameLikeElement(elements[index])) {
          continue;
        }

        hitElement = elements[index];
        break;
      }
    }

    return isTextBindableContainer(hitElement, false) ? hitElement : null;
  }

  /**
   * Whether a text element's content is still being authored.
   *
   * Creating a text reverts the tool to selection during pointerdown, so the
   * pointerup that follows looks like an ordinary canvas click and would
   * capture the still-empty element as a history entry of its own. Undo would
   * then rewind only the typing, restoring an invisible, zero-content element
   * (and, for an endpoint label, leaving the arrow bound to it) rather than
   * removing it. The editor's own submit captures the finished text instead,
   * so the whole create-and-type lands in a single entry.
   */
  public isEditingTextContent() {
    return (
      !!this.app.state.editingTextElement ||
      isTextElement(this.app.state.newElement)
    );
  }

  public startTextEditing = ({
    sceneX,
    sceneY,
    insertAtParentCenter = true,
    container,
    autoEdit = true,
    initialCaretSceneCoords,
    arrowEndpoint,
    textElement,
  }: {
    /** X position to insert text at */
    sceneX: number;
    /** Y position to insert text at */
    sceneY: number;
    /** whether to attempt to insert at element center if applicable */
    insertAtParentCenter?: boolean;
    container?: ExcalidrawTextContainer | null;
    autoEdit?: boolean;
    initialCaretSceneCoords?: { x: number; y: number };
    /**
     * creates the text as a label for this arrow endpoint: the binding then
     * dictates the text's position and alignment, overriding (sceneX, sceneY)
     */
    arrowEndpoint?: ArrowEndpoint | null;
    /**
     * the text to edit: an element to edit exactly that one; `null` to always
     * create, never adopting a selected text or one under the pointer;
     * `undefined` to resolve it here — a single selected text, the label of a
     * selected or passed arrow container, else the text at (sceneX, sceneY)
     */
    textElement?: NonDeleted<ExcalidrawTextElement> | null;
  }) => {
    let shouldBindToContainer = false;

    // Resolved here rather than by the caller so that the stroke width the
    // binding gap derives from (see `getBindingGap`) is, by construction, the
    // one the text is created with below.
    const arrowEndpointBinding =
      arrowEndpoint &&
      this.app.arrowText.getTextBinding(
        arrowEndpoint,
        this.app.getCurrentItemScale("text"),
      );

    if (arrowEndpointBinding) {
      // an arrow endpoint is not a text container — the text is a sibling the
      // arrow binds to, not a label inside it
      container = null;
      insertAtParentCenter = false;
      // the scene position of the text's bound side midpoint, not a caret
      // position
      sceneX = arrowEndpointBinding.anchor[0];
      sceneY = arrowEndpointBinding.anchor[1];
    }

    let parentCenterPosition =
      insertAtParentCenter &&
      this.getTextWysiwygSnappedToCenterPosition(
        sceneX,
        sceneY,
        this.app.state,
        container,
      );
    if (container && parentCenterPosition) {
      const boundTextElementToContainer = getBoundTextElement(
        container,
        this.app.scene.getNonDeletedElementsMap(),
      );
      if (!boundTextElementToContainer) {
        shouldBindToContainer = true;
      }
    }
    const existingTextElement = arrowEndpointBinding
      ? null
      : textElement !== undefined
      ? textElement
      : this.getSelectedTextElement(container) ||
        (container && isArrowElement(container)
          ? getBoundTextElement(
              container,
              this.app.scene.getNonDeletedElementsMap(),
            )
          : null) ||
        this.getTextElementAtPosition(sceneX, sceneY);

    const fontFamily =
      existingTextElement?.fontFamily || this.app.state.currentItemFontFamily;

    const lineHeight =
      existingTextElement?.lineHeight || getLineHeight(fontFamily);
    const fontSize = this.app.getCurrentItemFontSize();

    if (
      !existingTextElement &&
      shouldBindToContainer &&
      container &&
      !isArrowElement(container) &&
      !isStickyNoteElement(container)
    ) {
      const fontString = {
        fontSize,
        fontFamily,
      };
      const padding = getBoundTextPadding(container);
      const minWidth = getApproxMinLineWidth(
        getFontString(fontString),
        lineHeight,
        padding,
      );
      const minHeight = getApproxMinLineHeight(fontSize, lineHeight, padding);
      const newHeight = Math.max(container.height, minHeight);
      const newWidth = Math.max(container.width, minWidth);
      this.app.scene.mutateElement(container, {
        height: newHeight,
        width: newWidth,
      });
      sceneX = container.x + newWidth / 2;
      sceneY = container.y + newHeight / 2;
      if (parentCenterPosition) {
        parentCenterPosition = this.getTextWysiwygSnappedToCenterPosition(
          sceneX,
          sceneY,
          this.app.state,
          container,
        );
      }
    }

    const textCreationGridPoint = this.getTextCreationGridPoint(sceneX, sceneY);

    const newTextElementPosition = arrowEndpointBinding
      ? // the anchor is dictated by the arrow, so neither the grid nor the
        // caret-centering fudge may nudge it
        { x: sceneX, y: sceneY }
      : parentCenterPosition
      ? {
          x: parentCenterPosition.elementCenterX,
          y: parentCenterPosition.elementCenterY,
        }
      : !existingTextElement
      ? {
          x: textCreationGridPoint?.x ?? sceneX,
          y:
            textCreationGridPoint === null
              ? // Free text starts from a point cursor, so center the first line box on it.
                sceneY - getLineHeightInPx(fontSize, lineHeight) / 2
              : textCreationGridPoint.y,
        }
      : {
          x: sceneX,
          y: sceneY,
        };

    const topLayerFrame = this.app.getTopLayerFrameAtSceneCoords({
      x: newTextElementPosition.x,
      y: newTextElementPosition.y,
    });

    // container has higher priority. Only add to frame if container is in the same frame.
    const frameId =
      topLayerFrame &&
      (!shouldBindToContainer ||
        !container ||
        container.frameId === topLayerFrame.id)
        ? topLayerFrame.id
        : null;

    const element =
      existingTextElement ||
      newTextElement({
        x: newTextElementPosition.x,
        y: newTextElementPosition.y,
        // a note's stroke color is its text color: the label inherits it
        strokeColor:
          shouldBindToContainer && isStickyNoteElement(container)
            ? container.strokeColor
            : this.app.state.currentItemStrokeColor,
        backgroundColor: this.app.state.currentItemBackgroundColor,
        fillStyle: this.app.state.currentItemFillStyle,
        ...this.app.getCurrentItemScale("text"),
        strokeStyle: this.app.state.currentItemStrokeStyle,
        roughness: this.app.state.currentItemRoughness,
        opacity: this.app.state.currentItemOpacity,
        text: "",
        fontSize,
        baseFontSize:
          shouldBindToContainer && isStickyNoteElement(container)
            ? fontSize
            : null,
        fontFamily,
        textAlign:
          arrowEndpointBinding?.textAlign ??
          (parentCenterPosition
            ? "center"
            : this.app.state.currentItemTextAlign),
        verticalAlign:
          arrowEndpointBinding?.verticalAlign ??
          (parentCenterPosition
            ? VERTICAL_ALIGN.MIDDLE
            : DEFAULT_VERTICAL_ALIGN),
        containerId: shouldBindToContainer ? container?.id : undefined,
        labelPosition:
          shouldBindToContainer && container && isArrowElement(container)
            ? DEFAULT_BOUND_TEXT_LABEL_POSITION
            : null,
        groupIds: shouldBindToContainer ? container?.groupIds ?? [] : [],
        lineHeight,
        angle:
          shouldBindToContainer && container && !isArrowElement(container)
            ? container.angle
            : (0 as Radians),
        frameId,
      });

    if (!existingTextElement && shouldBindToContainer && container) {
      this.app.scene.mutateElement(container, {
        boundElements: (container.boundElements || []).concat({
          type: "text",
          id: element.id,
        }),
      });
    }
    this.app.setState({ editingTextElement: element });

    if (!existingTextElement) {
      if (container && shouldBindToContainer) {
        const containerIndex = this.app.scene.getElementIndex(container.id);
        // TODO should use insertNewElement, after we update it to handle
        // elements with containerId + frameId at the same time (containerId
        // should take precedence when it comes to z-index)
        this.app.scene.insertElementsAtIndex([element], containerIndex + 1);
      } else {
        this.app.insertNewElement(element);
      }
    }

    if (arrowEndpoint && arrowEndpointBinding) {
      this.app.arrowText.bindText(
        arrowEndpoint,
        element,
        arrowEndpointBinding.fixedPoint,
      );
    }

    // A nearby container only skips drag sizing when the text binds to it.
    if (autoEdit || existingTextElement || shouldBindToContainer) {
      this.handleTextWysiwyg(element, {
        isExistingElement: !!existingTextElement,
        initialCaretSceneCoords: existingTextElement
          ? initialCaretSceneCoords
          : null,
      });
    } else {
      this.app.setState({
        newElement: element,
        multiElement: null,
      });
    }
  };

  getTextWysiwygSnappedToCenterPosition(
    x: number,
    y: number,
    appState: AppState,
    container?: ExcalidrawTextContainer | null,
  ) {
    if (container) {
      let elementCenterX = container.x + container.width / 2;
      let elementCenterY = container.y + container.height / 2;

      const elementCenter = getContainerCenter(
        container,
        this.app.scene.getNonDeletedElementsMap(),
      );
      if (elementCenter) {
        elementCenterX = elementCenter.x;
        elementCenterY = elementCenter.y;
      }
      const distanceToCenter = Math.hypot(
        x - elementCenterX,
        y - elementCenterY,
      );
      const isSnappedToCenter =
        distanceToCenter < TEXT_TO_CENTER_SNAP_THRESHOLD;
      if (isSnappedToCenter) {
        const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
          { sceneX: elementCenterX, sceneY: elementCenterY },
          appState,
        );
        return { viewportX, viewportY, elementCenterX, elementCenterY };
      }
    }
  }
}
