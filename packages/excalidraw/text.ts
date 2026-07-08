import {
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  KEYS,
  TEXT_TO_CENTER_SNAP_THRESHOLD,
  VERTICAL_ALIGN,
  getFontString,
  getLineHeight,
  isTransparent,
  sceneCoordsToViewportCoords,
  updateActiveTool,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  fixBindingsAfterDeletion,
  getActiveTextElement,
  getApproxMinLineHeight,
  getApproxMinLineWidth,
  getBoundTextElement,
  getContainerCenter,
  getContainerElement,
  getElementAbsoluteCoords,
  getLineHeightInPx,
  getMinTextElementWidth,
  getVisibleSceneBounds,
  hasBoundTextElement,
  hitElementItself,
  isArrowElement,
  isFrameLikeElement,
  isNonDeletedElement,
  isTextBindableContainer,
  isTextElement,
  isValidTextContainer,
  makeNextSelectedElementIds,
  measureText,
  newElementWith,
  newTextElement,
  normalizeText,
  refreshTextDimensions,
  updateBoundElements,
  wrapText,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import { flushSync } from "react-dom";

import type { Radians } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { actionTextAutoResize } from "./actions/actionTextAutoResize";
import { resetCursor, setCursorForShape } from "./cursor";
import { t } from "./i18n";
import { withBatchedUpdates } from "./reactUtils";
import { deselectElements } from "./selection";
import { getShortcutKey } from "./shortcut";
import { isPointHittingTextAutoResizeHandle } from "./textAutoResizeHandle";
import { textWysiwyg } from "./wysiwyg/textWysiwyg";

import type React from "react";

import type { App, AppState, PointerDownState } from "./types";

let PLAIN_PASTE_TOAST_SHOWN = false;

const getTextCreationGridPoint = (app: App, x: number, y: number) => {
  const effectiveGridSize = app.getEffectiveGridSize();

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

const getTextWysiwygSnappedToCenterPosition = (
  app: App,
  x: number,
  y: number,
  appState: AppState,
  container?: ExcalidrawTextContainer | null,
) => {
  if (container) {
    let elementCenterX = container.x + container.width / 2;
    let elementCenterY = container.y + container.height / 2;

    const elementCenter = getContainerCenter(
      container,
      appState,
      app.scene.getNonDeletedElementsMap(),
    );
    if (elementCenter) {
      elementCenterX = elementCenter.x;
      elementCenterY = elementCenter.y;
    }
    const distanceToCenter = Math.hypot(x - elementCenterX, y - elementCenterY);
    const isSnappedToCenter = distanceToCenter < TEXT_TO_CENTER_SNAP_THRESHOLD;
    if (isSnappedToCenter) {
      const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
        { sceneX: elementCenterX, sceneY: elementCenterY },
        appState,
      );
      return { viewportX, viewportY, elementCenterX, elementCenterY };
    }
  }
};

const getSelectedTextElement = (
  app: App,
  container?: ExcalidrawTextContainer | null,
): NonDeleted<ExcalidrawTextElement> | null => {
  const selectedElements = app.scene.getSelectedElements(app.state);

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
    app.scene.getNonDeletedElementsMap(),
  );
};

const getTextElementAtPosition = (
  app: App,
  x: number,
  y: number,
): NonDeleted<ExcalidrawTextElement> | null => {
  const element = app.getElementAtPosition(x, y, {
    includeBoundTextElement: true,
  });
  if (element && isTextElement(element) && !element.isDeleted) {
    return element;
  }
  return null;
};

const getSelectedTextEditingContainerAtPosition = (
  app: App,
  hitElement: NonDeletedExcalidrawElement | null,
  sceneCoords: { x: number; y: number },
): ExcalidrawTextContainer | null | undefined => {
  const selectedElements = app.scene.getSelectedElements(app.state);

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

  const textElement = getSelectedTextElement(app, selectedElement);
  const hitTextElement = getTextElementAtPosition(
    app,
    sceneCoords.x,
    sceneCoords.y,
  );

  if (!textElement || hitTextElement?.id !== textElement.id) {
    return undefined;
  }

  return selectedElement;
};

