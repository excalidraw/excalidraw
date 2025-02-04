import { Excalidraw, mutateElement } from "../index";
import {
  act,
  assertElements,
  getCloneByOrigId,
  render,
} from "../tests/test-utils";
import { API } from "../tests/helpers/api";
import { actionDuplicateSelection } from "./actionDuplicateSelection";
import type { ExcalidrawElement } from "../element/types";
import React from "react";
import { ORIG_ID } from "../constants";

const { h } = window;

const createTextContainer = (opts: {
  frameId?: ExcalidrawElement["id"];
  label?: {
    text?: string;
    frameId?: ExcalidrawElement["id"] | null;
  };
}) => {
  const rectangle = API.createElement({
    type: "rectangle",
    frameId: opts.frameId || null,
  });

  const text = API.createElement({
    type: "text",
    text: opts.label?.text || "sample-text",
    width: 50,
    height: 20,
    fontSize: 16,
    containerId: rectangle.id,
    frameId:
      opts.label?.frameId === undefined
        ? opts.frameId
        : opts.label?.frameId ?? null,
  });

  mutateElement(
    rectangle,
    {
      boundElements: [{ type: "text", id: text.id }],
    },
    false,
  );

  return [rectangle, text];
};

describe("duplicating frames", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("frame selected only", async () => {
    const frame = API.createElement({
      type: "frame",
    });

    const rectangle = API.createElement({
      type: "rectangle",
      frameId: frame.id,
    });

    API.setElements([frame, rectangle]);
    API.setSelectedElements([frame]);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    assertElements(h.elements, [
      { id: rectangle.id, frameId: frame.id },
      { id: frame.id },
      { [ORIG_ID]: rectangle.id, frameId: getCloneByOrigId(frame.id)?.id },
      { [ORIG_ID]: frame.id, selected: true },
    ]);
  });

  it("frame selected only (with text container)", async () => {
    const frame = API.createElement({
      type: "frame",
    });

    const [rectangle, text] = createTextContainer({ frameId: frame.id });

    API.setElements([frame, rectangle, text]);
    API.setSelectedElements([frame]);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    assertElements(h.elements, [
      { id: rectangle.id, frameId: frame.id },
      { id: text.id, containerId: rectangle.id, frameId: frame.id },
      { id: frame.id },
      { [ORIG_ID]: rectangle.id, frameId: getCloneByOrigId(frame.id)?.id },
      {
        [ORIG_ID]: text.id,
        containerId: getCloneByOrigId(rectangle.id)?.id,
        frameId: getCloneByOrigId(frame.id)?.id,
      },
      { [ORIG_ID]: frame.id, selected: true },
    ]);
  });

  it("frame + text container selected (order A)", async () => {
    const frame = API.createElement({
      type: "frame",
    });

    const [rectangle, text] = createTextContainer({ frameId: frame.id });

    API.setElements([frame, rectangle, text]);
    API.setSelectedElements([frame, rectangle]);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    assertElements(h.elements, [
      { id: rectangle.id, frameId: frame.id },
      { id: text.id, containerId: rectangle.id, frameId: frame.id },
      { id: frame.id },
      {
        [ORIG_ID]: rectangle.id,
        frameId: getCloneByOrigId(frame.id)?.id,
      },
      {
        [ORIG_ID]: text.id,
        containerId: getCloneByOrigId(rectangle.id)?.id,
        frameId: getCloneByOrigId(frame.id)?.id,
      },
      {
        [ORIG_ID]: frame.id,
        selected: true,
      },
    ]);
  });

  it("frame + text container selected (order B)", async () => {
    const frame = API.createElement({
      type: "frame",
    });

    const [rectangle, text] = createTextContainer({ frameId: frame.id });

    API.setElements([text, rectangle, frame]);
    API.setSelectedElements([rectangle, frame]);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    // FIXME z-indeces of duplicated elements are wrong
    assertElements(h.elements, [
      { id: rectangle.id, frameId: frame.id },
      { id: text.id, containerId: rectangle.id, frameId: frame.id },
      {
        type: "rectangle",
        [ORIG_ID]: `${rectangle.id}`,
      },
      {
        [ORIG_ID]: `${text.id}`,
        type: "text",
        containerId: getCloneByOrigId(rectangle.id)?.id,
        frameId: getCloneByOrigId(frame.id)?.id,
      },
      { id: frame.id },
      { [ORIG_ID]: `${frame.id}`, type: "frame", selected: true },
    ]);
  });
});
