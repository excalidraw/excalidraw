import React from "react";
import ReactDOM from "react-dom";

import rough from "roughjs/bin/rough";
import { RoughCanvas } from "roughjs/bin/canvas";

import {
  newElement,
  newTextElement,
  duplicateElement,
  resizeTest,
  normalizeResizeHandle,
  isInvisiblySmallElement,
  isTextElement,
  textWysiwyg,
  getElementAbsoluteCoords,
  getCursorForResizingElement,
  getPerfectElementSize,
  resizePerfectLineForNWHandler,
  normalizeDimensions,
} from "./element";
import {
  clearSelection,
  deleteSelectedElements,
  getElementsWithinSelection,
  isOverScrollBars,
  restoreFromLocalStorage,
  saveToLocalStorage,
  getElementAtPosition,
  createScene,
  getElementContainingPosition,
  hasBackground,
  hasStroke,
  hasText,
  exportCanvas,
  importFromBackend,
} from "./scene";

import { renderScene } from "./renderer";
import { AppState } from "./types";
import { ExcalidrawElement } from "./element/types";

import { isInputLike, debounce, capitalizeString, distance } from "./utils";
import { KEYS, isArrowKey } from "./keys";

import { findShapeByKey, shapesShortcutKeys, SHAPES } from "./shapes";
import { createHistory } from "./history";

import ContextMenu from "./components/ContextMenu";

import "./styles.scss";
import { getElementWithResizeHandler } from "./element/resizeTest";
import {
  ActionManager,
  actionDeleteSelected,
  actionSendBackward,
  actionBringForward,
  actionSendToBack,
  actionBringToFront,
  actionSelectAll,
  actionChangeStrokeColor,
  actionChangeBackgroundColor,
  actionChangeOpacity,
  actionChangeStrokeWidth,
  actionChangeFillStyle,
  actionChangeSloppiness,
  actionChangeFontSize,
  actionChangeFontFamily,
  actionChangeViewBackgroundColor,
  actionClearCanvas,
  actionChangeProjectName,
  actionChangeExportBackground,
  actionLoadScene,
  actionSaveScene,
  actionCopyStyles,
  actionPasteStyles,
} from "./actions";
import { Action, ActionResult } from "./actions/types";
import { getDefaultAppState } from "./appState";
import { Island } from "./components/Island";
import Stack from "./components/Stack";
import { FixedSideContainer } from "./components/FixedSideContainer";
import { ToolButton } from "./components/ToolButton";
import { LockIcon } from "./components/LockIcon";
import { ExportDialog } from "./components/ExportDialog";
import { withTranslation } from "react-i18next";
import { LanguageList } from "./components/LanguageList";
import i18n, { languages, parseDetectedLang } from "./i18n";

let { elements } = createScene();
const { history } = createHistory();

const CANVAS_WINDOW_OFFSET_LEFT = 0;
const CANVAS_WINDOW_OFFSET_TOP = 0;

function resetCursor() {
  document.documentElement.style.cursor = "";
}

const ELEMENT_SHIFT_TRANSLATE_AMOUNT = 5;
const ELEMENT_TRANSLATE_AMOUNT = 1;
const TEXT_TO_CENTER_SNAP_THRESHOLD = 30;
const CURSOR_TYPE = {
  TEXT: "text",
  CROSSHAIR: "crosshair",
};

let lastCanvasWidth = -1;
let lastCanvasHeight = -1;

let lastMouseUp: ((e: any) => void) | null = null;

export function viewportCoordsToSceneCoords(
  { clientX, clientY }: { clientX: number; clientY: number },
  { scrollX, scrollY }: { scrollX: number; scrollY: number },
) {
  const x = clientX - CANVAS_WINDOW_OFFSET_LEFT - scrollX;
  const y = clientY - CANVAS_WINDOW_OFFSET_TOP - scrollY;
  return { x, y };
}

function pickAppStatePropertiesForHistory(
  appState: AppState,
): Partial<AppState> {
  return {
    exportBackground: appState.exportBackground,
    currentItemStrokeColor: appState.currentItemStrokeColor,
    currentItemBackgroundColor: appState.currentItemBackgroundColor,
    currentItemFillStyle: appState.currentItemFillStyle,
    currentItemStrokeWidth: appState.currentItemStrokeWidth,
    currentItemRoughness: appState.currentItemRoughness,
    currentItemOpacity: appState.currentItemOpacity,
    currentItemFont: appState.currentItemFont,
    viewBackgroundColor: appState.viewBackgroundColor,
    name: appState.name,
  };
}

let cursorX = 0;
let cursorY = 0;

export class App extends React.Component<any, AppState> {
  canvas: HTMLCanvasElement | null = null;
  rc: RoughCanvas | null = null;

