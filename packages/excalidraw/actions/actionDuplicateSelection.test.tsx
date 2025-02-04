import { Excalidraw } from "../index";
import {
  act,
  assertElements,
  getCloneByOrigId,
  render,
} from "../tests/test-utils";
import { API } from "../tests/helpers/api";
import { actionDuplicateSelection } from "./actionDuplicateSelection";
import React from "react";
import { ORIG_ID } from "../constants";

const { h } = window;

describe("actionDuplicateSelection", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  describe("duplicating frames", () => {
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
        { id: frame.id },
        { id: rectangle.id, frameId: frame.id },
        { [ORIG_ID]: rectangle.id, frameId: getCloneByOrigId(frame.id)?.id },
        { [ORIG_ID]: frame.id, selected: true },
      ]);
    });

    it("frame selected only (with text container)", async () => {
      const frame = API.createElement({
        type: "frame",
      });

      const [rectangle, text] = API.createTextContainer({ frameId: frame.id });

      API.setElements([frame, rectangle, text]);
      API.setSelectedElements([frame]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: frame.id },
        { id: rectangle.id, frameId: frame.id },
        { id: text.id, containerId: rectangle.id, frameId: frame.id },
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

      const [rectangle, text] = API.createTextContainer({ frameId: frame.id });

      API.setElements([frame, rectangle, text]);
      API.setSelectedElements([frame, rectangle]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: frame.id },
        { id: rectangle.id, frameId: frame.id },
        { id: text.id, containerId: rectangle.id, frameId: frame.id },
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

      const [rectangle, text] = API.createTextContainer({ frameId: frame.id });

      API.setElements([text, rectangle, frame]);
      API.setSelectedElements([rectangle, frame]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: rectangle.id, frameId: frame.id },
        { id: text.id, containerId: rectangle.id, frameId: frame.id },
        { id: frame.id },
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
        { [ORIG_ID]: `${frame.id}`, type: "frame", selected: true },
      ]);
    });
  });

  describe("duplicating frame children", () => {
    it("frame child selected", () => {
      const frame = API.createElement({
        type: "frame",
      });

      const rectangle = API.createElement({
        type: "rectangle",
        frameId: frame.id,
      });

      API.setElements([frame, rectangle]);
      API.setSelectedElements([rectangle]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: frame.id },
        { id: rectangle.id, frameId: frame.id },
        { [ORIG_ID]: rectangle.id, frameId: frame.id, selected: true },
      ]);
    });

    it("frame text container selected (rectangle selected)", () => {
      const frame = API.createElement({
        type: "frame",
      });

      const [rectangle, text] = API.createTextContainer({ frameId: frame.id });

      API.setElements([frame, rectangle, text]);
      API.setSelectedElements([rectangle]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: frame.id },
        { id: rectangle.id, frameId: frame.id },
        { id: text.id, containerId: rectangle.id, frameId: frame.id },
        { [ORIG_ID]: rectangle.id, frameId: frame.id, selected: true },
        {
          [ORIG_ID]: text.id,
          containerId: getCloneByOrigId(rectangle.id).id,
          frameId: frame.id,
        },
      ]);
    });

    it("frame bound text selected (container not selected)", () => {
      const frame = API.createElement({
        type: "frame",
      });

      const [rectangle, text] = API.createTextContainer({ frameId: frame.id });

      API.setElements([frame, rectangle, text]);
      API.setSelectedElements([text]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: frame.id },
        { id: rectangle.id, frameId: frame.id },
        { id: text.id, containerId: rectangle.id, frameId: frame.id },
        { [ORIG_ID]: rectangle.id, frameId: frame.id, selected: true },
        {
          [ORIG_ID]: text.id,
          containerId: getCloneByOrigId(rectangle.id).id,
          frameId: frame.id,
        },
      ]);
    });

    it("frame text container selected (text not exists)", () => {
      const frame = API.createElement({
        type: "frame",
      });

      const [rectangle] = API.createTextContainer({ frameId: frame.id });

      API.setElements([frame, rectangle]);
      API.setSelectedElements([rectangle]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: frame.id },
        { id: rectangle.id, frameId: frame.id },
        { [ORIG_ID]: rectangle.id, frameId: frame.id, selected: true },
      ]);
    });

    // shouldn't happen
    it("frame bound text selected (container not exists)", () => {
      const frame = API.createElement({
        type: "frame",
      });

      const [, text] = API.createTextContainer({ frameId: frame.id });

      API.setElements([frame, text]);
      API.setSelectedElements([text]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: frame.id },
        { id: text.id, frameId: frame.id },
        { [ORIG_ID]: text.id, frameId: frame.id },
      ]);
    });

    it("frame bound container selected (text has no frameId)", () => {
      const frame = API.createElement({
        type: "frame",
      });

      const [rectangle, text] = API.createTextContainer({
        frameId: frame.id,
        label: { frameId: null },
      });

      API.setElements([frame, rectangle, text]);
      API.setSelectedElements([rectangle]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: frame.id },
        { id: rectangle.id, frameId: frame.id },
        { id: text.id, containerId: rectangle.id },
        { [ORIG_ID]: rectangle.id, frameId: frame.id, selected: true },
        {
          [ORIG_ID]: text.id,
          containerId: getCloneByOrigId(rectangle.id).id,
        },
      ]);
    });
  });

  describe("duplicating multiple frames", () => {
    it("multiple frames selected (no children)", () => {
      const frame1 = API.createElement({
        type: "frame",
      });

      const rect1 = API.createElement({
        type: "rectangle",
        frameId: frame1.id,
      });

      const frame2 = API.createElement({
        type: "frame",
      });

      const rect2 = API.createElement({
        type: "rectangle",
        frameId: frame2.id,
      });

      const ellipse = API.createElement({
        type: "ellipse",
      });

      API.setElements([rect1, frame1, ellipse, rect2, frame2]);
      API.setSelectedElements([frame1, frame2]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: rect1.id, frameId: frame1.id },
        { id: frame1.id },
        { [ORIG_ID]: rect1.id, frameId: getCloneByOrigId(frame1.id)?.id },
        { [ORIG_ID]: frame1.id, selected: true },
        { id: ellipse.id },
        { id: rect2.id, frameId: frame2.id },
        { id: frame2.id },
        { [ORIG_ID]: rect2.id, frameId: getCloneByOrigId(frame2.id)?.id },
        { [ORIG_ID]: frame2.id, selected: true },
      ]);
    });

    it("multiple frames selected (no children) + unrelated element", () => {
      const frame1 = API.createElement({
        type: "frame",
      });

      const rect1 = API.createElement({
        type: "rectangle",
        frameId: frame1.id,
      });

      const frame2 = API.createElement({
        type: "frame",
      });

      const rect2 = API.createElement({
        type: "rectangle",
        frameId: frame2.id,
      });

      const ellipse = API.createElement({
        type: "ellipse",
      });

      API.setElements([rect1, frame1, ellipse, rect2, frame2]);
      API.setSelectedElements([frame1, ellipse, frame2]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: rect1.id, frameId: frame1.id },
        { id: frame1.id },
        { [ORIG_ID]: rect1.id, frameId: getCloneByOrigId(frame1.id)?.id },
        { [ORIG_ID]: frame1.id, selected: true },
        { id: ellipse.id },
        { [ORIG_ID]: ellipse.id, selected: true },
        { id: rect2.id, frameId: frame2.id },
        { id: frame2.id },
        { [ORIG_ID]: rect2.id, frameId: getCloneByOrigId(frame2.id)?.id },
        { [ORIG_ID]: frame2.id, selected: true },
      ]);
    });
  });

  describe("duplicating containers/bound elements", () => {
    it("labeled arrow (arrow selected)", () => {
      const [arrow, text] = API.createLabeledArrow();

      API.setElements([arrow, text]);
      API.setSelectedElements([arrow]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: arrow.id },
        { id: text.id, containerId: arrow.id },
        { [ORIG_ID]: arrow.id, selected: true },
        { [ORIG_ID]: text.id, containerId: getCloneByOrigId(arrow.id)?.id },
      ]);
    });

    // shouldn't happen
    it("labeled arrow (text selected)", () => {
      const [arrow, text] = API.createLabeledArrow();

      API.setElements([arrow, text]);
      API.setSelectedElements([text]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: arrow.id },
        { id: text.id, containerId: arrow.id },
        { [ORIG_ID]: arrow.id, selected: true },
        { [ORIG_ID]: text.id, containerId: getCloneByOrigId(arrow.id)?.id },
      ]);
    });
  });

  describe("duplicating groups", () => {
    it("duplicate group containing frame (children don't have groupIds set)", () => {
      const frame = API.createElement({
        type: "frame",
        groupIds: ["A"],
      });

      const [rectangle, text] = API.createTextContainer({
        frameId: frame.id,
      });

      const ellipse = API.createElement({
        type: "ellipse",
        groupIds: ["A"],
      });

      API.setElements([rectangle, text, frame, ellipse]);
      API.setSelectedElements([frame, ellipse]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: rectangle.id, frameId: frame.id },
        { id: text.id, frameId: frame.id },
        { id: frame.id },
        { id: ellipse.id },
        { [ORIG_ID]: rectangle.id, frameId: getCloneByOrigId(frame.id)?.id },
        { [ORIG_ID]: text.id, frameId: getCloneByOrigId(frame.id)?.id },
        { [ORIG_ID]: frame.id, selected: true },
        { [ORIG_ID]: ellipse.id, selected: true },
      ]);
    });

    it("duplicate group containing frame (children have groupIds)", () => {
      const frame = API.createElement({
        type: "frame",
        groupIds: ["A"],
      });

      const [rectangle, text] = API.createTextContainer({
        frameId: frame.id,
        groupIds: ["A"],
      });

      const ellipse = API.createElement({
        type: "ellipse",
        groupIds: ["A"],
      });

      API.setElements([rectangle, text, frame, ellipse]);
      API.setSelectedElements([frame, ellipse]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: rectangle.id, frameId: frame.id },
        { id: text.id, frameId: frame.id },
        { id: frame.id },
        { id: ellipse.id },
        {
          [ORIG_ID]: rectangle.id,
          frameId: getCloneByOrigId(frame.id)?.id,
          // FIXME shouldn't be selected (in selectGroupsForSelectedElements)
          selected: true,
        },
        {
          [ORIG_ID]: text.id,
          frameId: getCloneByOrigId(frame.id)?.id,
          // FIXME shouldn't be selected (in selectGroupsForSelectedElements)
          selected: true,
        },
        { [ORIG_ID]: frame.id, selected: true },
        { [ORIG_ID]: ellipse.id, selected: true },
      ]);
    });

    it("duplicating element nested in group", () => {
      const ellipse = API.createElement({
        type: "ellipse",
        groupIds: ["B"],
      });
      const rect1 = API.createElement({
        type: "rectangle",
        groupIds: ["A", "B"],
      });
      const rect2 = API.createElement({
        type: "rectangle",
        groupIds: ["A", "B"],
      });

      API.setElements([ellipse, rect1, rect2]);
      API.setSelectedElements([ellipse], "B");

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: ellipse.id },
        { [ORIG_ID]: ellipse.id, groupIds: ["B"], selected: true },
        { id: rect1.id, groupIds: ["A", "B"] },
        { id: rect2.id, groupIds: ["A", "B"] },
      ]);
    });
  });
});