const getTextBindableContainerAtPosition = (app: App, x: number, y: number) => {
  const elements = app.scene.getNonDeletedElements();
  const selectedElements = app.scene.getSelectedElements(app.state);
  if (selectedElements.length === 1) {
    return isTextBindableContainer(selectedElements[0], false)
      ? selectedElements[0]
      : null;
  }
  let hitElement = null;
  // We need to do hit testing from front (end of the array) to back (beginning of the array)
  for (let index = elements.length - 1; index >= 0; --index) {
    if (elements[index].isDeleted) {
      continue;
    }
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(
      elements[index],
      app.scene.getNonDeletedElementsMap(),
    );
    if (
      isArrowElement(elements[index]) &&
      hitElementItself({
        point: pointFrom(x, y),
        element: elements[index],
        elementsMap: app.scene.getNonDeletedElementsMap(),
        threshold: app.getElementHitThreshold(elements[index]),
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
};

const handleTextWysiwyg = (
  app: App,
  element: ExcalidrawTextElement,
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
) => {
  const elementsMap = app.scene.getElementsMapIncludingDeleted();

  const updateElement = (nextOriginalText: string, isDeleted: boolean) => {
    app.scene.replaceAllElements([
      // Not sure why we include deleted elements as well hence using deleted elements map
      ...app.scene.getElementsIncludingDeleted().map((_element) => {
        if (_element.id === element.id && isTextElement(_element)) {
          return newElementWith(_element, {
            originalText: nextOriginalText,
            isDeleted: isDeleted ?? _element.isDeleted,
            // returns (wrapped) text and new dimensions
            ...refreshTextDimensions(
              _element,
              getContainerElement(_element, elementsMap),
              elementsMap,
              nextOriginalText,
            ),
          });
        }
        return _element;
      }),
    ]);
  };

  textWysiwyg({
    id: element.id,
    canvas: app.canvas,
    getViewportCoords: (x, y) => {
      const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
        {
          sceneX: x,
          sceneY: y,
        },
        app.state,
      );
      return [
        viewportX - app.state.offsetLeft,
        viewportY - app.state.offsetTop,
      ];
    },
    onChange: withBatchedUpdates((nextOriginalText) => {
      updateElement(nextOriginalText, false);
      if (isNonDeletedElement(element)) {
        updateBoundElements(element, app.scene);
      }
    }),
    onSubmit: withBatchedUpdates(({ viaKeyboard, nextOriginalText }) => {
      const isDeleted = !nextOriginalText.trim();
      updateElement(nextOriginalText, isDeleted);

      // keyboard-submit keeps focus on the edited object. For bound text, keep
      // the container selected even if the text becomes empty and is deleted.
      const elementIdToSelect = viaKeyboard
        ? element.containerId || (!isDeleted ? element.id : null)
        : null;

      if (elementIdToSelect) {
        // needed to ensure state is updated before "finalize" action
        // that's invoked on keyboard-submit as well
        // TODO either move this into finalize as well, or handle all state
        // updates in one place, skipping finalize action
        flushSync(() => {
          app.setState((prevState) => ({
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
        fixBindingsAfterDeletion(app.scene.getNonDeletedElements(), [element]);
      }

      if (!isDeleted || isExistingElement) {
        app.store.scheduleCapture();
      }

      flushSync(() => {
        app.setState({
          newElement: null,
          editingTextElement: null,
        });
      });

      if (app.state.activeTool.locked) {
        setCursorForShape(app.interactiveCanvas, app.state);
      }

      app.focusContainer();
    }),
    element,
    excalidrawContainer: app.excalidrawContainerRef.current,
    app,
    initialCaretSceneCoords,
    // when text is selected, it's hard (at least on iOS) to re-position the
    // caret (i.e. deselect). There's not much use for always selecting
    // the text on edit anyway (and users can select-all from contextmenu
    // if needed)
    autoSelect: !app.editorInterface.isTouchScreen,
  });
  // deselect all other elements when inserting text
  deselectElements(app);

  // do an initial update to re-initialize element position since we were
  // modifying element's x/y for sake of editor (case: syncing to remote)
  updateElement(element.originalText, false);
};

/**
 * Starts text editing at the given scene position: reuses the selected/hit
 * text element if there is one, otherwise creates a new text element (bound
 * to `container` if applicable) and opens the wysiwyg editor for it.
 */
export const startTextEditing = (
  app: App,
  {
    sceneX,
    sceneY,
    insertAtParentCenter = true,
    container,
    autoEdit = true,
    initialCaretSceneCoords,
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
  },
): void => {
  let shouldBindToContainer = false;

  let parentCenterPosition =
    insertAtParentCenter &&
    getTextWysiwygSnappedToCenterPosition(
      app,
      sceneX,
      sceneY,
      app.state,
      container,
    );
  if (container && parentCenterPosition) {
    const boundTextElementToContainer = getBoundTextElement(
      container,
      app.scene.getNonDeletedElementsMap(),
    );
    if (!boundTextElementToContainer) {
      shouldBindToContainer = true;
    }
  }
  const existingTextElement =
    getSelectedTextElement(app, container) ||
    getTextElementAtPosition(app, sceneX, sceneY);

  const fontFamily =
    existingTextElement?.fontFamily || app.state.currentItemFontFamily;

  const lineHeight =
    existingTextElement?.lineHeight || getLineHeight(fontFamily);
  const fontSize = app.state.currentItemFontSize;

  if (
    !existingTextElement &&
    shouldBindToContainer &&
    container &&
    !isArrowElement(container)
  ) {
    const fontString = {
      fontSize,
      fontFamily,
    };
    const minWidth = getApproxMinLineWidth(
      getFontString(fontString),
      lineHeight,
    );
    const minHeight = getApproxMinLineHeight(fontSize, lineHeight);
    const newHeight = Math.max(container.height, minHeight);
    const newWidth = Math.max(container.width, minWidth);
    app.scene.mutateElement(container, {
      height: newHeight,
      width: newWidth,
    });
    sceneX = container.x + newWidth / 2;
    sceneY = container.y + newHeight / 2;
    if (parentCenterPosition) {
      parentCenterPosition = getTextWysiwygSnappedToCenterPosition(
        app,
        sceneX,
        sceneY,
        app.state,
        container,
      );
    }
  }

  const textCreationGridPoint = getTextCreationGridPoint(app, sceneX, sceneY);

  const newTextElementPosition = parentCenterPosition
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

  const topLayerFrame = app.getTopLayerFrameAtSceneCoords({
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
      strokeColor: app.state.currentItemStrokeColor,
      backgroundColor: app.state.currentItemBackgroundColor,
      fillStyle: app.state.currentItemFillStyle,
      strokeWidth: app.getCurrentItemStrokeWidth("text"),
      strokeStyle: app.state.currentItemStrokeStyle,
      roughness: app.state.currentItemRoughness,
      opacity: app.state.currentItemOpacity,
      text: "",
      fontSize,
      fontFamily,
      textAlign: parentCenterPosition
        ? "center"
        : app.state.currentItemTextAlign,
      verticalAlign: parentCenterPosition
        ? VERTICAL_ALIGN.MIDDLE
        : DEFAULT_VERTICAL_ALIGN,
      containerId: shouldBindToContainer ? container?.id : undefined,
      groupIds: container?.groupIds ?? [],
      lineHeight,
      angle: container
        ? isArrowElement(container)
          ? (0 as Radians)
          : container.angle
        : (0 as Radians),
      frameId,
    });

  if (!existingTextElement && shouldBindToContainer && container) {
    app.scene.mutateElement(container, {
      boundElements: (container.boundElements || []).concat({
        type: "text",
        id: element.id,
      }),
    });
  }
  app.setState({ editingTextElement: element });

  if (!existingTextElement) {
    if (container && shouldBindToContainer) {
      const containerIndex = app.scene.getElementIndex(container.id);
      // TODO should use insertNewElement, after we update it to handle
      // elements with containerId + frameId at the same time (containerId
      // should take precedence when it comes to z-index)
      app.scene.insertElementsAtIndex([element], containerIndex + 1);
    } else {
      app.insertNewElement(element);
    }
  }

  if (autoEdit || existingTextElement || container) {
    handleTextWysiwyg(app, element, {
      isExistingElement: !!existingTextElement,
      initialCaretSceneCoords: existingTextElement
        ? initialCaretSceneCoords
        : null,
    });
  } else {
    app.setState({
      newElement: element,
      multiElement: null,
    });
  }
};

/**
 * @returns whether the pointer is over the auto-resize handle of the active
 * text element.
 */
export const isHittingTextAutoResizeHandle = (
  app: App,
  selectedElements: NonDeleted<ExcalidrawElement>[],
  point: Readonly<{ x: number; y: number }>,
): boolean => {
  const activeTextElement = getActiveTextElement(selectedElements, app.state);

  if (
    activeTextElement &&
    !activeTextElement.isDeleted &&
    !activeTextElement.autoResize &&
    isPointHittingTextAutoResizeHandle(
      point,
      activeTextElement,
      app.state.zoom.value,
      app.editorInterface.formFactor,
    )
  ) {
    return true;
  }

  return false;
};

/**
 * On pointer down, toggles auto-resize if the text auto-resize handle was hit.
 *
 * @returns whether the handle was hit (i.e. the caller should stop further
 * pointer-down handling).
 */
export const textAutoResizeHandleOnPointerDownHandler = (
  app: App,
  selectedElements: NonDeleted<ExcalidrawElement>[],
  point: Readonly<{ x: number; y: number }>,
): boolean => {
  const activeTextElement = getActiveTextElement(selectedElements, app.state);
  if (
    !activeTextElement ||
    !isHittingTextAutoResizeHandle(app, selectedElements, point)
  ) {
    return false;
  }

  app.actionManager.executeAction(
    actionTextAutoResize,
    "ui",
    // we need to pass down the element since it may already be deselected
    // due to the pointerdown
    activeTextElement,
  );
  app.resetCursor();
  return true;
};

/**
 * Pointer down with the text tool active: starts text editing at the pointer
 * position (or finalizes the current edit if one is in progress).
 */
export const textToolOnPointerDownHandler = (
  app: App,
  event: React.PointerEvent<HTMLElement>,
  pointerDownState: PointerDownState,
): void => {
  // if we're currently still editing text, clicking outside
  // should only finalize it, not create another (irrespective
  // of state.activeTool.locked)
  if (app.state.editingTextElement) {
    return;
  }
  let sceneX = pointerDownState.origin.x;
  let sceneY = pointerDownState.origin.y;

  const element = app.getElementAtPosition(sceneX, sceneY, {
    includeBoundTextElement: true,
  });

  // FIXME
  let container = getTextBindableContainerAtPosition(app, sceneX, sceneY);

  if (hasBoundTextElement(element)) {
    container = element as ExcalidrawTextContainer;
    sceneX = element.x + element.width / 2;
    sceneY = element.y + element.height / 2;
  }
  startTextEditing(app, {
    sceneX,
    sceneY,
    insertAtParentCenter: !event.altKey,
    container,
    autoEdit: false,
    initialCaretSceneCoords: { x: sceneX, y: sceneY },
  });

  resetCursor(app.interactiveCanvas);
  if (!app.state.activeTool.locked) {
    app.setState({
      activeTool: updateActiveTool(app.state, {
        type: app.state.preferredSelectionTool.type,
      }),
    });
  }
};

/**
 * On pointer up, if the new element is a text element, enables auto-resize
 * when needed and opens the wysiwyg editor for it. Unlike other pointer-up
 * handlers this does not gate the caller — the original code falls through.
 */
export const textNewElementOnPointerUpHandler = (
  app: App,
  newElement: AppState["newElement"],
): void => {
  if (isTextElement(newElement)) {
    const minWidth = getMinTextElementWidth(
      getFontString({
        fontSize: newElement.fontSize,
        fontFamily: newElement.fontFamily,
      }),
      newElement.lineHeight,
    );

    if (newElement.width < minWidth) {
      app.scene.mutateElement(newElement, {
        autoResize: true,
      });
    }

    app.resetCursor();

    handleTextWysiwyg(app, newElement, {
      isExistingElement: true,
    });
  }
};

/**
 * On pointer up (plain click on an already-selected text element or text
 * container), starts editing that text.
 *
 * @returns whether text editing was started (i.e. the caller should return).
 */
export const textEditingOnPointerUpFromPointerDownHandler = (
  app: App,
  childEvent: PointerEvent,
  pointerDownState: PointerDownState,
  activeTool: AppState["activeTool"],
  hitElement: NonDeleted<ExcalidrawElement> | null,
  sceneCoords: { x: number; y: number },
): boolean => {
  const selectedTextEditingContainer =
    getSelectedTextEditingContainerAtPosition(app, hitElement, sceneCoords);

  if (
    activeTool.type === app.state.preferredSelectionTool.type &&
    !app.state.editingTextElement &&
    !pointerDownState.drag.hasOccurred &&
    !pointerDownState.hit.wasAddedToSelection &&
    !childEvent.shiftKey &&
    !childEvent[KEYS.CTRL_OR_CMD] &&
    !childEvent.altKey &&
    childEvent.pointerType !== "touch" &&
    hitElement &&
    ((isTextElement(hitElement) &&
      app.state.selectedElementIds[hitElement.id] &&
      app.scene.getSelectedElements(app.state).length === 1) ||
      selectedTextEditingContainer)
  ) {
    startTextEditing(app, {
      sceneX: sceneCoords.x,
      sceneY: sceneCoords.y,
      container: selectedTextEditingContainer,
      initialCaretSceneCoords: app.lastPointerUpIsDoubleClick
        ? undefined
        : sceneCoords,
    });
    return true;
  }

  return false;
};

/**
 * Double click on canvas (with selection tool): starts editing the hit text
 * element / text container, or creates a new text element at the position.
 */
export const textDoubleClickHandler = (
  app: App,
  event: Pick<
    React.MouseEvent<HTMLCanvasElement>,
    | "type"
    | "clientX"
    | "clientY"
    | "altKey"
    | "ctrlKey"
    | "metaKey"
    | "shiftKey"
  >,
  sceneX: number,
  sceneY: number,
): void => {
  // shouldn't edit/create text when inside line editor (often false positive)

  if (!app.state.selectedLinearElement?.isEditing) {
    const container = getTextBindableContainerAtPosition(app, sceneX, sceneY);

    if (container) {
      if (
        hasBoundTextElement(container) ||
        !isTransparent(container.backgroundColor) ||
        hitElementItself({
          point: pointFrom(sceneX, sceneY),
          element: container,
          elementsMap: app.scene.getNonDeletedElementsMap(),
          threshold: app.getElementHitThreshold(container),
        })
      ) {
        const midPoint = getContainerCenter(
          container,
          app.state,
          app.scene.getNonDeletedElementsMap(),
        );

        sceneX = midPoint.x;
        sceneY = midPoint.y;
      }
    }

    startTextEditing(app, {
      sceneX,
      sceneY,
      insertAtParentCenter: !event.altKey,
      container,
    });
  }
};

/**
 * Inserts pasted text as new text element(s) at the current pointer position.
 */
export const addTextFromPaste = (
  app: App,
  text: string,
  isPlainPaste = false,
): void => {
  const { x, y } = viewportCoordsToSceneCoords(
    {
      clientX: app.lastViewportPosition.x,
      clientY: app.lastViewportPosition.y,
    },
    app.state,
  );

  const textElementProps = {
    x,
    y,
    strokeColor: app.state.currentItemStrokeColor,
    backgroundColor: app.state.currentItemBackgroundColor,
    fillStyle: app.state.currentItemFillStyle,
    strokeWidth: app.getCurrentItemStrokeWidth("text"),
    strokeStyle: app.state.currentItemStrokeStyle,
    roundness: null,
    roughness: app.state.currentItemRoughness,
    opacity: app.state.currentItemOpacity,
    text,
    fontSize: app.state.currentItemFontSize,
    fontFamily: app.state.currentItemFontFamily,
    textAlign: DEFAULT_TEXT_ALIGN,
    verticalAlign: DEFAULT_VERTICAL_ALIGN,
    locked: false,
  };
  const fontString = getFontString({
    fontSize: textElementProps.fontSize,
    fontFamily: textElementProps.fontFamily,
  });
  const lineHeight = getLineHeight(textElementProps.fontFamily);
  const [x1, , x2] = getVisibleSceneBounds(app.state);
  // long texts should not go beyond 800 pixels in width nor should it go below 200 px
  const maxTextWidth = Math.max(Math.min((x2 - x1) * 0.5, 800), 200);
  const LINE_GAP = 10;
  let currentY = y;

  const lines = isPlainPaste ? [text] : text.split("\n");
  const textElements = lines.reduce(
    (acc: ExcalidrawTextElement[], line, idx) => {
      const originalText = normalizeText(line).trim();
      if (originalText.length) {
        const topLayerFrame = app.getTopLayerFrameAtSceneCoords({
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
            getLineHeightInPx(textElementProps.fontSize, lineHeight) + LINE_GAP;
        }
      }

      return acc;
    },
    [],
  );

  if (textElements.length === 0) {
    return;
  }

  app.insertNewElements(textElements);
  app.store.scheduleCapture();
  app.setState({
    selectedElementIds: makeNextSelectedElementIds(
      Object.fromEntries(textElements.map((el) => [el.id, true])),
      app.state,
    ),
  });

  if (
    !isPlainPaste &&
    textElements.length > 1 &&
    PLAIN_PASTE_TOAST_SHOWN === false &&
    app.editorInterface.formFactor !== "phone"
  ) {
    app.setToast({
      message: t("toast.pasteAsSingleElement", {
        shortcut: getShortcutKey("CtrlOrCmd+Shift+V"),
      }),
      duration: 5000,
    });
    PLAIN_PASTE_TOAST_SHOWN = true;
  }
};
