import React from "react";
import ReactDOM from "react-dom";

import rough from "roughjs/bin/rough";
import { RoughCanvas } from "roughjs/bin/canvas";

import {
  newElement,
  duplicateElement,
  resizeTest,
  isTextElement,
  textWysiwyg,
  getElementAbsoluteCoords
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
  exportCanvas
} from "./scene";

import { renderScene } from "./renderer";
import { AppState } from "./types";
import { ExcalidrawElement, ExcalidrawTextElement } from "./element/types";

import { isInputLike, measureText, debounce, capitalizeString } from "./utils";
import { KEYS, META_KEY, isArrowKey } from "./keys";

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
  actionPasteStyles
} from "./actions";
import { Action, ActionResult } from "./actions/types";
import { getDefaultAppState } from "./appState";
import { image, clipboard } from "./components/icons";

let { elements } = createScene();
const { history } = createHistory();

const CANVAS_WINDOW_OFFSET_LEFT = 0;
const CANVAS_WINDOW_OFFSET_TOP = 0;

function resetCursor() {
  document.documentElement.style.cursor = "";
}

function addTextElement(
  element: ExcalidrawTextElement,
  text: string,
  font: string
) {
  resetCursor();
  if (text === null || text === "") {
    return false;
  }

  const metrics = measureText(text, font);
  element.text = text;
  element.font = font;
  // Center the text
  element.x -= metrics.width / 2;
  element.y -= metrics.height / 2;
  element.width = metrics.width;
  element.height = metrics.height;
  element.baseline = metrics.baseline;

  return true;
}

const ELEMENT_SHIFT_TRANSLATE_AMOUNT = 5;
const ELEMENT_TRANSLATE_AMOUNT = 1;
const TEXT_TO_CENTER_SNAP_THRESHOLD = 30;

let lastCanvasWidth = -1;
let lastCanvasHeight = -1;

let lastMouseUp: ((e: any) => void) | null = null;

export function viewportCoordsToSceneCoords(
  { clientX, clientY }: { clientX: number; clientY: number },
  { scrollX, scrollY }: { scrollX: number; scrollY: number }
) {
  const x = clientX - CANVAS_WINDOW_OFFSET_LEFT - scrollX;
  const y = clientY - CANVAS_WINDOW_OFFSET_TOP - scrollY;
  return { x, y };
}

