import React from "react";
import ReactDOM from "react-dom";
import rough from "roughjs/bin/wrappers/rough";

import { moveOneLeft, moveAllLeft, moveOneRight, moveAllRight } from "./zindex";
import { randomSeed } from "./random";
import {
  newElement,
  resizeTest,
  generateDraw,
  isTextElement,
  textWysiwyg
} from "./element";
import {
  renderScene,
  clearSelection,
  getSelectedIndices,
  deleteSelectedElements,
  setSelection,
  isOverScrollBars,
  someElementIsSelected,
  getSelectedAttribute,
  loadFromJSON,
  saveAsJSON,
  exportAsPNG,
  restoreFromLocalStorage,
  saveToLocalStorage,
  hasBackground,
  hasStroke,
  getElementAtPosition,
  createScene
} from "./scene";
import { AppState } from "./types";
import { ExcalidrawElement, ExcalidrawTextElement } from "./element/types";

import { getDateTime, capitalizeString, isInputLike } from "./utils";

import { EditableText } from "./components/EditableText";
import { ButtonSelect } from "./components/ButtonSelect";
import { ColorPicker } from "./components/ColorPicker";
import { SHAPES, findShapeByKey, shapesShortcutKeys } from "./shapes";
import { createHistory } from "./history";

import "./styles.scss";
import ContextMenu from "./components/ContextMenu";

const { elements } = createScene();
const { history } = createHistory();

const DEFAULT_PROJECT_NAME = `excalidraw-${getDateTime()}`;

const CANVAS_WINDOW_OFFSET_LEFT = 250;
const CANVAS_WINDOW_OFFSET_TOP = 0;

export const KEYS = {
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  ARROW_DOWN: "ArrowDown",
  ARROW_UP: "ArrowUp",
  ESCAPE: "Escape",
  ENTER: "Enter",
  DELETE: "Delete",
  BACKSPACE: "Backspace"
};

const META_KEY = /Mac|iPod|iPhone|iPad/.test(window.navigator.platform)
  ? "metaKey"
  : "ctrlKey";

let COPIED_STYLES: string = "{}";

function isArrowKey(keyCode: string) {
  return (
    keyCode === KEYS.ARROW_LEFT ||
    keyCode === KEYS.ARROW_RIGHT ||
    keyCode === KEYS.ARROW_DOWN ||
    keyCode === KEYS.ARROW_UP
  );
}

function resetCursor() {
  document.documentElement.style.cursor = "";
}

function addTextElement(element: ExcalidrawTextElement, text = "") {
  resetCursor();
  if (text === null || text === "") {
    return false;
  }
  const fontSize = 20;
  element.text = text;
  element.font = `${fontSize}px Virgil`;
  const font = context.font;
  context.font = element.font;
  const textMeasure = context.measureText(element.text);
  const width = textMeasure.width;
  const actualBoundingBoxAscent =
    textMeasure.actualBoundingBoxAscent || fontSize;
  const actualBoundingBoxDescent = textMeasure.actualBoundingBoxDescent || 0;
  element.actualBoundingBoxAscent = actualBoundingBoxAscent;
  context.font = font;
  const height = actualBoundingBoxAscent + actualBoundingBoxDescent;
  // Center the text
  element.x -= width / 2;
  element.y -= actualBoundingBoxAscent;
  element.width = width;
  element.height = height;

  return true;
}

const ELEMENT_SHIFT_TRANSLATE_AMOUNT = 5;
const ELEMENT_TRANSLATE_AMOUNT = 1;

let lastCanvasWidth = -1;
let lastCanvasHeight = -1;

let lastMouseUp: ((e: any) => void) | null = null;

class App extends React.Component<{}, AppState> {
  public componentDidMount() {
    document.addEventListener("keydown", this.onKeyDown, false);
    window.addEventListener("resize", this.onResize, false);

    const savedState = restoreFromLocalStorage(elements);
    if (savedState) {
      this.setState(savedState);
    }
  }

