import { API } from "../tests/helpers/api";
import {
  computeContainerDimensionForBoundText,
  getContainerCoords,
  getBoundTextMaxWidth,
  getBoundTextMaxHeight,
} from "./textElement";
import { ExcalidrawTextElementWithContainer } from "./types";

describe("Test measureText", () => {
  describe("Test getContainerCoords", () => {
    const params = { width: 200, height: 100, x: 10, y: 20 };

    it("should compute coords correctly when ellipse", () => {
      const element = API.createElement({
        type: "ellipse",
        ...params,
      });
      expect(getContainerCoords(element)).toEqual({
        x: 44.2893218813452455,
        y: 39.64466094067262,
      });
    });

    it("should compute coords correctly when rectangle", () => {
      const element = API.createElement({
        type: "rectangle",
        ...params,
      });
      expect(getContainerCoords(element)).toEqual({
        x: 15,
        y: 25,
      });
    });

    it("should compute coords correctly when diamond", () => {
      const element = API.createElement({
        type: "diamond",
        ...params,
      });
      expect(getContainerCoords(element)).toEqual({
        x: 65,
        y: 50,
      });
    });
  });

  describe("Test computeContainerDimensionForBoundText", () => {
    const params = {
      width: 178,
      height: 194,
    };

    it("should compute container height correctly for rectangle", () => {
      const element = API.createElement({
        type: "rectangle",
        ...params,
      });
      expect(computeContainerDimensionForBoundText(150, element.type)).toEqual(
        160,
      );
    });

    it("should compute container height correctly for ellipse", () => {
      const element = API.createElement({
        type: "ellipse",
        ...params,
      });
      expect(computeContainerDimensionForBoundText(150, element.type)).toEqual(
        226,
      );
    });

    it("should compute container height correctly for diamond", () => {
      const element = API.createElement({
        type: "diamond",
        ...params,
      });
      expect(computeContainerDimensionForBoundText(150, element.type)).toEqual(
        320,
      );
    });
  });

  describe("Test getBoundTextMaxWidth", () => {
    const params = {
      width: 178,
      height: 194,
    };

    it("should return max width when container is rectangle", () => {
      const container = API.createElement({ type: "rectangle", ...params });
      expect(getBoundTextMaxWidth(container)).toBe(168);
    });

    it("should return max width when container is ellipse", () => {
      const container = API.createElement({ type: "ellipse", ...params });
      expect(getBoundTextMaxWidth(container)).toBe(116);
    });

    it("should return max width when container is diamond", () => {
      const container = API.createElement({ type: "diamond", ...params });
      expect(getBoundTextMaxWidth(container)).toBe(79);
    });

    it("should return max width when container is arrow", () => {
      const container = API.createElement({
        type: "arrow",
        ...params,
      });
      expect(getBoundTextMaxWidth(container)).toBe(220);
    });
  });

  describe("Test getBoundTextMaxHeight", () => {
    const params = {
      width: 178,
      height: 194,
      id: "container-id",
    };

    const boundTextElement = API.createElement({
      type: "text",
      id: "text-id",
      x: 560.51171875,
      y: 202.033203125,
      width: 154,
      height: 175,
      fontSize: 20,
      fontFamily: 1,
      text: "Excalidraw is a\nvirtual \nopensource \nwhiteboard for \nsketching \nhand-drawn like\ndiagrams",
      textAlign: "center",
      verticalAlign: "middle",
      containerId: params.id,
    }) as ExcalidrawTextElementWithContainer;

    it("should return max height when container is rectangle", () => {
      const container = API.createElement({ type: "rectangle", ...params });
      expect(getBoundTextMaxHeight(container, boundTextElement)).toBe(184);
    });

    it("should return max height when container is ellipse", () => {
      const container = API.createElement({ type: "ellipse", ...params });
      expect(getBoundTextMaxHeight(container, boundTextElement)).toBe(127);
    });

    it("should return max height when container is diamond", () => {
      const container = API.createElement({ type: "diamond", ...params });
      expect(getBoundTextMaxHeight(container, boundTextElement)).toBe(87);
    });

    it("should return max height when container is arrow", () => {
      const container = API.createElement({
        type: "arrow",
        ...params,
      });
      expect(getBoundTextMaxHeight(container, boundTextElement)).toBe(194);
    });

    it("should return max height when container is arrow and height is less than threshold", () => {
      const container = API.createElement({
        type: "arrow",
        ...params,
        height: 70,
        boundElements: [{ type: "text", id: "text-id" }],
      });

      expect(getBoundTextMaxHeight(container, boundTextElement)).toBe(
        boundTextElement.height,
      );
    });
  });
});