  actionManager: ActionManager = new ActionManager();
  canvasOnlyActions: Array<Action>;
  constructor(props: any) {
    super(props);
    this.actionManager.registerAction(actionDeleteSelected);
    this.actionManager.registerAction(actionSendToBack);
    this.actionManager.registerAction(actionBringToFront);
    this.actionManager.registerAction(actionSendBackward);
    this.actionManager.registerAction(actionBringForward);
    this.actionManager.registerAction(actionSelectAll);

    this.actionManager.registerAction(actionChangeStrokeColor);
    this.actionManager.registerAction(actionChangeBackgroundColor);
    this.actionManager.registerAction(actionChangeFillStyle);
    this.actionManager.registerAction(actionChangeStrokeWidth);
    this.actionManager.registerAction(actionChangeOpacity);
    this.actionManager.registerAction(actionChangeSloppiness);
    this.actionManager.registerAction(actionChangeFontSize);
    this.actionManager.registerAction(actionChangeFontFamily);

    this.actionManager.registerAction(actionChangeViewBackgroundColor);
    this.actionManager.registerAction(actionClearCanvas);

    this.actionManager.registerAction(actionChangeProjectName);
    this.actionManager.registerAction(actionChangeExportBackground);
    this.actionManager.registerAction(actionSaveScene);
    this.actionManager.registerAction(actionLoadScene);

    this.actionManager.registerAction(actionCopyStyles);
    this.actionManager.registerAction(actionPasteStyles);

    this.canvasOnlyActions = [actionSelectAll];
  }

  private syncActionResult = (res: ActionResult) => {
    if (res.elements !== undefined) {
      elements = res.elements;
      this.forceUpdate();
    }

    if (res.appState !== undefined) {
      this.setState({ ...res.appState });
    }
  };

  private onCut = (e: ClipboardEvent) => {
    if (isInputLike(e.target)) return;
    e.clipboardData?.setData(
      "text/plain",
      JSON.stringify(
        elements
          .filter(element => element.isSelected)
          .map(({ shape, ...el }) => el),
      ),
    );
    elements = deleteSelectedElements(elements);
    this.forceUpdate();
    e.preventDefault();
  };
  private onCopy = (e: ClipboardEvent) => {
    if (isInputLike(e.target)) return;
    e.clipboardData?.setData(
      "text/plain",
      JSON.stringify(
        elements
          .filter(element => element.isSelected)
          .map(({ shape, ...el }) => el),
      ),
    );
    e.preventDefault();
  };
  private onPaste = (e: ClipboardEvent) => {
    if (isInputLike(e.target)) return;
    const paste = e.clipboardData?.getData("text") || "";
    this.addElementsFromPaste(paste);
    e.preventDefault();
  };

  private onUnload = () => {
    this.saveDebounced();
    this.saveDebounced.flush();
  };

  public async componentDidMount() {
    document.addEventListener("copy", this.onCopy);
    document.addEventListener("paste", this.onPaste);
    document.addEventListener("cut", this.onCut);

    document.addEventListener("keydown", this.onKeyDown, false);
    document.addEventListener("mousemove", this.updateCurrentCursorPosition);
    window.addEventListener("resize", this.onResize, false);
    window.addEventListener("unload", this.onUnload, false);

    let data;
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("id") != null) {
      data = await importFromBackend(searchParams.get("id"));
      window.history.replaceState({}, "Excalidraw", window.location.origin);
    } else {
      data = restoreFromLocalStorage();
    }

    if (data.elements) {
      elements = data.elements;
    }