  public componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyDown, false);
    window.removeEventListener("resize", this.onResize, false);
  }

  public state: AppState = {
    draggingElement: null,
    resizingElement: null,
    elementType: "selection",
    exportBackground: true,
    currentItemStrokeColor: "#000000",
    currentItemBackgroundColor: "#ffffff",
    viewBackgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    name: DEFAULT_PROJECT_NAME
  };

  private onResize = () => {
    this.forceUpdate();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (isInputLike(event.target)) return;

    if (event.key === KEYS.ESCAPE) {
      clearSelection(elements);
      this.forceUpdate();
      event.preventDefault();
    } else if (event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE) {
      this.deleteSelectedElements();
      event.preventDefault();
    } else if (isArrowKey(event.key)) {
      const step = event.shiftKey
        ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
        : ELEMENT_TRANSLATE_AMOUNT;
      elements.forEach(element => {
        if (element.isSelected) {
          if (event.key === KEYS.ARROW_LEFT) element.x -= step;
          else if (event.key === KEYS.ARROW_RIGHT) element.x += step;
          else if (event.key === KEYS.ARROW_UP) element.y -= step;
          else if (event.key === KEYS.ARROW_DOWN) element.y += step;
        }
      });
      this.forceUpdate();
      event.preventDefault();

      // Send backward: Cmd-Shift-Alt-B
    } else if (
      event[META_KEY] &&
      event.shiftKey &&
      event.altKey &&
      event.code === "KeyB"
    ) {
      this.moveOneLeft();
      event.preventDefault();

      // Send to back: Cmd-Shift-B
    } else if (event[META_KEY] && event.shiftKey && event.code === "KeyB") {
      this.moveAllLeft();
      event.preventDefault();

      // Bring forward: Cmd-Shift-Alt-F
    } else if (
      event[META_KEY] &&
      event.shiftKey &&
      event.altKey &&
      event.code === "KeyF"
    ) {
      this.moveOneRight();
      event.preventDefault();

      // Bring to front: Cmd-Shift-F
    } else if (event[META_KEY] && event.shiftKey && event.code === "KeyF") {
      this.moveAllRight();
      event.preventDefault();
      // Select all: Cmd-A
    } else if (event[META_KEY] && event.code === "KeyA") {
      elements.forEach(element => {
        element.isSelected = true;
      });
      this.forceUpdate();
      event.preventDefault();
    } else if (shapesShortcutKeys.includes(event.key.toLowerCase())) {
      this.setState({ elementType: findShapeByKey(event.key) });
    } else if (event[META_KEY] && event.code === "KeyZ") {
      if (event.shiftKey) {
        // Redo action
        history.redoOnce(elements);
      } else {
        // undo action
        history.undoOnce(elements);
      }
      this.forceUpdate();
      event.preventDefault();
      // Copy Styles: Cmd-Shift-C
    } else if (event.metaKey && event.shiftKey && event.code === "KeyC") {
      const element = elements.find(el => el.isSelected);
      if (element) {
        COPIED_STYLES = JSON.stringify(element);
      }
      // Paste Styles: Cmd-Shift-V
    } else if (event.metaKey && event.shiftKey && event.code === "KeyV") {
      const pastedElement = JSON.parse(COPIED_STYLES);
      if (pastedElement.type) {
        elements.forEach(element => {
          if (element.isSelected) {
            element.backgroundColor = pastedElement?.backgroundColor;
            element.strokeWidth = pastedElement?.strokeWidth;
            element.strokeColor = pastedElement?.strokeColor;
            element.fillStyle = pastedElement?.fillStyle;
            element.opacity = pastedElement?.opacity;
            generateDraw(element);
          }
        });
      }
      this.forceUpdate();
      event.preventDefault();
    }
  };

  private deleteSelectedElements = () => {
    deleteSelectedElements(elements);
    this.forceUpdate();
  };

  private clearCanvas = () => {
    if (window.confirm("This will clear the whole canvas. Are you sure?")) {
      elements.splice(0, elements.length);
      this.setState({
        viewBackgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0
      });
      this.forceUpdate();
    }
  };

  private moveAllLeft = () => {
    moveAllLeft(elements, getSelectedIndices(elements));
    this.forceUpdate();
  };

  private moveOneLeft = () => {
    moveOneLeft(elements, getSelectedIndices(elements));
    this.forceUpdate();
  };

  private moveAllRight = () => {
    moveAllRight(elements, getSelectedIndices(elements));
    this.forceUpdate();
  };

  private moveOneRight = () => {
    moveOneRight(elements, getSelectedIndices(elements));
    this.forceUpdate();
  };

  private removeWheelEventListener: (() => void) | undefined;

  private updateProjectName(name: string): void {
    this.setState({ name });
  }

  private changeProperty = (callback: (element: ExcalidrawElement) => void) => {
    elements.forEach(element => {
      if (element.isSelected) {
        callback(element);
        generateDraw(element);
      }
    });

    this.forceUpdate();
  };

  private changeOpacity = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.changeProperty(element => (element.opacity = +event.target.value));
  };

  private changeStrokeColor = (color: string) => {
    this.changeProperty(element => (element.strokeColor = color));
    this.setState({ currentItemStrokeColor: color });
  };

  private changeBackgroundColor = (color: string) => {
    this.changeProperty(element => (element.backgroundColor = color));
    this.setState({ currentItemBackgroundColor: color });
  };

  private copyToClipboard = () => {
    if (navigator.clipboard) {
      const text = JSON.stringify(
        elements.filter(element => element.isSelected)
      );
      navigator.clipboard.writeText(text);
    }
  };

  private pasteFromClipboard = (x?: number, y?: number) => {
    if (navigator.clipboard) {
      navigator.clipboard
        .readText()
        .then(text => this.addElementsFromPaste(text, x, y));
    }
  };

  public render() {
    const canvasWidth = window.innerWidth - CANVAS_WINDOW_OFFSET_LEFT;
    const canvasHeight = window.innerHeight - CANVAS_WINDOW_OFFSET_TOP;

    return (
      <div
        className="container"
        onCut={e => {
          e.clipboardData.setData(
            "text/plain",
            JSON.stringify(elements.filter(element => element.isSelected))
          );
          deleteSelectedElements(elements);
          this.forceUpdate();
          e.preventDefault();
        }}
        onCopy={e => {
          e.clipboardData.setData(
            "text/plain",
            JSON.stringify(elements.filter(element => element.isSelected))
          );
          e.preventDefault();
        }}
        onPaste={e => {
          const paste = e.clipboardData.getData("text");
          this.addElementsFromPaste(paste);
          e.preventDefault();
        }}
      >
        <div className="sidePanel">
          <h4>Shapes</h4>
          <div className="panelTools">
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
                    clearSelection(elements);
                    document.documentElement.style.cursor =
                      value === "text" ? "text" : "crosshair";
                    this.forceUpdate();
                  }}
                />
                <div className="toolIcon">{icon}</div>
              </label>
            ))}
          </div>
          {someElementIsSelected(elements) && (
            <div className="panelColumn">
              <h4>Selection</h4>
              <div className="buttonList">
                <button onClick={this.moveOneRight}>Bring forward</button>
                <button onClick={this.moveAllRight}>Bring to front</button>
                <button onClick={this.moveOneLeft}>Send backward</button>
                <button onClick={this.moveAllLeft}>Send to back</button>
              </div>
              <h5>Stroke Color</h5>
              <ColorPicker
                color={getSelectedAttribute(
                  elements,
                  element => element.strokeColor
                )}
                onChange={color => this.changeStrokeColor(color)}
              />

              {hasBackground(elements) && (
                <>
                  <h5>Background Color</h5>
                  <ColorPicker
                    color={getSelectedAttribute(
                      elements,
                      element => element.backgroundColor
                    )}
                    onChange={color => this.changeBackgroundColor(color)}
                  />
                  <h5>Fill</h5>
                  <ButtonSelect
                    options={[
                      { value: "solid", text: "Solid" },
                      { value: "hachure", text: "Hachure" },
                      { value: "cross-hatch", text: "Cross-hatch" }
                    ]}
                    value={getSelectedAttribute(
                      elements,
                      element => element.fillStyle
                    )}
                    onChange={value => {
                      this.changeProperty(element => {
                        element.fillStyle = value;
                      });
                    }}
                  />
                </>
              )}

              {hasStroke(elements) && (
                <>
                  <h5>Stroke Width</h5>
                  <ButtonSelect
                    options={[
                      { value: 1, text: "Thin" },
                      { value: 2, text: "Bold" },
                      { value: 4, text: "Extra Bold" }
                    ]}
                    value={getSelectedAttribute(
                      elements,
                      element => element.strokeWidth
                    )}
                    onChange={value => {
                      this.changeProperty(element => {
                        element.strokeWidth = value;
                      });
                    }}
                  />

                  <h5>Sloppiness</h5>
                  <ButtonSelect
                    options={[
                      { value: 0, text: "Draftsman" },
                      { value: 1, text: "Artist" },
                      { value: 3, text: "Cartoonist" }
                    ]}
                    value={getSelectedAttribute(
                      elements,
                      element => element.roughness
                    )}
                    onChange={value =>
                      this.changeProperty(element => {
                        element.roughness = value;
                      })
                    }
                  />
                </>
              )}

              <h5>Opacity</h5>
              <input
                type="range"
                min="0"
                max="100"
                onChange={this.changeOpacity}
                value={
                  getSelectedAttribute(elements, element => element.opacity) ||
                  0 /* Put the opacity at 0 if there are two conflicting ones */
                }
              />

              <button onClick={this.deleteSelectedElements}>
                Delete selected
              </button>
            </div>
          )}
          <h4>Canvas</h4>
          <div className="panelColumn">
            <h5>Canvas Background Color</h5>
            <ColorPicker
              color={this.state.viewBackgroundColor}
              onChange={color => this.setState({ viewBackgroundColor: color })}
            />
            <button
              onClick={this.clearCanvas}
              title="Clear the canvas & reset background color"
            >
              Clear canvas
            </button>
          </div>
          <h4>Export</h4>
          <div className="panelColumn">
            <h5>Name</h5>
            {this.state.name && (
              <EditableText
                value={this.state.name}
                onChange={(name: string) => this.updateProjectName(name)}
              />
            )}
            <h5>Image</h5>
            <button
              onClick={() => {
                exportAsPNG(elements, canvas, this.state);
              }}
            >
              Export to png
            </button>
            <label>
              <input
                type="checkbox"
                checked={this.state.exportBackground}
                onChange={e => {
                  this.setState({ exportBackground: e.target.checked });
                }}
              />
              background
            </label>
            <h5>Scene</h5>
            <button
              onClick={() => {
                saveAsJSON(elements, this.state.name);
              }}
            >
              Save as...
            </button>
            <button
              onClick={() => {
                loadFromJSON(elements).then(() => this.forceUpdate());
              }}
            >
              Load file...
            </button>
          </div>
        </div>
        <canvas
          id="canvas"
          style={{
            width: canvasWidth,
            height: canvasHeight
          }}
          width={canvasWidth * window.devicePixelRatio}
          height={canvasHeight * window.devicePixelRatio}
          ref={canvas => {
            if (this.removeWheelEventListener) {
              this.removeWheelEventListener();
              this.removeWheelEventListener = undefined;
            }
            if (canvas) {
              canvas.addEventListener("wheel", this.handleWheel, {
                passive: false
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

            const x =
              e.clientX - CANVAS_WINDOW_OFFSET_LEFT - this.state.scrollX;
            const y = e.clientY - CANVAS_WINDOW_OFFSET_TOP - this.state.scrollY;

            const element = getElementAtPosition(elements, x, y);
            if (!element) {
              ContextMenu.push({
                options: [
                  navigator.clipboard && {
                    label: "Paste",
                    action: () => this.pasteFromClipboard(x, y)
                  }
                ],
                top: e.clientY,
                left: e.clientX
              });
              return;
            }

            if (!element.isSelected) {
              clearSelection(elements);
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
                  action: () => this.pasteFromClipboard(x, y)
                },
                { label: "Delete", action: this.deleteSelectedElements },
                { label: "Move Forward", action: this.moveOneRight },
                { label: "Send to Front", action: this.moveAllRight },
                { label: "Move Backwards", action: this.moveOneLeft },
                { label: "Send to Back", action: this.moveAllLeft }
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

            const x =
              e.clientX - CANVAS_WINDOW_OFFSET_LEFT - this.state.scrollX;
            const y = e.clientY - CANVAS_WINDOW_OFFSET_TOP - this.state.scrollY;
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
            let resizeHandle: string | false = false;
            let isDraggingElements = false;
            let isResizingElements = false;
            if (this.state.elementType === "selection") {
              const resizeElement = elements.find(element => {
                return resizeTest(element, x, y, {
                  scrollX: this.state.scrollX,
                  scrollY: this.state.scrollY,
                  viewBackgroundColor: this.state.viewBackgroundColor
                });
              });

              this.setState({
                resizingElement: resizeElement ? resizeElement : null
              });

              if (resizeElement) {
                resizeHandle = resizeTest(resizeElement, x, y, {
                  scrollX: this.state.scrollX,
                  scrollY: this.state.scrollY,
                  viewBackgroundColor: this.state.viewBackgroundColor
                });
                document.documentElement.style.cursor = `${resizeHandle}-resize`;
                isResizingElements = true;
              } else {
                const hitElement = getElementAtPosition(elements, x, y);

                // If we click on something
                if (hitElement) {
                  if (hitElement.isSelected) {
                    // If that element is not already selected, do nothing,
                    // we're likely going to drag it
                  } else {
                    // We unselect every other elements unless shift is pressed
                    if (!e.shiftKey) {
                      clearSelection(elements);
                    }
                    // No matter what, we select it
                    hitElement.isSelected = true;
                  }
                } else {
                  // If we don't click on anything, let's remove all the selected elements
                  clearSelection(elements);
                }

                isDraggingElements = someElementIsSelected(elements);

                if (isDraggingElements) {
                  document.documentElement.style.cursor = "move";
                }
              }
            }

            if (isTextElement(element)) {
              textWysiwyg(e.clientX, e.clientY, text => {
                addTextElement(element, text);
                generateDraw(element);
                elements.push(element);
                element.isSelected = true;

                this.setState({
                  draggingElement: null,
                  elementType: "selection"
                });
              });
              return;
            }

            generateDraw(element);
            elements.push(element);
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
                  const x =
                    e.clientX - CANVAS_WINDOW_OFFSET_LEFT - this.state.scrollX;
                  const y =
                    e.clientY - CANVAS_WINDOW_OFFSET_TOP - this.state.scrollY;
                  selectedElements.forEach(element => {
                    switch (resizeHandle) {
                      case "nw":
                        element.width += element.x - lastX;
                        element.x = lastX;
                        if (e.shiftKey) {
                          element.y += element.height - element.width;
                          element.height = element.width;
                        } else {
                          element.height += element.y - lastY;
                          element.y = lastY;
                        }
                        break;
                      case "ne":
                        element.width = lastX - element.x;
                        if (e.shiftKey) {
                          element.y += element.height - element.width;
                          element.height = element.width;
                        } else {
                          element.height += element.y - lastY;
                          element.y = lastY;
                        }
                        break;
                      case "sw":
                        element.width += element.x - lastX;
                        element.x = lastX;
                        if (e.shiftKey) {
                          element.height = element.width;
                        } else {
                          element.height = lastY - element.y;
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
                        element.height += element.y - lastY;
                        element.y = lastY;
                        break;
                      case "w":
                        element.width += element.x - lastX;
                        element.x = lastX;
                        break;
                      case "s":
                        element.height = lastY - element.y;
                        break;
                      case "e":
                        element.width = lastX - element.x;
                        break;
                    }

                    el.x = element.x;
                    el.y = element.y;
                    generateDraw(el);
                  });
                  lastX = x;
                  lastY = y;
                  // We don't want to save history when resizing an element
                  history.skipRecording();
                  this.forceUpdate();
                  return;
                }
              }

              if (isDraggingElements) {
                const selectedElements = elements.filter(el => el.isSelected);
                if (selectedElements.length) {
                  const x =
                    e.clientX - CANVAS_WINDOW_OFFSET_LEFT - this.state.scrollX;
                  const y =
                    e.clientY - CANVAS_WINDOW_OFFSET_TOP - this.state.scrollY;
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
              draggingElement.height = e.shiftKey
                ? Math.abs(width) * Math.sign(height)
                : height;

              generateDraw(draggingElement);

              if (this.state.elementType === "selection") {
                setSelection(elements, draggingElement);
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

              // if no element is clicked, clear the selection and redraw
              if (draggingElement === null) {
                clearSelection(elements);
                this.forceUpdate();
                return;
              }

              if (elementType === "selection") {
                if (isDraggingElements) {
                  isDraggingElements = false;
                }
                elements.pop();
              } else {
                draggingElement.isSelected = true;
              }

              this.setState({
                draggingElement: null,
                elementType: "selection"
              });
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
            const x =
              e.clientX - CANVAS_WINDOW_OFFSET_LEFT - this.state.scrollX;
            const y = e.clientY - CANVAS_WINDOW_OFFSET_TOP - this.state.scrollY;

            if (getElementAtPosition(elements, x, y)) {
              return;
            }

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
            );

            textWysiwyg(e.clientX, e.clientY, text => {
              addTextElement(element as ExcalidrawTextElement, text);
              generateDraw(element);
              elements.push(element);
              element.isSelected = true;

              this.setState({
                draggingElement: null,
                elementType: "selection"
              });
            });
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

  private addElementsFromPaste = (paste: string, x?: number, y?: number) => {
    let parsedElements;
    try {
      parsedElements = JSON.parse(paste);
    } catch (e) {}
    if (
      Array.isArray(parsedElements) &&
      parsedElements.length > 0 &&
      parsedElements[0].type // need to implement a better check here...
    ) {
      clearSelection(elements);

      let dx: number;
      let dy: number;
      if (x) {
        let minX = Math.min(...parsedElements.map(element => element.x));
        dx = x - minX;
      }
      if (y) {
        let minY = Math.min(...parsedElements.map(element => element.y));
        dy = y - minY;
      }

      parsedElements.forEach(parsedElement => {
        parsedElement.x = dx ? parsedElement.x + dx : 10 - this.state.scrollX;
        parsedElement.y = dy ? parsedElement.y + dy : 10 - this.state.scrollY;
        parsedElement.seed = randomSeed();
        generateDraw(parsedElement);
        elements.push(parsedElement);
      });
      this.forceUpdate();
    }
  };

  componentDidUpdate() {
    renderScene(elements, rc, canvas, {
      scrollX: this.state.scrollX,
      scrollY: this.state.scrollY,
      viewBackgroundColor: this.state.viewBackgroundColor
    });
    saveToLocalStorage(elements, this.state);
    if (history.isRecording()) {
      history.pushEntry(history.generateCurrentEntry(elements));
      history.clearRedoStack();
    }
    history.resumeRecording();
  }
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const rc = rough.canvas(canvas);
const context = canvas.getContext("2d")!;

ReactDOM.render(<App />, rootElement);
