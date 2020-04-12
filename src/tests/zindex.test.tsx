import React from "react";
import ReactDOM from "react-dom";
import { render } from "./test-utils";
import App from "../components/App";
import { reseed } from "../random";
import { newElement } from "../element";
import {
  actionSendBackward,
  actionBringForward,
  actionBringToFront,
  actionSendToBack,
} from "../actions";
import { ExcalidrawElement } from "../element/types";

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

const { h } = window;

function populateElements(
  elements: { id: string; isDeleted?: boolean; isSelected?: boolean }[],
) {
  const selectedElementIds: any = {};

  h.elements = elements.map(({ id, isDeleted = false, isSelected = false }) => {
    const element: Mutable<ExcalidrawElement> = newElement({
      type: "rectangle",
      x: 100,
      y: 100,
      strokeColor: h.state.currentItemStrokeColor,
      backgroundColor: h.state.currentItemBackgroundColor,
      fillStyle: h.state.currentItemFillStyle,
      strokeWidth: h.state.currentItemStrokeWidth,
      roughness: h.state.currentItemRoughness,
      opacity: h.state.currentItemOpacity,
    });
    element.id = id;
    element.isDeleted = isDeleted;
    if (isSelected) {
      selectedElementIds[element.id] = true;
    }
    return element;
  });

  h.setState({
    ...h.state,
    selectedElementIds,
  });

  return selectedElementIds;
}

type Actions =
  | typeof actionBringForward
  | typeof actionSendBackward
  | typeof actionBringToFront
  | typeof actionSendToBack;

function assertZindex({
  elements,
  operations,
}: {
  elements: { id: string; isDeleted?: true; isSelected?: true }[];
  operations: [Actions, string[]][];
}) {
  const selectedElementIds = populateElements(elements);
  operations.forEach(([action, expected]) => {
    h.app.actionManager.executeAction(action);
    expect(h.elements.map((element) => element.id)).toEqual(expected);
    expect(h.state.selectedElementIds).toEqual(selectedElementIds);
  });
}

describe("z-index manipulation", () => {
  it("send back", () => {
    render(<App />);

    assertZindex({
      elements: [
        { id: "A" },
        { id: "B", isDeleted: true },
        { id: "C", isDeleted: true },
        { id: "D", isSelected: true },
      ],
      operations: [
        [actionSendBackward, ["B", "C", "D", "A"]],
        // noop
        [actionSendBackward, ["B", "C", "D", "A"]],
      ],
    });

    assertZindex({
      elements: [
        { id: "A", isDeleted: true },
        { id: "B" },
        { id: "C", isDeleted: true },
        { id: "D", isSelected: true },
      ],
      operations: [[actionSendBackward, ["A", "C", "D", "B"]]],
    });

    assertZindex({
      elements: [
        { id: "A" },
        { id: "B", isDeleted: true },
        { id: "C", isDeleted: true },
        { id: "D", isSelected: true },
        { id: "E", isSelected: true },
      ],
      operations: [[actionSendBackward, ["B", "C", "D", "E", "A"]]],
    });

    assertZindex({
      elements: [
        { id: "A" },
        { id: "B" },
        { id: "C", isDeleted: true },
        { id: "D", isDeleted: true },
        { id: "E", isSelected: true },
        { id: "F" },
        { id: "G", isSelected: true },
      ],
      operations: [
        [actionSendBackward, ["A", "C", "D", "E", "B", "G", "F"]],
        [actionSendBackward, ["C", "D", "E", "A", "G", "B", "F"]],
      ],
    });
  });

  it("bring forward", () => {
    render(<App />);

    assertZindex({
      elements: [
        { id: "A", isSelected: true },
        { id: "B", isDeleted: true },
        { id: "C", isDeleted: true },
        { id: "D" },
        { id: "E", isSelected: true },
        { id: "F", isDeleted: true },
        { id: "G" },
      ],
      operations: [
        [actionBringForward, ["D", "A", "B", "C", "G", "E", "F"]],
        [actionBringForward, ["D", "G", "A", "B", "C", "E", "F"]],
      ],
    });
  });

  it("bring to front", () => {
    render(<App />);

    assertZindex({
      elements: [
        { id: "A", isSelected: true },
        { id: "B", isDeleted: true },
        { id: "C", isDeleted: true },
        { id: "D" },
        { id: "E", isSelected: true },
        { id: "F", isDeleted: true },
        { id: "G" },
      ],
      operations: [[actionBringToFront, ["D", "G", "A", "B", "C", "E", "F"]]],
    });
  });

  it("send to back", () => {
    render(<App />);

    assertZindex({
      elements: [
        { id: "A" },
        { id: "B", isDeleted: true },
        { id: "C" },
        { id: "D", isDeleted: true },
        { id: "E", isSelected: true },
        { id: "F", isDeleted: true },
        { id: "G" },
      ],
      operations: [[actionSendToBack, ["D", "E", "A", "B", "C", "F", "G"]]],
    });
  });
});