    if (data.appState) {
      this.setState(data.appState);
    } else {
      this.forceUpdate();
    }
  }

  public componentWillUnmount() {
    document.removeEventListener("copy", this.onCopy);
    document.removeEventListener("paste", this.onPaste);
    document.removeEventListener("cut", this.onCut);

    document.removeEventListener("keydown", this.onKeyDown, false);
    document.removeEventListener(
      "mousemove",
      this.updateCurrentCursorPosition,
      false,
    );
    window.removeEventListener("resize", this.onResize, false);
    window.removeEventListener("unload", this.onUnload, false);
  }

  public state: AppState = getDefaultAppState();

  private onResize = () => {
    this.forceUpdate();
  };

  private updateCurrentCursorPosition = (e: MouseEvent) => {
    cursorX = e.x;
    cursorY = e.y;
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === KEYS.ESCAPE && !this.state.draggingElement) {
      elements = clearSelection(elements);
      this.forceUpdate();
      this.setState({ elementType: "selection" });
      if (window.document.activeElement instanceof HTMLElement) {
        window.document.activeElement.blur();
      }
      event.preventDefault();
      return;
    }
    if (isInputLike(event.target)) return;

    const data = this.actionManager.handleKeyDown(event, elements, this.state);
    this.syncActionResult(data);

    if (data.elements !== undefined || data.appState !== undefined) {
      return;
    }

    const shape = findShapeByKey(event.key);

    if (isArrowKey(event.key)) {
      const step = event.shiftKey
        ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
        : ELEMENT_TRANSLATE_AMOUNT;
      elements = elements.map(el => {
        if (el.isSelected) {
          const element = { ...el };
          if (event.key === KEYS.ARROW_LEFT) element.x -= step;
          else if (event.key === KEYS.ARROW_RIGHT) element.x += step;
          else if (event.key === KEYS.ARROW_UP) element.y -= step;
          else if (event.key === KEYS.ARROW_DOWN) element.y += step;
          return element;
        }
        return el;
      });
      this.forceUpdate();
      event.preventDefault();
    } else if (
      shapesShortcutKeys.includes(event.key.toLowerCase()) &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      !event.metaKey &&
      this.state.draggingElement === null
    ) {
      if (shape === "text") {
        document.documentElement.style.cursor = CURSOR_TYPE.TEXT;
      } else {
        document.documentElement.style.cursor = CURSOR_TYPE.CROSSHAIR;
      }
      this.setState({ elementType: shape });
    } else if (event[KEYS.META] && event.code === "KeyZ") {
      event.preventDefault();

      if (event.shiftKey) {
        // Redo action
        const data = history.redoOnce();
        if (data !== null) {
          elements = data.elements;
          this.setState(data.appState);
        }
      } else {
        // undo action
        const data = history.undoOnce();
        if (data !== null) {
          elements = data.elements;
          this.setState(data.appState);
        }
      }
    }
  };

  private removeWheelEventListener: (() => void) | undefined;

  private copyToClipboard = () => {
    if (navigator.clipboard) {
      const text = JSON.stringify(
        elements
          .filter(element => element.isSelected)
          .map(({ shape, ...el }) => el),
      );
      navigator.clipboard.writeText(text);
    }
  };

  private pasteFromClipboard = () => {
    if (navigator.clipboard) {
      navigator.clipboard
        .readText()
        .then(text => this.addElementsFromPaste(text));
    }
  };

  private renderSelectedShapeActions(elements: readonly ExcalidrawElement[]) {
    const { t } = this.props;
    const { elementType, editingElement } = this.state;
    const selectedElements = elements.filter(el => el.isSelected);
    const hasSelectedElements = selectedElements.length > 0;
    const isTextToolSelected = elementType === "text";
    const isShapeToolSelected = elementType !== "selection";
    const isEditingText = editingElement && editingElement.type === "text";
    if (
      !hasSelectedElements &&
      !isShapeToolSelected &&
      !isTextToolSelected &&
      !isEditingText
    ) {
      return null;
    }

    return (
      <Island padding={4}>
        <div className="panelColumn">
          {this.actionManager.renderAction(
            "changeStrokeColor",
            elements,
            this.state,
            this.syncActionResult,
            t,
          )}

          {(hasBackground(elements) ||
            (isShapeToolSelected && !isTextToolSelected)) && (
            <>
              {this.actionManager.renderAction(
                "changeBackgroundColor",
                elements,
                this.state,
                this.syncActionResult,
                t,
              )}

              {this.actionManager.renderAction(
                "changeFillStyle",
                elements,
                this.state,
                this.syncActionResult,
                t,
              )}
              <hr />
            </>
          )}

          {(hasStroke(elements) ||
            (isShapeToolSelected && !isTextToolSelected)) && (
            <>
              {this.actionManager.renderAction(
                "changeStrokeWidth",
                elements,
                this.state,
                this.syncActionResult,
                t,
              )}

              {this.actionManager.renderAction(
                "changeSloppiness",
                elements,
                this.state,
                this.syncActionResult,
                t,
              )}
              <hr />
            </>
          )}

          {(hasText(elements) || isTextToolSelected || isEditingText) && (
            <>
              {this.actionManager.renderAction(
                "changeFontSize",
                elements,
                this.state,
                this.syncActionResult,
                t,
              )}

              {this.actionManager.renderAction(
                "changeFontFamily",
                elements,
                this.state,
                this.syncActionResult,
                t,
              )}
              <hr />
            </>
          )}

          {this.actionManager.renderAction(
            "changeOpacity",
            elements,
            this.state,
            this.syncActionResult,
            t,
          )}

          {this.actionManager.renderAction(
            "deleteSelectedElements",
            elements,
            this.state,
            this.syncActionResult,
            t,
          )}
        </div>
      </Island>
    );
  }

  private renderShapeLock() {
    const { elementLocked } = this.state;
    return (
      <LockIcon
        checked={elementLocked}
        onChange={() => {
          this.setState({
            elementLocked: !elementLocked,
            elementType: elementLocked ? "selection" : this.state.elementType,
          });
        }}
      />
    );
  }

  private renderShapesSwitcher() {
    const { t } = this.props;

    return (
      <>
        {SHAPES.map(({ value, icon }, index) => {
          const label = t(`toolBar.${value}`);
          return (
            <ToolButton
              key={value}
              type="radio"
              icon={icon}
              checked={this.state.elementType === value}
              name="editor-current-shape"
              title={`${capitalizeString(label)} — ${
                capitalizeString(value)[0]
              }, ${index + 1}`}
              aria-label={capitalizeString(label)}
              aria-keyshortcuts={`${label[0]} ${index + 1}`}
              onChange={() => {
                this.setState({ elementType: value });
                elements = clearSelection(elements);
                document.documentElement.style.cursor =
                  value === "text" ? CURSOR_TYPE.TEXT : CURSOR_TYPE.CROSSHAIR;
                this.forceUpdate();
              }}
            ></ToolButton>
          );
        })}
        {this.renderShapeLock()}
      </>
    );
  }

  private renderCanvasActions() {
    const { t } = this.props;
    return (
      <Stack.Col gap={4}>
        <Stack.Row justifyContent={"space-between"}>
          {this.actionManager.renderAction(
            "loadScene",
            elements,
            this.state,
            this.syncActionResult,
            t,
          )}
          {this.actionManager.renderAction(
            "saveScene",
            elements,
            this.state,
            this.syncActionResult,
            t,
          )}
          <ExportDialog
            elements={elements}
            appState={this.state}
            actionManager={this.actionManager}
            syncActionResult={this.syncActionResult}
            onExportToPng={(exportedElements, scale) => {
              if (this.canvas)
                exportCanvas("png", exportedElements, this.canvas, {
                  exportBackground: this.state.exportBackground,
                  name: this.state.name,
                  viewBackgroundColor: this.state.viewBackgroundColor,
                  scale,
                });
            }}
            onExportToClipboard={(exportedElements, scale) => {
              if (this.canvas)
                exportCanvas("clipboard", exportedElements, this.canvas, {
                  exportBackground: this.state.exportBackground,
                  name: this.state.name,
                  viewBackgroundColor: this.state.viewBackgroundColor,
                  scale,
                });
            }}
            onExportToBackend={exportedElements => {
              if (this.canvas)
                exportCanvas(
                  "backend",
                  exportedElements.map(element => ({
                    ...element,
                    isSelected: false,
                  })),
                  this.canvas,
                  this.state,
                );
            }}
          />
          {this.actionManager.renderAction(
            "clearCanvas",
            elements,
            this.state,
            this.syncActionResult,
            t,
          )}
        </Stack.Row>
        {this.actionManager.renderAction(
          "changeViewBackgroundColor",
          elements,
          this.state,
          this.syncActionResult,
          t,
        )}
      </Stack.Col>
    );
  }

  public render() {
    const canvasWidth = window.innerWidth - CANVAS_WINDOW_OFFSET_LEFT;
    const canvasHeight = window.innerHeight - CANVAS_WINDOW_OFFSET_TOP;
    const { t } = this.props;

    return (
      <div className="container">
        <FixedSideContainer side="top">
          <div className="App-menu App-menu_top">
            <Stack.Col gap={4} align="end">
              <div className="App-right-menu">
                <h2 className="visually-hidden">Canvas actions</h2>
                <Island padding={4}>{this.renderCanvasActions()}</Island>
              </div>
              <div className="App-right-menu">
                {this.renderSelectedShapeActions(elements)}
              </div>
            </Stack.Col>
            <Stack.Col gap={4} align="start">
              <Island padding={1}>
                <h2 className="visually-hidden">Shapes</h2>
                <Stack.Row gap={1}>{this.renderShapesSwitcher()}</Stack.Row>
              </Island>
            </Stack.Col>
            <div />
          </div>
        </FixedSideContainer>
        <canvas
          id="canvas"
          style={{
            width: canvasWidth,
            height: canvasHeight,
          }}
          width={canvasWidth * window.devicePixelRatio}
          height={canvasHeight * window.devicePixelRatio}
          ref={canvas => {
            if (this.canvas === null) {
              this.canvas = canvas;
              this.rc = rough.canvas(this.canvas!);
            }
            if (this.removeWheelEventListener) {
              this.removeWheelEventListener();
              this.removeWheelEventListener = undefined;
            }
            if (canvas) {
              canvas.addEventListener("wheel", this.handleWheel, {
                passive: false,
              });
              this.removeWheelEventListener = () =>
                canvas.removeEventListener("wheel", this.handleWheel);
              // Whenever React sets the width/height of the canvas element,
              // the context loses the scale transform. We need to re-apply it
              if (
                canvasWidth !== lastCanvasWidth ||
                canvasHeight !== lastCanvasHeight
              ) {
                lastCanvasWidth = canvasWidth;
                lastCanvasHeight = canvasHeight;
                canvas
                  .getContext("2d")!
                  .scale(window.devicePixelRatio, window.devicePixelRatio);
              }
            }
          }}
          onContextMenu={e => {
            e.preventDefault();

            const { x, y } = viewportCoordsToSceneCoords(e, this.state);

            const element = getElementAtPosition(elements, x, y);
            if (!element) {
              ContextMenu.push({
                options: [
                  navigator.clipboard && {
                    label: t("labels.paste"),
                    action: () => this.pasteFromClipboard(),
                  },
                  ...this.actionManager.getContextMenuItems(
                    elements,
                    this.state,
                    this.syncActionResult,
                    action => this.canvasOnlyActions.includes(action),
                    t,
                  ),
                ],
                top: e.clientY,
                left: e.clientX,
              });
              return;
            }

            if (!element.isSelected) {
              elements = clearSelection(elements);
              element.isSelected = true;
              this.forceUpdate();
            }

            ContextMenu.push({
              options: [
                navigator.clipboard && {
                  label: t("labels.copy"),
                  action: this.copyToClipboard,
                },
                navigator.clipboard && {
                  label: t("labels.paste"),
                  action: () => this.pasteFromClipboard(),
                },
                ...this.actionManager.getContextMenuItems(
                  elements,
                  this.state,
                  this.syncActionResult,
                  action => !this.canvasOnlyActions.includes(action),
                  t,
                ),
              ],
              top: e.clientY,
              left: e.clientX,
            });
          }}
          onMouseDown={e => {
            if (lastMouseUp !== null) {
              // Unfortunately, sometimes we don't get a mouseup after a mousedown,
              // this can happen when a contextual menu or alert is triggered. In order to avoid
              // being in a weird state, we clean up on the next mousedown
              lastMouseUp(e);
            }

            // pan canvas on wheel button drag
            if (e.button === 1) {
              let { clientX: lastX, clientY: lastY } = e;
              const onMouseMove = (e: MouseEvent) => {
                document.documentElement.style.cursor = `grabbing`;
                let deltaX = lastX - e.clientX;
                let deltaY = lastY - e.clientY;
                lastX = e.clientX;
                lastY = e.clientY;
                this.setState(state => ({
                  scrollX: state.scrollX - deltaX,
                  scrollY: state.scrollY - deltaY,
                }));
              };
              const onMouseUp = (lastMouseUp = (e: MouseEvent) => {
                lastMouseUp = null;
                resetCursor();
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
              });
              window.addEventListener("mousemove", onMouseMove, {
                passive: true,
              });
              window.addEventListener("mouseup", onMouseUp);
              return;
            }

            // only handle left mouse button
            if (e.button !== 0) return;
            // fixes mousemove causing selection of UI texts #32
            e.preventDefault();
            // Preventing the event above disables default behavior
            //  of defocusing potentially focused input, which is what we want
            //  when clicking inside the canvas.
            if (isInputLike(document.activeElement)) {
              document.activeElement.blur();
            }

            // Handle scrollbars dragging
            const {
              isOverHorizontalScrollBar,
              isOverVerticalScrollBar,
            } = isOverScrollBars(
              elements,
              e.clientX - CANVAS_WINDOW_OFFSET_LEFT,
              e.clientY - CANVAS_WINDOW_OFFSET_TOP,
              canvasWidth,
              canvasHeight,
              this.state.scrollX,
              this.state.scrollY,
            );

            const { x, y } = viewportCoordsToSceneCoords(e, this.state);

            const originX = x;
            const originY = y;

            let element = newElement(
              this.state.elementType,
              x,
              y,
              this.state.currentItemStrokeColor,
              this.state.currentItemBackgroundColor,
              this.state.currentItemFillStyle,
              this.state.currentItemStrokeWidth,
              this.state.currentItemRoughness,
              this.state.currentItemOpacity,
            );

            if (isTextElement(element)) {
              element = newTextElement(element, "", this.state.currentItemFont);
            }

            type ResizeTestType = ReturnType<typeof resizeTest>;
            let resizeHandle: ResizeTestType = false;
            let isResizingElements = false;
            let draggingOccurred = false;
            let hitElement: ExcalidrawElement | null = null;
            let elementIsAddedToSelection = false;
            if (this.state.elementType === "selection") {
              const resizeElement = getElementWithResizeHandler(
                elements,
                { x, y },
                this.state,
              );
              this.setState({
                resizingElement: resizeElement ? resizeElement.element : null,
              });

              if (resizeElement) {
                resizeHandle = resizeElement.resizeHandle;
                document.documentElement.style.cursor = getCursorForResizingElement(
                  resizeElement,
                );
                isResizingElements = true;
              } else {
                hitElement = getElementAtPosition(elements, x, y);
                // clear selection if shift is not clicked
                if (!hitElement?.isSelected && !e.shiftKey) {
                  elements = clearSelection(elements);
                }

                // If we click on something
                if (hitElement) {
                  // deselect if item is selected
                  // if shift is not clicked, this will always return true
                  // otherwise, it will trigger selection based on current
                  // state of the box
                  if (!hitElement.isSelected) {
                    hitElement.isSelected = true;
                    elementIsAddedToSelection = true;
                  }

                  // We duplicate the selected element if alt is pressed on Mouse down
                  if (e.altKey) {
                    elements = [
                      ...elements.map(element => ({
                        ...element,
                        isSelected: false,
                      })),
                      ...elements
                        .filter(element => element.isSelected)
                        .map(element => {
                          const newElement = duplicateElement(element);
                          newElement.isSelected = true;
                          return newElement;
                        }),
                    ];
                  }
                }
              }
            } else {
              elements = clearSelection(elements);
            }

            if (isTextElement(element)) {
              let textX = e.clientX;
              let textY = e.clientY;
              if (!e.altKey) {
                const snappedToCenterPosition = this.getTextWysiwygSnappedToCenterPosition(
                  x,
                  y,
                );
                if (snappedToCenterPosition) {
                  element.x = snappedToCenterPosition.elementCenterX;
                  element.y = snappedToCenterPosition.elementCenterY;
                  textX = snappedToCenterPosition.wysiwygX;
                  textY = snappedToCenterPosition.wysiwygY;
                }
              }

              const resetSelection = () => {
                this.setState({
                  draggingElement: null,
                  editingElement: null,
                  elementType: "selection",
                });
              };

              textWysiwyg({
                initText: "",
                x: textX,
                y: textY,
                strokeColor: this.state.currentItemStrokeColor,
                opacity: this.state.currentItemOpacity,
                font: this.state.currentItemFont,
                onSubmit: text => {
                  if (text) {
                    elements = [
                      ...elements,
                      {
                        ...newTextElement(
                          element,
                          text,
                          this.state.currentItemFont,
                        ),
                        isSelected: true,
                      },
                    ];
                  }
                  resetSelection();
                },
                onCancel: () => {
                  resetSelection();
                },
              });
              this.setState({
                elementType: "selection",
                editingElement: element,
              });
              return;
            }

            elements = [...elements, element];
            this.setState({ draggingElement: element });

            let lastX = x;
            let lastY = y;

            if (isOverHorizontalScrollBar || isOverVerticalScrollBar) {
              lastX = e.clientX - CANVAS_WINDOW_OFFSET_LEFT;
              lastY = e.clientY - CANVAS_WINDOW_OFFSET_TOP;
            }

            const onMouseMove = (e: MouseEvent) => {
              const target = e.target;
              if (!(target instanceof HTMLElement)) {
                return;
              }

              if (isOverHorizontalScrollBar) {
                const x = e.clientX - CANVAS_WINDOW_OFFSET_LEFT;
                const dx = x - lastX;
                this.setState(state => ({ scrollX: state.scrollX - dx }));
                lastX = x;
                return;
              }

              if (isOverVerticalScrollBar) {
                const y = e.clientY - CANVAS_WINDOW_OFFSET_TOP;
                const dy = y - lastY;
                this.setState(state => ({ scrollY: state.scrollY - dy }));
                lastY = y;
                return;
              }

              if (isResizingElements && this.state.resizingElement) {
                const el = this.state.resizingElement;
                const selectedElements = elements.filter(el => el.isSelected);
                if (selectedElements.length === 1) {
                  const { x, y } = viewportCoordsToSceneCoords(e, this.state);
                  const deltaX = x - lastX;
                  const deltaY = y - lastY;
                  const element = selectedElements[0];
                  const isLinear =
                    element.type === "line" || element.type === "arrow";
                  switch (resizeHandle) {
                    case "nw":
                      element.width -= deltaX;
                      element.x += deltaX;

                      if (e.shiftKey) {
                        if (isLinear) {
                          resizePerfectLineForNWHandler(element, x, y);
                        } else {
                          element.y += element.height - element.width;
                          element.height = element.width;
                        }
                      } else {
                        element.height -= deltaY;
                        element.y += deltaY;
                      }
                      break;
                    case "ne":
                      element.width += deltaX;
                      if (e.shiftKey) {
                        element.y += element.height - element.width;
                        element.height = element.width;
                      } else {
                        element.height -= deltaY;
                        element.y += deltaY;
                      }
                      break;
                    case "sw":
                      element.width -= deltaX;
                      element.x += deltaX;
                      if (e.shiftKey) {
                        element.height = element.width;
                      } else {
                        element.height += deltaY;
                      }
                      break;
                    case "se":
                      if (e.shiftKey) {
                        if (isLinear) {
                          const { width, height } = getPerfectElementSize(
                            element.type,
                            x - element.x,
                            y - element.y,
                          );
                          element.width = width;
                          element.height = height;
                        } else {
                          element.width += deltaX;
                          element.height = element.width;
                        }
                      } else {
                        element.width += deltaX;
                        element.height += deltaY;
                      }
                      break;
                    case "n":
                      element.height -= deltaY;
                      element.y += deltaY;
                      break;
                    case "w":
                      element.width -= deltaX;
                      element.x += deltaX;
                      break;
                    case "s":
                      element.height += deltaY;
                      break;
                    case "e":
                      element.width += deltaX;
                      break;
                  }

                  if (resizeHandle) {
                    resizeHandle = normalizeResizeHandle(element, resizeHandle);
                  }
                  normalizeDimensions(element);

                  document.documentElement.style.cursor = getCursorForResizingElement(
                    { element, resizeHandle },
                  );
                  el.x = element.x;
                  el.y = element.y;
                  el.shape = null;

                  lastX = x;
                  lastY = y;
                  // We don't want to save history when resizing an element
                  history.skipRecording();
                  this.forceUpdate();
                  return;
                }
              }

              if (hitElement?.isSelected) {
                // Marking that click was used for dragging to check
                // if elements should be deselected on mouseup
                draggingOccurred = true;
                const selectedElements = elements.filter(el => el.isSelected);
                if (selectedElements.length) {
                  const { x, y } = viewportCoordsToSceneCoords(e, this.state);

                  selectedElements.forEach(element => {
                    element.x += x - lastX;
                    element.y += y - lastY;
                  });
                  lastX = x;
                  lastY = y;
                  // We don't want to save history when dragging an element to initially size it
                  history.skipRecording();
                  this.forceUpdate();
                  return;
                }
              }

              // It is very important to read this.state within each move event,
              // otherwise we would read a stale one!
              const draggingElement = this.state.draggingElement;
              if (!draggingElement) return;

              const { x, y } = viewportCoordsToSceneCoords(e, this.state);

              let width = distance(originX, x);
              let height = distance(originY, y);

              const isLinear =
                this.state.elementType === "line" ||
                this.state.elementType === "arrow";

              if (isLinear && x < originX) width = -width;
              if (isLinear && y < originY) height = -height;

              if (e.shiftKey) {
                ({ width, height } = getPerfectElementSize(
                  this.state.elementType,
                  width,
                  !isLinear && y < originY ? -height : height,
                ));

                if (!isLinear && height < 0) height = -height;
              }

              if (!isLinear) {
                draggingElement.x = x < originX ? originX - width : originX;
                draggingElement.y = y < originY ? originY - height : originY;
              }

              draggingElement.width = width;
              draggingElement.height = height;
              draggingElement.shape = null;

              if (this.state.elementType === "selection") {
                if (!e.shiftKey) {
                  elements = clearSelection(elements);
                }
                const elementsWithinSelection = getElementsWithinSelection(
                  elements,
                  draggingElement,
                );
                elementsWithinSelection.forEach(element => {
                  element.isSelected = true;
                });
              }
              // We don't want to save history when moving an element
              history.skipRecording();
              this.forceUpdate();
            };

            const onMouseUp = (e: MouseEvent) => {
              const {
                draggingElement,
                resizingElement,
                elementType,
                elementLocked,
              } = this.state;

              lastMouseUp = null;
              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);

              if (
                elementType !== "selection" &&
                draggingElement &&
                isInvisiblySmallElement(draggingElement)
              ) {
                // remove invisible element which was added in onMouseDown
                elements = elements.slice(0, -1);
                this.setState({
                  draggingElement: null,
                });
                this.forceUpdate();
                return;
              }

              if (normalizeDimensions(draggingElement)) {
                this.forceUpdate();
              }

              if (resizingElement && isInvisiblySmallElement(resizingElement)) {
                elements = elements.filter(el => el.id !== resizingElement.id);
              }

              // If click occurred on already selected element
              // it is needed to remove selection from other elements
              // or if SHIFT or META key pressed remove selection
              // from hitted element
              //
              // If click occurred and elements were dragged or some element
              // was added to selection (on mousedown phase) we need to keep
              // selection unchanged
              if (
                hitElement &&
                !draggingOccurred &&
                !elementIsAddedToSelection
              ) {
                if (e.shiftKey) {
                  hitElement.isSelected = false;
                } else {
                  elements = clearSelection(elements);
                  hitElement.isSelected = true;
                }
              }

              if (draggingElement === null) {
                // if no element is clicked, clear the selection and redraw
                elements = clearSelection(elements);
                this.forceUpdate();
                return;
              }

              if (elementType === "selection") {
                elements = elements.slice(0, -1);
              } else if (!elementLocked) {
                draggingElement.isSelected = true;
              }

              if (!elementLocked) {
                resetCursor();

                this.setState({
                  draggingElement: null,
                  elementType: "selection",
                });
              }

              history.resumeRecording();
              this.forceUpdate();
            };

            lastMouseUp = onMouseUp;

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);

            // We don't want to save history on mouseDown, only on mouseUp when it's fully configured
            history.skipRecording();
            this.forceUpdate();
          }}
          onDoubleClick={e => {
            const { x, y } = viewportCoordsToSceneCoords(e, this.state);

            const elementAtPosition = getElementAtPosition(elements, x, y);

            const element =
              elementAtPosition && isTextElement(elementAtPosition)
                ? elementAtPosition
                : newTextElement(
                    newElement(
                      "text",
                      x,
                      y,
                      this.state.currentItemStrokeColor,
                      this.state.currentItemBackgroundColor,
                      this.state.currentItemFillStyle,
                      this.state.currentItemStrokeWidth,
                      this.state.currentItemRoughness,
                      this.state.currentItemOpacity,
                    ),
                    "", // default text
                    this.state.currentItemFont, // default font
                  );

            this.setState({ editingElement: element });

            let textX = e.clientX;
            let textY = e.clientY;

            if (elementAtPosition && isTextElement(elementAtPosition)) {
              elements = elements.filter(
                element => element.id !== elementAtPosition.id,
              );
              this.forceUpdate();

              textX =
                this.state.scrollX +
                elementAtPosition.x +
                CANVAS_WINDOW_OFFSET_LEFT +
                elementAtPosition.width / 2;
              textY =
                this.state.scrollY +
                elementAtPosition.y +
                CANVAS_WINDOW_OFFSET_TOP +
                elementAtPosition.height / 2;

              // x and y will change after calling newTextElement function
              element.x = elementAtPosition.x + elementAtPosition.width / 2;
              element.y = elementAtPosition.y + elementAtPosition.height / 2;
            } else if (!e.altKey) {
              const snappedToCenterPosition = this.getTextWysiwygSnappedToCenterPosition(
                x,
                y,
              );

              if (snappedToCenterPosition) {
                element.x = snappedToCenterPosition.elementCenterX;
                element.y = snappedToCenterPosition.elementCenterY;
                textX = snappedToCenterPosition.wysiwygX;
                textY = snappedToCenterPosition.wysiwygY;
              }
            }

            const resetSelection = () => {
              this.setState({
                draggingElement: null,
                editingElement: null,
                elementType: "selection",
              });
            };

            textWysiwyg({
              initText: element.text,
              x: textX,
              y: textY,
              strokeColor: element.strokeColor,
              font: element.font,
              opacity: this.state.currentItemOpacity,
              onSubmit: text => {
                if (text) {
                  elements = [
                    ...elements,
                    {
                      // we need to recreate the element to update dimensions &
                      //  position
                      ...newTextElement(element, text, element.font),
                      isSelected: true,
                    },
                  ];
                }
                resetSelection();
              },
              onCancel: () => {
                resetSelection();
              },
            });
          }}
          onMouseMove={e => {
            const hasDeselectedButton = Boolean(e.buttons);
            if (hasDeselectedButton || this.state.elementType !== "selection") {
              return;
            }
            const { x, y } = viewportCoordsToSceneCoords(e, this.state);
            const selectedElements = elements.filter(e => e.isSelected).length;
            if (selectedElements === 1) {
              const resizeElement = getElementWithResizeHandler(
                elements,
                { x, y },
                this.state,
              );
              if (resizeElement && resizeElement.resizeHandle) {
                document.documentElement.style.cursor = getCursorForResizingElement(
                  resizeElement,
                );
                return;
              }
            }
            const hitElement = getElementAtPosition(elements, x, y);
            document.documentElement.style.cursor = hitElement ? "move" : "";
          }}
        />
        <LanguageList
          onClick={lng => {
            i18n.changeLanguage(lng);
          }}
          languages={languages}
          currentLanguage={parseDetectedLang(i18n.language)}
        />
      </div>
    );
  }

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { deltaX, deltaY } = e;
    this.setState(state => ({
      scrollX: state.scrollX - deltaX,
      scrollY: state.scrollY - deltaY,
    }));
  };

  private addElementsFromPaste = (paste: string) => {
    let parsedElements;
    try {
      parsedElements = JSON.parse(paste);
    } catch (e) {}
    if (
      Array.isArray(parsedElements) &&
      parsedElements.length > 0 &&
      parsedElements[0].type // need to implement a better check here...
    ) {
      elements = clearSelection(elements);

      let subCanvasX1 = Infinity;
      let subCanvasX2 = -Infinity;
      let subCanvasY1 = Infinity;
      let subCanvasY2 = -Infinity;

      const minX = Math.min(...parsedElements.map(element => element.x));
      const minY = Math.min(...parsedElements.map(element => element.y));

      parsedElements.forEach(parsedElement => {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(parsedElement);
        subCanvasX1 = Math.min(subCanvasX1, x1);
        subCanvasY1 = Math.min(subCanvasY1, y1);
        subCanvasX2 = Math.max(subCanvasX2, x2);
        subCanvasY2 = Math.max(subCanvasY2, y2);
      });

      const elementsCenterX = distance(subCanvasX1, subCanvasX2) / 2;
      const elementsCenterY = distance(subCanvasY1, subCanvasY2) / 2;

      const dx =
        cursorX -
        this.state.scrollX -
        CANVAS_WINDOW_OFFSET_LEFT -
        elementsCenterX;
      const dy =
        cursorY -
        this.state.scrollY -
        CANVAS_WINDOW_OFFSET_TOP -
        elementsCenterY;

      elements = [
        ...elements,
        ...parsedElements.map(parsedElement => {
          const duplicate = duplicateElement(parsedElement);
          duplicate.x += dx - minX;
          duplicate.y += dy - minY;
          return duplicate;
        }),
      ];
      this.forceUpdate();
    }
  };

  private getTextWysiwygSnappedToCenterPosition(x: number, y: number) {
    const elementClickedInside = getElementContainingPosition(elements, x, y);
    if (elementClickedInside) {
      const elementCenterX =
        elementClickedInside.x + elementClickedInside.width / 2;
      const elementCenterY =
        elementClickedInside.y + elementClickedInside.height / 2;
      const distanceToCenter = Math.hypot(
        x - elementCenterX,
        y - elementCenterY,
      );
      const isSnappedToCenter =
        distanceToCenter < TEXT_TO_CENTER_SNAP_THRESHOLD;
      if (isSnappedToCenter) {
        const wysiwygX =
          this.state.scrollX +
          elementClickedInside.x +
          CANVAS_WINDOW_OFFSET_LEFT +
          elementClickedInside.width / 2;
        const wysiwygY =
          this.state.scrollY +
          elementClickedInside.y +
          CANVAS_WINDOW_OFFSET_TOP +
          elementClickedInside.height / 2;
        return { wysiwygX, wysiwygY, elementCenterX, elementCenterY };
      }
    }
  }

  private saveDebounced = debounce(() => {
    saveToLocalStorage(elements, this.state);
  }, 300);

  componentDidUpdate() {
    renderScene(elements, this.rc!, this.canvas!, {
      scrollX: this.state.scrollX,
      scrollY: this.state.scrollY,
      viewBackgroundColor: this.state.viewBackgroundColor,
    });
    this.saveDebounced();
    if (history.isRecording()) {
      history.pushEntry(
        history.generateCurrentEntry(
          pickAppStatePropertiesForHistory(this.state),
          elements,
        ),
      );
    }
  }
}