export class App extends React.Component<{}, AppState> {
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
          .map(({ shape, ...el }) => el)
      )
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
          .map(({ shape, ...el }) => el)
      )
    );
    e.preventDefault();
  };
  private onPaste = (e: ClipboardEvent) => {
    if (isInputLike(e.target)) return;
    const paste = e.clipboardData?.getData("text") || "";
    this.addElementsFromPaste(paste);
    e.preventDefault();
  };

  public componentDidMount() {
    document.addEventListener("copy", this.onCopy);
    document.addEventListener("paste", this.onPaste);
    document.addEventListener("cut", this.onCut);

    document.addEventListener("keydown", this.onKeyDown, false);
    document.addEventListener("mousemove", this.getCurrentCursorPosition);
    window.addEventListener("resize", this.onResize, false);
    document.addEventListener("wheel", this.handleWheel, {
      passive: false
    });

    const { elements: newElements, appState } = restoreFromLocalStorage();

    if (newElements) {
      elements = newElements;
    }

    if (appState) {
      this.setState(appState);
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
      this.getCurrentCursorPosition,
      false
    );
    window.removeEventListener("resize", this.onResize, false);
    document.removeEventListener("wheel", this.handleWheel);
  }

  public state: AppState = getDefaultAppState();

  private onResize = () => {
    this.forceUpdate();
  };

  private getCurrentCursorPosition = (e: MouseEvent) => {
    this.setState({ cursorX: e.x, cursorY: e.y });
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === KEYS.ESCAPE) {
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
      !event.metaKey
    ) {
      this.setState({ elementType: findShapeByKey(event.key) });
    } else if (event[META_KEY] && event.code === "KeyZ") {
      if (event.shiftKey) {
        // Redo action
        const data = history.redoOnce();
        if (data !== null) {
          elements = data;
        }
      } else {
        // undo action
        const data = history.undoOnce();
        if (data !== null) {
          elements = data;
        }
      }
      this.forceUpdate();
      event.preventDefault();
    }
  };

  private copyToClipboard = () => {
    if (navigator.clipboard) {
      const text = JSON.stringify(
        elements
          .filter(element => element.isSelected)
          .map(({ shape, ...el }) => el)
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

  private renderSelectedElementsPopover(
    elements: readonly ExcalidrawElement[]
  ) {
    const selectedElements = elements.filter(el => el.isSelected);
    if (selectedElements.length === 0) {
      return null;
    }

    const x = Math.max(
      ...selectedElements.map(el => (el.width > 0 ? el.x + el.width : el.x))
    );
    const y = Math.min(
      ...selectedElements.map(el => (el.height < 0 ? el.y + el.width : el.y))
    );

    return (
      <div
        style={{
          left: x + this.state.scrollX + 16,
          top: y + this.state.scrollY - 4,
          position: "absolute",
          zIndex: 1,
          background: "rgba(255,255,255,0.8)",
          borderRadius: 4,
          padding: 10
        }}
        className="panelColumn"
      >
        {this.actionManager.renderAction(
          "changeStrokeColor",
          elements,
          this.state,
          this.syncActionResult
        )}

        {hasBackground(elements) && (
          <>
            {this.actionManager.renderAction(
              "changeBackgroundColor",
              elements,
              this.state,
              this.syncActionResult
            )}

            {this.actionManager.renderAction(
              "changeFillStyle",
              elements,
              this.state,
              this.syncActionResult
            )}
            <hr />
          </>
        )}

        {hasStroke(elements) && (
          <>
            {this.actionManager.renderAction(
              "changeStrokeWidth",
              elements,
              this.state,
              this.syncActionResult
            )}

            {this.actionManager.renderAction(
              "changeSloppiness",
              elements,
              this.state,
              this.syncActionResult
            )}
            <hr />
          </>
        )}

        {hasText(elements) && (
          <>
            {this.actionManager.renderAction(
              "changeFontSize",
              elements,
              this.state,
              this.syncActionResult
            )}

            {this.actionManager.renderAction(
              "changeFontFamily",
              elements,
              this.state,
              this.syncActionResult
            )}
            <hr />
          </>
        )}

        {this.actionManager.renderAction(
          "changeOpacity",
          elements,
          this.state,
          this.syncActionResult
        )}

        {this.actionManager.renderAction(
          "deleteSelectedElements",
          elements,
          this.state,
          this.syncActionResult
        )}
      </div>
    );
  }

  public render() {
    const canvasWidth = window.innerWidth - CANVAS_WINDOW_OFFSET_LEFT;
    const canvasHeight = window.innerHeight - CANVAS_WINDOW_OFFSET_TOP;

    return (
      <div className="container">
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 5,
            right: 0,
            display: "grid",
            gridTemplateColumns: "1fr 1fr minmax(0,1fr)",

            zIndex: 3
          }}
        >
          <div
            style={{
              paddingTop: 5,
              paddingLeft: 10,
              paddingRight: 5,
              flexShrink: 0,
              flexGrow: 1,
              display: "flex"
            }}
          >
            {this.actionManager.renderAction(
              "changeProjectName",
              elements,
              this.state,
              this.syncActionResult
            )}
          </div>
          <div
            style={{
              boxShadow: "0 1px 5px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "row",
              padding: 1,
              borderRadius: 4,
              justifySelf: "center",
              background: "white"
            }}
          >
            {this.actionManager.renderAction(
              "loadScene",
              elements,
              this.state,
              this.syncActionResult
            )}
            {this.actionManager.renderAction(
              "saveScene",
              elements,
              this.state,
              this.syncActionResult
            )}
            <div className="vertical-divider"></div>
            <label className="tool" title="Export to PNG">
              <button
                aria-label="Export to png"
                onClick={() => {
                  const exportedElements = elements.some(
                    element => element.isSelected
                  )
                    ? elements.filter(element => element.isSelected)
                    : elements;
                  if (this.canvas)
                    exportCanvas(
                      "png",
                      exportedElements,
                      this.canvas,
                      this.state
                    );
                }}
              >
                <div className="toolIcon">{image}</div>
              </button>
            </label>
            <label className="tool" title="Copy to clipboard">
              <button
                aria-label="Copy to clipboard"
                onClick={() => {
                  const exportedElements = elements.some(
                    element => element.isSelected
                  )
                    ? elements.filter(element => element.isSelected)
                    : elements;
                  if (this.canvas)
                    exportCanvas(
                      "clipboard",
                      exportedElements,
                      this.canvas,
                      this.state
                    );
                }}
              >
                <div className="toolIcon">{clipboard}</div>
              </button>
            </label>
            <div className="vertical-divider"></div>
            {this.actionManager.renderAction(
              "changeViewBackgroundColor",
              elements,
              this.state,
              this.syncActionResult
            )}
            {this.actionManager.renderAction(
              "clearCanvas",
              elements,
              this.state,
              this.syncActionResult
            )}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 5,
            top: 0,
            bottom: 0,
            display: "grid",
            gridTemplateColumns: "auto",
            gridTemplateRows: "minmax(50px, 1fr) 1fr minmax(0, 1fr)",
            zIndex: 2
          }}
        >
          <div />
          <div
            style={{
              boxShadow: "0 1px 5px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              padding: 1,
              borderRadius: 4,
              background: "white",
              alignSelf: "center"
            }}
          >
            {SHAPES.map(({ value, icon }) => (
              <label
                key={value}
                className="tool"
                title={`${capitalizeString(value)} - ${
                  capitalizeString(value)[0]
                }`}
              >
                <input
                  type="radio"
                  checked={this.state.elementType === value}
                  onChange={() => {
                    this.setState({ elementType: value });
                    elements = clearSelection(elements);
                    document.documentElement.style.cursor =
                      value === "text" ? "text" : "crosshair";
                    this.forceUpdate();
                  }}
                />
                <div className="toolIcon">{icon}</div>
              </label>
            ))}
          </div>
        </div>
        {this.renderSelectedElementsPopover(elements)}

        {/* <SidePanel
          actionManager={this.actionManager}
          syncActionResult={this.syncActionResult}
          appState={{ ...this.state }}
          elements={elements}
          onToolChange={value => {
            this.setState({ elementType: value });
            elements = clearSelection(elements);
            document.documentElement.style.cursor =
              value === "text" ? "text" : "crosshair";
            this.forceUpdate();
          }}
          canvas={this.canvas!}
        /> */}
        <canvas
          id="canvas"
          style={{
            width: canvasWidth,
            height: canvasHeight
          }}
          width={canvasWidth * window.devicePixelRatio}
          height={canvasHeight * window.devicePixelRatio}
          ref={canvas => {
            if (this.canvas === null) {
              this.canvas = canvas;
              this.rc = rough.canvas(this.canvas!);
            }
            if (canvas) {
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
                    label: "Paste",
                    action: () => this.pasteFromClipboard()
                  },
                  ...this.actionManager.getContextMenuItems(
                    elements,
                    this.state,
                    this.syncActionResult,
                    action => this.canvasOnlyActions.includes(action)
                  )
                ],
                top: e.clientY,
                left: e.clientX
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
                  label: "Copy",
                  action: this.copyToClipboard
                },
                navigator.clipboard && {
                  label: "Paste",
                  action: () => this.pasteFromClipboard()
                },
                ...this.actionManager.getContextMenuItems(
                  elements,
                  this.state,
                  this.syncActionResult,
                  action => !this.canvasOnlyActions.includes(action)
                )
              ],
              top: e.clientY,
              left: e.clientX
            });
          }}
          onMouseDown={e => {
            if (lastMouseUp !== null) {
              // Unfortunately, sometimes we don't get a mouseup after a mousedown,
              // this can happen when a contextual menu or alert is triggered. In order to avoid
              // being in a weird state, we clean up on the next mousedown
              lastMouseUp(e);
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
              isOverVerticalScrollBar
            } = isOverScrollBars(
              elements,
              e.clientX - CANVAS_WINDOW_OFFSET_LEFT,
              e.clientY - CANVAS_WINDOW_OFFSET_TOP,
              canvasWidth,
              canvasHeight,
              this.state.scrollX,
              this.state.scrollY
            );

            const { x, y } = viewportCoordsToSceneCoords(e, this.state);

            const element = newElement(
              this.state.elementType,
              x,
              y,
              this.state.currentItemStrokeColor,
              this.state.currentItemBackgroundColor,
              "hachure",
              1,
              1,
              100
            );

            type ResizeTestType = ReturnType<typeof resizeTest>;
            let resizeHandle: ResizeTestType = false;
            let isResizingElements = false;
            let draggingOccured = false;
            let hitElement: ExcalidrawElement | null = null;
            let elementIsAddedToSelection = false;
            if (this.state.elementType === "selection") {
              const resizeElement = getElementWithResizeHandler(
                elements,
                { x, y },
                this.state
              );

              this.setState({
                resizingElement: resizeElement ? resizeElement.element : null
              });

              if (resizeElement) {
                resizeHandle = resizeElement.resizeHandle;
                document.documentElement.style.cursor = `${resizeHandle}-resize`;
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
                        isSelected: false
                      })),
                      ...elements
                        .filter(element => element.isSelected)
                        .map(element => {
                          const newElement = duplicateElement(element);
                          newElement.isSelected = true;
                          return newElement;
                        })
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
                  y
                );
                if (snappedToCenterPosition) {
                  element.x = snappedToCenterPosition.elementCenterX;
                  element.y = snappedToCenterPosition.elementCenterY;
                  textX = snappedToCenterPosition.wysiwygX;
                  textY = snappedToCenterPosition.wysiwygY;
                }
              }

              textWysiwyg({
                initText: "",
                x: textX,
                y: textY,
                strokeColor: this.state.currentItemStrokeColor,
                font: this.state.currentItemFont,
                onSubmit: text => {
                  addTextElement(element, text, this.state.currentItemFont);
                  elements = [...elements, { ...element, isSelected: true }];
                  this.setState({
                    draggingElement: null,
                    elementType: "selection"
                  });
                }
              });
              this.setState({ elementType: "selection" });
              return;
            }

            if (this.state.elementType === "text") {
              elements = [...elements, { ...element, isSelected: true }];
              this.setState({
                draggingElement: null,
                elementType: "selection"
              });
            } else {
              elements = [...elements, element];
              this.setState({ draggingElement: element });
            }

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

                  let deltaX = 0;
                  let deltaY = 0;
                  selectedElements.forEach(element => {
                    switch (resizeHandle) {
                      case "nw":
                        deltaX = lastX - x;
                        element.width += deltaX;
                        element.x -= deltaX;
                        if (e.shiftKey) {
                          element.y += element.height - element.width;
                          element.height = element.width;
                        } else {
                          const deltaY = lastY - y;
                          element.height += deltaY;
                          element.y -= deltaY;
                        }
                        break;
                      case "ne":
                        element.width += x - lastX;
                        if (e.shiftKey) {
                          element.y += element.height - element.width;
                          element.height = element.width;
                        } else {
                          deltaY = lastY - y;
                          element.height += deltaY;
                          element.y -= deltaY;
                        }
                        break;
                      case "sw":
                        deltaX = lastX - x;
                        element.width += deltaX;
                        element.x -= deltaX;
                        if (e.shiftKey) {
                          element.height = element.width;
                        } else {
                          element.height += y - lastY;
                        }
                        break;
                      case "se":
                        element.width += x - lastX;
                        if (e.shiftKey) {
                          element.height = element.width;
                        } else {
                          element.height += y - lastY;
                        }
                        break;
                      case "n":
                        deltaY = lastY - y;
                        element.height += deltaY;
                        element.y -= deltaY;
                        break;
                      case "w":
                        deltaX = lastX - x;
                        element.width += deltaX;
                        element.x -= deltaX;
                        break;
                      case "s":
                        element.height += y - lastY;
                        break;
                      case "e":
                        element.width += x - lastX;
                        break;
                    }

                    el.x = element.x;
                    el.y = element.y;
                    el.shape = null;
                  });
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
                draggingOccured = true;
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

              let width =
                e.clientX -
                CANVAS_WINDOW_OFFSET_LEFT -
                draggingElement.x -
                this.state.scrollX;
              let height =
                e.clientY -
                CANVAS_WINDOW_OFFSET_TOP -
                draggingElement.y -
                this.state.scrollY;
              draggingElement.width = width;
              // Make a perfect square or circle when shift is enabled
              draggingElement.height =
                e.shiftKey && this.state.elementType !== "selection"
                  ? Math.abs(width) * Math.sign(height)
                  : height;
              draggingElement.shape = null;

              if (this.state.elementType === "selection") {
                if (!e.shiftKey) {
                  elements = clearSelection(elements);
                }
                const elementsWithinSelection = getElementsWithinSelection(
                  elements,
                  draggingElement
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
              const { draggingElement, elementType } = this.state;

              lastMouseUp = null;
              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);

              resetCursor();

              // If click occured on already selected element
              // it is needed to remove selection from other elements
              // or if SHIFT or META key pressed remove selection
              // from hitted element
              //
              // If click occured and elements were dragged or some element
              // was added to selection (on mousedown phase) we need to keep
              // selection unchanged
              if (
                hitElement &&
                !draggingOccured &&
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
              } else {
                draggingElement.isSelected = true;
              }

              this.setState({
                draggingElement: null,
                elementType: "selection"
              });

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

            const element = newElement(
              "text",
              x,
              y,
              this.state.currentItemStrokeColor,
              this.state.currentItemBackgroundColor,
              "hachure",
              1,
              1,
              100
            ) as ExcalidrawTextElement;

            let initText = "";
            let textX = e.clientX;
            let textY = e.clientY;

            if (elementAtPosition && isTextElement(elementAtPosition)) {
              elements = elements.filter(
                element => element.id !== elementAtPosition.id
              );
              this.forceUpdate();

              Object.assign(element, elementAtPosition);
              // x and y will change after calling addTextElement function
              element.x = elementAtPosition.x + elementAtPosition.width / 2;
              element.y = elementAtPosition.y + elementAtPosition.height / 2;
              initText = elementAtPosition.text;
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
            } else if (!e.altKey) {
              const snappedToCenterPosition = this.getTextWysiwygSnappedToCenterPosition(
                x,
                y
              );

              if (snappedToCenterPosition) {
                element.x = snappedToCenterPosition.elementCenterX;
                element.y = snappedToCenterPosition.elementCenterY;
                textX = snappedToCenterPosition.wysiwygX;
                textY = snappedToCenterPosition.wysiwygY;
              }
            }

            textWysiwyg({
              initText,
              x: textX,
              y: textY,
              strokeColor: element.strokeColor,
              font: element.font || this.state.currentItemFont,
              onSubmit: text => {
                addTextElement(
                  element,
                  text,
                  element.font || this.state.currentItemFont
                );
                elements = [...elements, { ...element, isSelected: true }];
                this.setState({
                  draggingElement: null,
                  elementType: "selection"
                });
              }
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
                this.state
              );
              if (resizeElement && resizeElement.resizeHandle) {
                document.documentElement.style.cursor = `${resizeElement.resizeHandle}-resize`;
                return;
              }
            }
            const hitElement = getElementAtPosition(elements, x, y);
            document.documentElement.style.cursor = hitElement ? "move" : "";
          }}
        />
      </div>
    );
  }

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { deltaX, deltaY } = e;
    this.setState(state => ({
      scrollX: state.scrollX - deltaX,
      scrollY: state.scrollY - deltaY
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
      let subCanvasX2 = 0;
      let subCanvasY1 = Infinity;
      let subCanvasY2 = 0;

      const minX = Math.min(...parsedElements.map(element => element.x));
      const minY = Math.min(...parsedElements.map(element => element.y));

      const distance = (x: number, y: number) => {
        return Math.abs(x > y ? x - y : y - x);
      };

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
        this.state.cursorX -
        this.state.scrollX -
        CANVAS_WINDOW_OFFSET_LEFT -
        elementsCenterX;
      const dy =
        this.state.cursorY -
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
        })
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
        y - elementCenterY
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
      viewBackgroundColor: this.state.viewBackgroundColor
    });
    this.saveDebounced();
    if (history.isRecording()) {
      history.pushEntry(history.generateCurrentEntry(elements));
    }
  }
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