const AppWithTrans = withTranslation()(App);

const rootElement = document.getElementById("root");

class TopErrorBoundary extends React.Component {
  state = { hasError: false, stack: "", localStorage: "" };

  static getDerivedStateFromError(error: any) {
    console.error(error);
    return {
      hasError: true,
      localStorage: JSON.stringify({ ...localStorage }),
      stack: error.stack,
    };
  }

  private selectTextArea(event: React.MouseEvent<HTMLTextAreaElement>) {
    (event.target as HTMLTextAreaElement).select();
  }

  private async createGithubIssue() {
    let body = "";
    try {
      const templateStr = (await import("./bug-issue-template")).default;
      if (typeof templateStr === "string") {
        body = encodeURIComponent(templateStr);
      }
    } catch {}

    window.open(
      `https://github.com/excalidraw/excalidraw/issues/new?body=${body}`,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ErrorSplash">
          <div className="ErrorSplash-messageContainer">
            <div className="ErrorSplash-paragraph bigger">
              Encountered an error. Please{" "}
              <button onClick={() => window.location.reload()}>
                reload the page
              </button>
              .
            </div>
            <div className="ErrorSplash-paragraph">
              If reloading doesn't work. Try{" "}
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
              >
                clearing the canvas
              </button>
              .<br />
              <div className="smaller">
                (This will unfortunately result in loss of work.)
              </div>
            </div>
            <div>
              <div className="ErrorSplash-paragraph">
                Before doing so, we'd appreciate if you opened an issue on our{" "}
                <button onClick={this.createGithubIssue}>bug tracker</button>.
                Please include the following error stack trace & localStorage
                content (provided it's not private):
              </div>
              <div className="ErrorSplash-paragraph">
                <div className="ErrorSplash-details">
                  <label>Error stack trace:</label>
                  <textarea
                    rows={10}
                    onClick={this.selectTextArea}
                    defaultValue={this.state.stack}
                  />
                  <label>LocalStorage content:</label>
                  <textarea
                    rows={5}
                    onClick={this.selectTextArea}
                    defaultValue={this.state.localStorage}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.render(
  <TopErrorBoundary>
    <AppWithTrans />
  </TopErrorBoundary>,
  rootElement,
);
