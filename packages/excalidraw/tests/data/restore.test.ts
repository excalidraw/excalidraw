import { pointFrom } from "@excalidraw/math";
import { vi } from "vitest";

import {
  COLOR_PALETTE,
  DEFAULT_ELEMENT_PROPS,
  DEFAULT_FONT_SIZE,
  DEFAULT_SIDEBAR,
  FONT_FAMILY,
  getLineHeight,
  ROUNDNESS,
  STICKY_NOTE_MAX_FONT_SIZE,
  DEFAULT_STICKY_NOTE_BG,
  STICKY_NOTE_MIN_FONT_SIZE,
} from "@excalidraw/common";

import { newElementWith } from "@excalidraw/element";
import * as sizeHelpers from "@excalidraw/element";

import { getStickyNoteLayout } from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawStickyNoteElement,
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  FractionalIndex,
} from "@excalidraw/element/types";
import type { NormalizedZoomValue } from "@excalidraw/excalidraw/types";

import { API } from "../helpers/api";
import * as restore from "../../data/restore";
import { getDefaultAppState } from "../../appState";
import { serializeAsJSON } from "../../data/json";

import type { ImportedDataState } from "../../data/types";
import type { LibraryItem, LibraryItem_v1, LibraryItems } from "../../types";

describe("restoreElements", () => {
  const mockSizeHelper = vi.spyOn(sizeHelpers, "isInvisiblySmallElement");

  beforeEach(() => {
    mockSizeHelper.mockReset();
  });

  afterAll(() => {
    mockSizeHelper.mockRestore();
  });

  it("basic restoreElements", () => {
    const textElement = API.createElement({ type: "text" });
    const rectElement = API.createElement({ type: "rectangle" });
    const elements = [textElement, rectElement];

    const restoredElements = restore.restoreElements(elements, null);
    expect(restoredElements.length).toBe(elements.length);
  });

  it.each([123, 0, null, undefined])(
    "restores created=%s without substituting load or last-update time",
    (created) => {
      const element = {
        ...API.createElement({
          type: "rectangle",
          index: "a0" as FractionalIndex,
        }),
        created,
        updated: 456,
      };
      // JSON removes undefined, matching files from clients predating created.
      const input: ImportedDataState = JSON.parse(
        JSON.stringify({ elements: [element] }),
      );
      const restored = restore.restoreElements(input.elements, null);

      expect(restored[0]).toMatchObject({
        id: element.id,
        created: created ?? null,
        updated: 456,
      });

      const exported: ImportedDataState = JSON.parse(
        serializeAsJSON(restored, getDefaultAppState(), {}, "local"),
      );
      expect(exported.elements?.[0]).toHaveProperty("created", created ?? null);
      expect(restore.restoreElements(exported.elements, null)).toEqual(
        restored,
      );
    },
  );

  it("preserves creation metadata when repairing duplicate element IDs", () => {
    const element = API.createElement({ type: "rectangle", created: 123 });
    const restored = restore.restoreElements(
      [element, { ...element, created: null }],
      null,
    );

    expect(restored.map(({ created }) => created)).toEqual([123, null]);
    expect(restored[0].id).not.toBe(restored[1].id);
  });

  it("should restore transparent sticky note stroke as black", () => {
    const stickyNote = {
      ...API.createElement({ type: "stickynote" }),
      strokeColor: COLOR_PALETTE.transparent,
    };

    const restoredElement = restore.restoreElements([stickyNote], null)[0];

    expect(restoredElement.strokeColor).toBe(COLOR_PALETTE.black);
  });

  it("when imported data state is null it should return an empty array of elements", () => {
    const restoredElements = restore.restoreElements(null, null);
    expect(restoredElements.length).toBe(0);
  });

  it("should return empty array when element is null", () => {
    expect(restore.restoreElements(null, null)).toStrictEqual([]);
  });

  it.each([
    ["without options", undefined],
    [
      "with import options",
      { repairBindings: true, deleteInvisibleElements: true },
    ],
  ] as const)(
    "should skip malformed entries and keep the rest of the scene (%s)",
    (_, opts) => {
      const container = API.createElement({
        type: "rectangle",
        id: "container",
        boundElements: [{ type: "text", id: "label" }],
      });
      const label = API.createElement({
        type: "text",
        id: "label",
        containerId: container.id,
      });

      const restoredElements = restore.restoreElements(
        [
          null,
          undefined,
          0,
          "",
          "rectangle",
          true,
          // arrays are objects, but not elements
          Object.assign([], { type: "rectangle", id: "array" }),
          {},
          { id: "typeless" },
          { type: 5, id: "non-string-type" },
          container,
          null,
          label,
        ] as any[],
        null,
        opts,
      );

      expect(restoredElements.map((element) => element.id)).toEqual([
        container.id,
        label.id,
      ]);
      expect(restoredElements[0].boundElements).toEqual([
        { type: "text", id: label.id },
      ]);
      expect((restoredElements[1] as ExcalidrawTextElement).containerId).toBe(
        container.id,
      );
    },
  );

  it.each([
    ["without options", undefined],
    [
      "with import options",
      { repairBindings: true, deleteInvisibleElements: true },
    ],
  ] as const)(
    "should return empty array when elements are not an array or all malformed (%s)",
    (_, opts) => {
      const rect = API.createElement({ type: "rectangle" });

      expect(
        restore.restoreElements({ 0: rect, length: 1 } as any, null, opts),
      ).toEqual([]);
      expect(
        restore.restoreElements([null, undefined, 1] as any[], null, opts),
      ).toEqual([]);
    },
  );

  it("should not call isInvisiblySmallElement when element is a selection element", () => {
    const selectionEl = { type: "selection" } as ExcalidrawElement;
    const restoreElements = restore.restoreElements([selectionEl], null);
    expect(restoreElements.length).toBe(0);
    expect(sizeHelpers.isInvisiblySmallElement).toBeCalledTimes(0);
  });

  it("should return empty array when input type is not supported", () => {
    const dummyNotSupportedElement: any = API.createElement({
      type: "text",
    });

    dummyNotSupportedElement.type = "not supported";
    expect(
      restore.restoreElements([dummyNotSupportedElement], null).length,
    ).toBe(0);
  });

  it("should return empty array when isInvisiblySmallElement is true", () => {
    const rectElement = API.createElement({ type: "rectangle" });
    mockSizeHelper.mockImplementation(() => true);

    expect(
      restore.restoreElements([rectElement], null, {
        deleteInvisibleElements: true,
      }),
    ).toEqual([expect.objectContaining({ isDeleted: true })]);
  });

  it("should restore text element correctly passing value for each attribute", () => {
    const textElement = API.createElement({
      type: "text",
      fontSize: 14,
      fontFamily: FONT_FAMILY.Virgil,
      text: "text",
      textAlign: "center",
      verticalAlign: "middle",
      id: "id-text01",
    });

    const restoredText = restore.restoreElements(
      [textElement],
      null,
    )[0] as ExcalidrawTextElement;

    expect(restoredText).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
  });

  it("should not delete empty text element when opts.deleteInvisibleElements is not defined", () => {
    const textElement = API.createElement({
      type: "text",
      text: "",
      isDeleted: false,
    });

    const restoredElements = restore.restoreElements([textElement], null);

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: textElement.id,
        isDeleted: false,
      }),
    ]);
  });

  it("should restore text element correctly with unknown font family, null text and undefined alignment", () => {
    const textElement: any = API.createElement({
      type: "text",
      textAlign: undefined,
      verticalAlign: undefined,
      id: "id-text01",
    });

    textElement.text = null;
    textElement.originalText = null;
    textElement.font = "10 unknown";

    expect(textElement.isDeleted).toBe(false);
    const restoredText = restore.restoreElements([textElement], null, {
      deleteInvisibleElements: true,
    })[0] as ExcalidrawTextElement;
    expect(restoredText.isDeleted).toBe(true);
    expect(restoredText).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
  });

  it("should detect the line height of a text element that only has the legacy font prop", () => {
    const textElement: any = API.createElement({
      type: "text",
      id: "id-text-legacy-font",
    });

    // a diagram old enough to carry `font` has none of the props that
    // replaced it
    delete textElement.fontSize;
    delete textElement.fontFamily;
    delete textElement.lineHeight;
    textElement.font = "20px Virgil";
    textElement.text = "hi";
    textElement.height = 50;

    const restoredText = restore.restoreElements(
      [textElement],
      null,
    )[0] as ExcalidrawTextElement;

    expect(restoredText.fontSize).toBe(20);
    expect(restoredText.fontFamily).toBe(FONT_FAMILY.Virgil);
    expect(restoredText.lineHeight).toBe(2.5);
  });

  it("should fall back to the font line height when it can't be detected", () => {
    const textElement: any = API.createElement({
      type: "text",
      id: "id-text-unusable-height",
    });

    delete textElement.lineHeight;
    textElement.text = "hi";
    textElement.height = "unknown";

    const restoredText = restore.restoreElements(
      [textElement],
      null,
    )[0] as ExcalidrawTextElement;

    expect(restoredText.lineHeight).toBe(getLineHeight(textElement.fontFamily));
  });

  it("should sanitize non-finite font sizes on text elements", () => {
    const textElement: any = API.createElement({
      type: "text",
      text: "text",
    });
    textElement.fontSize = NaN;
    textElement.baseFontSize = "abc";

    const restoredText = restore.restoreElements(
      [textElement],
      null,
    )[0] as ExcalidrawTextElement;

    expect(restoredText.fontSize).toBe(DEFAULT_FONT_SIZE);
    expect(restoredText.baseFontSize).toBe(null);
  });

  it("should clamp restored font ceilings to the sticky note maximum", () => {
    const textElement: any = API.createElement({
      type: "text",
      text: "text",
    });
    textElement.baseFontSize = 1e20;

    const restoredText = restore.restoreElements(
      [textElement],
      null,
    )[0] as ExcalidrawTextElement;

    expect(restoredText.baseFontSize).toBe(STICKY_NOTE_MAX_FONT_SIZE);
  });

  it("should clear a font ceiling on text that is not bound to a sticky note", () => {
    // generic binding repair (duplication, history) can detach a label without
    // touching its ceiling; restore reconciles it against the container
    const textElement: any = API.createElement({
      type: "text",
      text: "text",
      fontSize: 20,
    });
    textElement.baseFontSize = 28;

    const restoredText = restore.restoreElements([textElement], null, {
      repairBindings: true,
    })[0] as ExcalidrawTextElement;

    expect(restoredText.baseFontSize).toBe(null);
  });

  it("should seed the font ceiling and a visible stroke on a sticky note label", () => {
    const stickyNote = API.createElement({
      type: "stickynote",
      id: "sticky",
      boundElements: [{ type: "text", id: "label" }],
    });
    const label: any = {
      ...API.createElement({
        type: "text",
        id: "label",
        text: "text",
        fontSize: 20,
        containerId: "sticky",
      }),
      strokeColor: COLOR_PALETTE.transparent,
    };
    delete label.baseFontSize;

    const restored = restore.restoreElements([stickyNote, label], null, {
      repairBindings: true,
    });
    const restoredLabel = restored.find(
      (element) => element.id === "label",
    ) as ExcalidrawTextElement;

    expect(restoredLabel.baseFontSize).toBe(20);
    expect(restoredLabel.strokeColor).toBe(COLOR_PALETTE.black);
  });

  it("should give a note its label's color when the two drifted apart", () => {
    const stickyNote = API.createElement({
      type: "stickynote",
      id: "sticky",
      strokeColor: COLOR_PALETTE.black,
      boundElements: [{ type: "text", id: "label" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      text: "text",
      fontSize: 20,
      containerId: "sticky",
      strokeColor: COLOR_PALETTE.red[4],
    });

    const restored = restore.restoreElements([stickyNote, label], null, {
      repairBindings: true,
    });

    expect(
      restored.find((element) => element.id === "sticky")!.strokeColor,
    ).toBe(COLOR_PALETTE.red[4]);
    expect(
      restored.find((element) => element.id === "label")!.strokeColor,
    ).toBe(COLOR_PALETTE.red[4]);
  });

  it("should restore the sticky note defaults and top-pick slots", () => {
    const restored = restore.restoreAppState(
      {
        currentItemStickynoteBackgroundColor: COLOR_PALETTE.transparent,
        currentItemStickynoteStrokeColor: COLOR_PALETTE.transparent,
        colorTopPicks: { stickyNoteBackground: ["#fcc2d7", "#b2f2bb"] },
      } as any,
      null,
    );

    expect(restored.currentItemStickynoteBackgroundColor).toBe(
      DEFAULT_STICKY_NOTE_BG,
    );
    expect(restored.currentItemStickynoteStrokeColor).toBe(COLOR_PALETTE.black);
    expect(restored.colorTopPicks.stickyNoteBackground).toEqual([
      "#fcc2d7",
      "#b2f2bb",
    ]);
    expect(restored.colorTopPicks.stickyNoteStroke).toBe(null);
  });

  it("should refit a sticky note together with its label when refreshing dimensions", () => {
    const stickyNote = API.createElement({
      type: "stickynote",
      id: "sticky",
      width: 250,
      height: 250,
      baseHeight: 250,
      boundElements: [{ type: "text", id: "label" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      text: Array(40).fill("abcdefghijklmnopqrstuvwx").join("\n"),
      fontSize: 28,
      containerId: "sticky",
    });

    const restored = restore.restoreElements([stickyNote, label], null, {
      repairBindings: true,
      refreshDimensions: true,
    });
    const note = restored.find(
      (element) => element.id === "sticky",
    ) as ExcalidrawStickyNoteElement;
    const text = restored.find(
      (element) => element.id === "label",
    ) as ExcalidrawTextElement;

    // both halves: the note grew for the text at the minimum font, the base
    // is untouched, and the pair agrees with the layout
    expect(note.baseHeight).toBe(250);
    expect(note.height).toBeGreaterThan(250);
    expect(text.fontSize).toBe(STICKY_NOTE_MIN_FONT_SIZE);
    expect(text.baseFontSize).toBe(28);
    expect(note.height).toBeCloseTo(
      getStickyNoteLayout(note, text).container.height,
    );
  });

  it("should restore freedraw element correctly", () => {
    const freedrawElement = API.createElement({
      type: "freedraw",
      id: "id-freedraw01",
      points: [pointFrom(0, 0), pointFrom(10, 10)],
    });

    const restoredFreedraw = restore.restoreElements(
      [freedrawElement],
      null,
    )[0] as ExcalidrawFreeDrawElement;

    expect(restoredFreedraw).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
  });

  it("should restore only valid freedraw points and keep pressures aligned", () => {
    const freedrawElement = API.createElement({
      type: "freedraw",
      id: "id-freedraw-invalid-points",
      points: [pointFrom(0, 0), pointFrom(10, 10)],
    });

    const restoredFreedraw = restore.restoreElements(
      [
        {
          ...freedrawElement,
          simulatePressure: false,
          points: [
            pointFrom(0, 0),
            [Infinity, 10],
            null,
            pointFrom(20, 20),
            [NaN, 30],
            [40, null],
          ],
          pressures: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
        } as any,
      ],
      null,
    )[0] as ExcalidrawFreeDrawElement;

    expect(restoredFreedraw.points).toEqual([
      pointFrom(0, 0),
      pointFrom(20, 20),
    ]);
    expect(restoredFreedraw.pressures).toEqual([0.1, 0.4]);
  });

  it("should restore freedraw stroke variability", () => {
    const freedrawElement = API.createElement({
      type: "freedraw",
      id: "id-freedraw-mode",
      points: [pointFrom(0, 0), pointFrom(10, 10)],
    });

    const [missing, bogusString, bogusNumber, valid, variable] =
      restore.restoreElements(
        [
          { ...freedrawElement, id: "missing", strokeOptions: undefined },
          {
            ...freedrawElement,
            id: "bogusString",
            strokeOptions: { variability: "scribble" },
          },
          {
            ...freedrawElement,
            id: "bogusNumber",
            strokeOptions: { variability: 42 },
          },
          {
            ...freedrawElement,
            id: "valid",
            strokeOptions: { variability: "constant", streamline: 0.8 },
          },
          {
            ...freedrawElement,
            id: "variable",
            strokeOptions: { variability: "variable", streamline: 0.8 },
          },
        ] as any,
        null,
      ) as ExcalidrawFreeDrawElement[];

    expect(missing.strokeOptions?.variability).toBe("variable");
    expect(bogusString.strokeOptions?.variability).toBe("variable");
    expect(bogusNumber.strokeOptions?.variability).toBe("variable");
    expect(valid.strokeOptions?.variability).toBe("constant");
    expect(variable.strokeOptions?.variability).toBe("variable");
    expect(missing.strokeOptions?.streamline).toBe(0.5);
    expect(bogusString.strokeOptions?.streamline).toBe(0.5);
    expect(bogusNumber.strokeOptions?.streamline).toBe(0.5);
    expect(valid.strokeOptions?.streamline).toBe(0.8);
    expect(variable.strokeOptions?.streamline).toBe(0.8);
  });

  it("should restore line and draw elements correctly", () => {
    const lineElement = API.createElement({ type: "line", id: "id-line01" });

    const drawElement: any = API.createElement({
      type: "line",
      id: "id-draw01",
    });
    drawElement.type = "draw";

    const restoredElements = restore.restoreElements(
      [lineElement, drawElement],
      null,
    );

    const restoredLine = restoredElements[0] as ExcalidrawLinearElement;
    const restoredDraw = restoredElements[1] as ExcalidrawLinearElement;

    expect(restoredLine).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
    expect(restoredDraw).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
  });

  it("should restore arrow element correctly", () => {
    const arrowElement = API.createElement({ type: "arrow", id: "id-arrow01" });

    const restoredElements = restore.restoreElements([arrowElement], null);

    const restoredArrow = restoredElements[0] as ExcalidrawLinearElement;

    expect(restoredArrow).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
  });

  it("should normalize legacy crowfoot arrowheads on restore", () => {
    const arrowElement = API.createElement({
      type: "arrow",
    });

    const restoredArrow = restore.restoreElements(
      [
        {
          ...arrowElement,
          startArrowhead: "crowfoot_one",
          endArrowhead: "crowfoot_one_or_many",
        } as any,
      ],
      null,
    )[0] as ExcalidrawLinearElement;

    expect(restoredArrow.startArrowhead).toBe("cardinality_one");
    expect(restoredArrow.endArrowhead).toBe("cardinality_one_or_many");
  });

  it("should strip element if restore fails", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      boundElements: [],
    });
    const rect2 = API.createElement({
      type: "rectangle",
      boundElements: [],
    });

    // define getter for a property we access during restoreElement that throws
    Object.defineProperty(rect2, "seed", {
      get: () => {
        throw new Error("FORBIDDEN!");
      },
    });

    const restoredElements = restore.restoreElements([rect1, rect2], null);

    expect(restoredElements.length).toBe(1);

    expect(restoredElements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: rect1.id,
        }),
      ]),
    );
  });

  it("should remove imperceptibly small elements", () => {
    const arrowElement = API.createElement({
      type: "arrow",
      points: [
        [0, 0],
        [0.02, 0.05],
      ] as LocalPoint[],
      x: 0,
      y: 0,
    });

    const restoredElements = restore.restoreElements([arrowElement], null, {
      deleteInvisibleElements: true,
    });

    const restoredArrow = restoredElements[0] as
      | ExcalidrawArrowElement
      | undefined;

    expect(restoredArrow).not.toBeUndefined();
    expect(restoredArrow?.isDeleted).toBe(true);
  });

  it("should keep 'imperceptibly' small freedraw/line elements", () => {
    const freedrawElement = API.createElement({
      type: "freedraw",
      points: [
        [0, 0],
        [0.0001, 0.0001],
      ] as LocalPoint[],
      x: 0,
      y: 0,
    });
    const lineElement = API.createElement({
      type: "line",
      points: [
        [0, 0],
        [0.0001, 0.0001],
      ] as LocalPoint[],
      x: 0,
      y: 0,
    });

    const restoredElements = restore.restoreElements(
      [freedrawElement, lineElement],
      null,
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({ id: freedrawElement.id }),
      expect.objectContaining({ id: lineElement.id }),
    ]);
  });

  it("should restore loop linears correctly", () => {
    const linearElement = API.createElement({
      type: "line",
      points: [
        [0, 0],
        [100, 100],
        [100, 200],
        [0, 0],
      ] as LocalPoint[],
      x: 0,
      y: 0,
    });
    const arrowElement = API.createElement({
      type: "arrow",
      points: [
        [0, 0],
        [100, 100],
        [100, 200],
        [0, 0],
      ] as LocalPoint[],
      x: 500,
      y: 500,
    });

    const restoredElements = restore.restoreElements(
      [linearElement, arrowElement],
      null,
    );

    const restoredLinear = restoredElements[0] as
      | ExcalidrawLinearElement
      | undefined;
    const restoredArrow = restoredElements[1] as
      | ExcalidrawArrowElement
      | undefined;

    expect(restoredLinear?.type).toBe("line");
    expect(restoredLinear?.points).toEqual([
      [0, 0],
      [100, 100],
      [100, 200],
      [0, 0],
    ] as LocalPoint[]);
    expect(restoredArrow?.type).toBe("arrow");
    expect(restoredArrow?.points).toEqual([
      [0, 0],
      [100, 100],
      [100, 200],
      [0, 0],
    ] as LocalPoint[]);
  });

  it('should set arrow element endArrowHead as "arrow" when arrow element endArrowHead is null', () => {
    const arrowElement = API.createElement({ type: "arrow" });
    const restoredElements = restore.restoreElements([arrowElement], null);

    const restoredArrow = restoredElements[0] as ExcalidrawLinearElement;

    expect(arrowElement.endArrowhead).toBe(restoredArrow.endArrowhead);
  });

  it('should set arrow element endArrowHead as "arrow" when arrow element endArrowHead is undefined', () => {
    const arrowElement = API.createElement({ type: "arrow" });
    Object.defineProperty(arrowElement, "endArrowhead", {
      get: vi.fn(() => undefined),
    });

    const restoredElements = restore.restoreElements([arrowElement], null);

    const restoredArrow = restoredElements[0] as ExcalidrawLinearElement;

    expect(restoredArrow.endArrowhead).toBe("arrow");
  });

  it("when element.points of a line element is not an array", () => {
    const lineElement: any = API.createElement({
      type: "line",
      width: 100,
      height: 200,
    });

    lineElement.points = "not an array";

    const expectedLinePoints = [
      [0, 0],
      [lineElement.width, lineElement.height],
    ];

    const restoredLine = restore.restoreElements(
      [lineElement],
      null,
    )[0] as ExcalidrawLinearElement;

    expect(restoredLine.points).toMatchObject(expectedLinePoints);
  });

  it("should restore only valid linear points", () => {
    const lineElement: any = API.createElement({
      type: "line",
      x: 10,
      y: 20,
      width: 100,
      height: 200,
    });
    const arrowElement: any = API.createElement({
      type: "arrow",
      width: 100,
      height: 200,
    });

    lineElement.points = [
      [2, 3],
      null,
      [Infinity, 4],
      [5, 7],
      [NaN, 8],
      [9, null],
    ];
    arrowElement.points = [
      [null, 0],
      [Infinity, 4],
    ];

    const restoredElements = restore.restoreElements(
      [lineElement, arrowElement],
      null,
    );
    const restoredLine = restoredElements[0] as ExcalidrawLinearElement;
    const restoredArrow = restoredElements[1] as ExcalidrawArrowElement;

    expect(restoredLine.points).toEqual([pointFrom(0, 0), pointFrom(3, 4)]);
    expect(restoredLine.x).toBe(12);
    expect(restoredLine.y).toBe(23);
    expect(restoredLine.width).toBe(3);
    expect(restoredLine.height).toBe(4);

    expect(restoredArrow.points).toEqual([
      pointFrom(0, 0),
      pointFrom(100, 200),
    ]);
  });

  it("should mark extremely large linear elements as deleted to avoid freezing", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // a degenerate line with astronomical coordinates (see #11497)
    const hugeLine: any = API.createElement({
      type: "line",
      x: 419048829414166,
      y: 8484,
    });
    hugeLine.points = [
      [0, 0],
      [-302985021938436, 0],
      [-838097658820234, 30],
    ];

    const hugeArrow: any = API.createElement({ type: "arrow" });
    hugeArrow.points = [
      [0, 0],
      [900000, 0],
    ];

    const normalLine: any = API.createElement({ type: "line" });
    normalLine.points = [
      [0, 0],
      [100, 200],
    ];

    const [restoredLine, restoredArrow, restoredNormal] =
      restore.restoreElements([hugeLine, hugeArrow, normalLine], null);

    expect(restoredLine.isDeleted).toBe(true);
    expect(restoredLine.width).toBe(100);
    expect(restoredLine.height).toBe(100);

    expect(restoredArrow.isDeleted).toBe(true);
    expect(restoredArrow.width).toBe(100);
    expect(restoredArrow.height).toBe(100);

    expect(restoredNormal.isDeleted).toBe(false);
    expect(restoredNormal.width).toBe(100);
    expect(restoredNormal.height).toBe(200);

    consoleError.mockRestore();
  });

  it("when the number of points of a line is greater or equal 2", () => {
    const lineElement_0 = API.createElement({
      type: "line",
      width: 100,
      height: 200,
      x: 10,
      y: 20,
    });
    const lineElement_1 = API.createElement({
      type: "line",
      width: 200,
      height: 400,
      x: 30,
      y: 40,
    });

    const pointsEl_0 = [
      [0, 0],
      [1, 1],
    ];
    Object.defineProperty(lineElement_0, "points", {
      get: vi.fn(() => pointsEl_0),
    });

    const pointsEl_1 = [
      [3, 4],
      [5, 6],
    ];
    Object.defineProperty(lineElement_1, "points", {
      get: vi.fn(() => pointsEl_1),
    });

    const restoredElements = restore.restoreElements(
      [lineElement_0, lineElement_1],
      null,
    );

    const restoredLine_0 = restoredElements[0] as ExcalidrawLinearElement;
    const restoredLine_1 = restoredElements[1] as ExcalidrawLinearElement;

    expect(restoredLine_0.points).toMatchObject(pointsEl_0);

    const offsetX = pointsEl_1[0][0];
    const offsetY = pointsEl_1[0][1];
    const restoredPointsEl1 = [
      [pointsEl_1[0][0] - offsetX, pointsEl_1[0][1] - offsetY],
      [pointsEl_1[1][0] - offsetX, pointsEl_1[1][1] - offsetY],
    ];
    expect(restoredLine_1.points).toMatchObject(restoredPointsEl1);
    expect(restoredLine_1.x).toBe(lineElement_1.x + offsetX);
    expect(restoredLine_1.y).toBe(lineElement_1.y + offsetY);
  });

  it("should restore correctly with rectangle, ellipse and diamond elements", () => {
    const types = ["rectangle", "ellipse", "diamond"];

    const elements: ExcalidrawElement[] = [];
    let idCount = 0;
    types.forEach((elType) => {
      idCount += 1;
      const element = API.createElement({
        type: elType as "rectangle" | "ellipse" | "diamond" | "embeddable",
        id: idCount.toString(),
        fillStyle: "cross-hatch",
        strokeWidth: 2,
        strokeStyle: "dashed",
        roughness: 2,
        opacity: 10,
        x: 10,
        y: 20,
        strokeColor: "red",
        backgroundColor: "blue",
        width: 100,
        height: 200,
        groupIds: ["1", "2", "3"],
        roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
      });

      elements.push(element);
    });

    const restoredElements = restore.restoreElements(elements, null);

    expect(restoredElements[0]).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
    expect(restoredElements[1]).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
    expect(restoredElements[2]).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
  });

  it("bump versions of local duplicate elements when supplied", () => {
    const rectangle = API.createElement({ type: "rectangle" }); // version=1
    const ellipse = API.createElement({ type: "ellipse" });
    const rectangle_modified = newElementWith(rectangle as ExcalidrawElement, {
      isDeleted: true,
    }); // version=2

    const restoredElements = restore.bumpElementVersions(
      restore.restoreElements([rectangle, ellipse], null),
      [rectangle_modified],
    );

    expect(restoredElements[0].id).toBe(rectangle.id);
    expect(restoredElements[0].versionNonce).not.toBe(rectangle.versionNonce);
    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: rectangle.id,
        version: rectangle_modified.version + 1,
      }),
      expect.objectContaining({
        id: ellipse.id,
        version: ellipse.version + 1,
      }),
    ]);
  });

  it("bump versions of local duplicate elements when supplied even if both have same version", () => {
    const rectangle = API.createElement({ type: "rectangle" });

    const restored_rectangle_1 = restore.restoreElements([rectangle], null)[0];
    const restored_rectangle_2 = restore.restoreElements(
      [restored_rectangle_1],
      null,
    )[0];

    // restored rectangle version should be +1 because of re-index
    expect(rectangle.version).not.toBe(restored_rectangle_1.version);

    // restoring it again shouldn't re-index again
    expect(restored_rectangle_1.version).toBe(restored_rectangle_2.version);
    expect(restored_rectangle_1.versionNonce).toBe(
      restored_rectangle_2.versionNonce,
    );

    const modified_rectangle_1 = newElementWith(restored_rectangle_1, {
      width: 500,
    });
    const modified_rectangle_2 = newElementWith(restored_rectangle_2, {
      width: 600,
    });

    const restoredElements = restore.bumpElementVersions(
      restore.restoreElements([modified_rectangle_1], null),
      [modified_rectangle_2],
    );

    expect(restoredElements[0].id).toBe(rectangle.id);
    expect(restoredElements[0].id).toBe(modified_rectangle_1.id);
    expect(restoredElements[0].versionNonce).not.toBe(
      modified_rectangle_1.versionNonce,
    );
    expect(restoredElements[0].version).toBe(modified_rectangle_2.version + 1);
  });

  it("should not throw checking invisibility of a linear element without points", () => {
    const rect = API.createElement({ type: "rectangle", id: "rect" });
    const line = { type: "line", id: "line", x: 0, y: 0 } as any;

    const restoredElements = restore.restoreElements([line, rect], null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    });

    expect(
      restoredElements.map(({ id, isDeleted }) => ({ id, isDeleted })),
    ).toEqual([
      { id: "line", isDeleted: true },
      { id: "rect", isDeleted: false },
    ]);
  });

  it("should rebuild linear elements with fewer than 2 valid points from their size", () => {
    const base = { x: 0, y: 0, width: 50, height: 50 };
    const elements = [
      { ...base, type: "line", id: "line", points: [[0, 0]] },
      {
        ...base,
        type: "line",
        id: "zero-line",
        points: [[0, 0]],
        width: 0,
        height: 0,
      },
      { ...base, type: "arrow", id: "arrow", points: [[0, 0]] },
      { ...base, type: "freedraw", id: "freedraw", points: [[0, 0]] },
      { ...base, type: "line", id: "pointless-line" },
      {
        ...base,
        type: "line",
        id: "valid-line",
        points: [
          [0, 0],
          [50, 50],
        ],
      },
    ];

    const restoredElements = restore.restoreElements(elements as any[], null, {
      deleteInvisibleElements: true,
    });

    expect(
      restoredElements.map(({ id, isDeleted }) => ({ id, isDeleted })),
    ).toEqual([
      { id: "line", isDeleted: false },
      // nothing to rebuild from
      { id: "zero-line", isDeleted: true },
      { id: "arrow", isDeleted: false },
      // strokes can't be rebuilt from the size
      { id: "freedraw", isDeleted: true },
      { id: "pointless-line", isDeleted: false },
      { id: "valid-line", isDeleted: false },
    ]);
    for (const element of [
      restoredElements[0],
      restoredElements[2],
      restoredElements[4],
    ]) {
      expect((element as ExcalidrawLinearElement).points).toEqual([
        [0, 0],
        [50, 50],
      ]);
    }
  });

  it("should repair malformed boundElements entries", () => {
    const nullEntry = API.createElement({ type: "rectangle", id: "a" });
    const stringValue = API.createElement({ type: "rectangle", id: "b" });
    const mixed = API.createElement({ type: "rectangle", id: "c" });
    const label = API.createElement({
      type: "text",
      id: "label",
      containerId: "c",
    });
    (nullEntry as any).boundElements = [null];
    (stringValue as any).boundElements = "abc";
    (mixed as any).boundElements = [
      null,
      { id: 5, type: "text" },
      { type: "text", id: "label" },
    ];

    const restoredElements = restore.restoreElements(
      [nullEntry, stringValue, mixed, label],
      null,
      { repairBindings: true, deleteInvisibleElements: true },
    );

    expect(
      restoredElements.map(({ id, boundElements }) => ({ id, boundElements })),
    ).toEqual([
      { id: "a", boundElements: [] },
      { id: "b", boundElements: [] },
      { id: "c", boundElements: [{ type: "text", id: "label" }] },
      { id: "label", boundElements: [] },
    ]);
  });

  it("should keep text element if refreshing its dimensions fails", () => {
    const rect = API.createElement({ type: "rectangle", id: "rect" });
    const text = API.createElement({ type: "text", id: "text" });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const spy = vi
      .spyOn(sizeHelpers, "refreshTextDimensions")
      .mockImplementationOnce(() => {
        throw new Error("FORBIDDEN!");
      });

    try {
      expect(
        restore
          .restoreElements([rect, text], null, {
            repairBindings: true,
            refreshDimensions: true,
          })
          .map((element) => element.id),
      ).toEqual(["rect", "text"]);
      expect(consoleError).toHaveBeenCalledWith(
        "Error refreshing text dimensions:",
        expect.any(Error),
      );
    } finally {
      spy.mockRestore();
      consoleError.mockRestore();
    }
  });

  it("should restore id-less elements without resolving references to them", () => {
    const idless1 = { type: "rectangle", x: 0, y: 0, width: 10, height: 10 };
    const idless2 = { type: "rectangle", x: 0, y: 0, width: 10, height: 10 };
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
    });
    // legacy (v1) binding referencing an id that doesn't exist
    (arrow as any).startBinding = { elementId: undefined, focus: 0, gap: 0 };

    const restoredElements = restore.restoreElements(
      [idless1, idless2, arrow] as any[],
      null,
    );

    expect(restoredElements.length).toBe(3);
    expect(typeof restoredElements[0].id).toBe("string");
    expect(typeof restoredElements[1].id).toBe("string");
    expect(restoredElements[0].id).not.toBe(restoredElements[1].id);
    expect(
      (restoredElements[2] as ExcalidrawArrowElement).startBinding,
    ).toBeNull();
  });
});

describe("repairing malformed elements", () => {
  const restoreImported = (elements: unknown[]) =>
    restore.restoreElements(elements as any[], null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    });

  it("should infer a missing type from the element's properties", () => {
    const restoredElements = restoreImported([
      { id: "text", text: "hi" },
      { id: "image", fileId: "file", width: 10, height: 10 },
      {
        id: "freedraw",
        points: [
          [0, 0],
          [10, 10],
        ],
        pressures: [0.5, 0.5],
      },
      {
        id: "arrow",
        points: [
          [0, 0],
          [10, 10],
        ],
        endArrowhead: "arrow",
      },
      {
        id: "line",
        points: [
          [0, 0],
          [10, 10],
        ],
      },
      { id: "rectangle", type: null, width: 10, height: 10 },
      { id: "cased", type: " Ellipse ", width: 10, height: 10 },
    ]);

    expect(
      restoredElements.map(({ id, type, isDeleted }) => ({
        id,
        type,
        isDeleted,
      })),
    ).toEqual([
      { id: "text", type: "text", isDeleted: false },
      { id: "image", type: "image", isDeleted: false },
      { id: "freedraw", type: "freedraw", isDeleted: false },
      { id: "arrow", type: "arrow", isDeleted: false },
      { id: "line", type: "line", isDeleted: false },
      { id: "rectangle", type: "rectangle", isDeleted: false },
      { id: "cased", type: "ellipse", isDeleted: false },
    ]);
  });

  it("should drop elements of unknown type or without any hint of one", () => {
    const rect = API.createElement({ type: "rectangle", id: "rect" });

    expect(
      restoreImported([
        // may come from a newer version, so don't turn it into something else
        { id: "future", type: "hexagon", width: 10, height: 10 },
        { id: "hintless", x: 10 },
        rect,
      ]).map((element) => element.id),
    ).toEqual(["rect"]);
  });

  it("should measure text elements without a size", () => {
    const [text] = restoreImported([
      { type: "text", id: "text", text: "hi", x: 0, y: 0 },
    ]);

    expect(text.isDeleted).toBe(false);
    expect(text.width).toBeGreaterThan(0);
    expect(text.height).toBeGreaterThan(0);
  });

  it("should recover text from originalText", () => {
    const [text] = restoreImported([
      { type: "text", id: "text", text: null, originalText: "hi" },
    ]) as ExcalidrawTextElement[];

    expect(text).toEqual(
      expect.objectContaining({
        text: "hi",
        originalText: "hi",
        isDeleted: false,
      }),
    );
  });

  it("should coerce malformed values instead of dropping them", () => {
    const [rect] = restoreImported([
      {
        type: "rectangle",
        id: "rect",
        x: "10",
        y: null,
        width: "30px",
        height: 40,
        opacity: 300,
        angle: "abc",
        strokeWidth: -1,
        strokeStyle: "wavy",
        fillStyle: 5,
        strokeColor: 5,
        groupIds: [1, null, "group"],
        frameId: {},
        roundness: 3,
        isDeleted: "no",
        locked: 1,
        link: 5,
        version: -2,
        // valid, so that syncing indices doesn't bump the version
        index: "a0",
      },
    ]);

    expect(rect).toEqual(
      expect.objectContaining({
        x: 10,
        y: 0,
        width: 30,
        height: 40,
        opacity: 100,
        angle: 0,
        strokeWidth: DEFAULT_ELEMENT_PROPS.strokeWidth,
        strokeStyle: DEFAULT_ELEMENT_PROPS.strokeStyle,
        fillStyle: DEFAULT_ELEMENT_PROPS.fillStyle,
        strokeColor: DEFAULT_ELEMENT_PROPS.strokeColor,
        groupIds: ["1", "group"],
        frameId: null,
        roundness: { type: 3 },
        isDeleted: false,
        locked: false,
        link: null,
        version: 1,
      }),
    );
  });

  it("should resolve references to numeric ids", () => {
    const [container, text] = restoreImported([
      {
        type: "rectangle",
        id: 1,
        width: 100,
        height: 100,
        boundElements: [{ id: 2 }],
      },
      { type: "text", id: 2, text: "hi", containerId: 1 },
    ]) as [ExcalidrawElement, ExcalidrawTextElement];

    expect(container.id).toBe("1");
    expect(container.boundElements).toEqual([{ id: "2", type: "text" }]);
    expect(text.id).toBe("2");
    expect(text.containerId).toBe("1");
  });

  it("should drop boundElements entries without a matching type", () => {
    const [container] = restoreImported([
      {
        type: "rectangle",
        id: "container",
        width: 100,
        height: 100,
        // a wrong type (re-added from the label's containerId), a missing type,
        // a bare id, and a freedraw that can't bind
        boundElements: [
          { id: "label", type: "arrow" },
          { id: "arrow", type: "Arrow" },
          { id: "arrow2" },
          "arrow2",
          { id: "freedraw", type: "arrow" },
        ],
      },
      { type: "text", id: "label", text: "hi", containerId: "container" },
      {
        type: "arrow",
        id: "arrow",
        points: [
          [0, 0],
          [10, 10],
        ],
      },
      {
        type: "arrow",
        id: "arrow2",
        points: [
          [0, 0],
          [10, 10],
        ],
      },
      {
        type: "freedraw",
        id: "freedraw",
        points: [
          [0, 0],
          [10, 10],
        ],
      },
    ]);

    expect(container.boundElements).toEqual([
      { id: "arrow", type: "arrow" },
      { type: "text", id: "label" },
    ]);
  });

  it("should not turn free text into a label through an untyped or mistyped entry", () => {
    const restoredElements = restoreImported([
      {
        type: "rectangle",
        id: "container",
        width: 100,
        height: 100,
        boundElements: [
          "text1",
          { id: "text2" },
          { id: "text3", type: "arrow" },
        ],
      },
      { type: "text", id: "text1", text: "a", x: 200, y: 200 },
      { type: "text", id: "text2", text: "b", x: 200, y: 300 },
      { type: "text", id: "text3", text: "c", x: 200, y: 400 },
    ]);

    expect(
      restoredElements.map(({ id, boundElements }) => ({ id, boundElements })),
    ).toEqual([
      { id: "container", boundElements: [] },
      { id: "text1", boundElements: [] },
      { id: "text2", boundElements: [] },
      { id: "text3", boundElements: [] },
    ]);
    for (const text of restoredElements.slice(1)) {
      expect((text as ExcalidrawTextElement).containerId).toBe(null);
    }
  });

  it("should restore legacy boundElementIds that aren't an array", () => {
    const [container] = restoreImported([
      {
        type: "rectangle",
        id: "container",
        width: 100,
        height: 100,
        boundElementIds: "arrow",
      },
      {
        type: "arrow",
        id: "arrow",
        points: [
          [0, 0],
          [10, 10],
        ],
      },
    ]);

    expect(container.boundElements).toEqual([{ id: "arrow", type: "arrow" }]);
  });

  it("should unbind text from elements that can't contain it", () => {
    const [, text] = restoreImported([
      {
        type: "freedraw",
        id: "freedraw",
        points: [
          [0, 0],
          [10, 10],
        ],
      },
      { type: "text", id: "text", text: "hi", containerId: "freedraw" },
    ]) as [ExcalidrawElement, ExcalidrawTextElement];

    expect(text.containerId).toBe(null);
  });

  it("should remove frame membership pointing to an element that isn't a frame", () => {
    const [, rect] = restoreImported([
      { type: "ellipse", id: "ellipse", width: 10, height: 10 },
      {
        type: "rectangle",
        id: "rect",
        width: 10,
        height: 10,
        frameId: "ellipse",
      },
    ]);

    expect(rect.frameId).toBe(null);
  });

  it("should restore { x, y } and numeric string points", () => {
    const [line] = restoreImported([
      {
        type: "line",
        id: "line",
        points: [{ x: 0, y: 0 }, ["10", "20"]],
      },
    ]) as ExcalidrawLinearElement[];

    expect(line.points).toEqual([
      [0, 0],
      [10, 20],
    ]);
    expect(line.width).toBe(10);
    expect(line.height).toBe(20);
  });

  it("should rebuild a linear element from its only non-origin point", () => {
    const [line] = restoreImported([
      { type: "line", id: "line", points: [[30, 40]] },
    ]) as ExcalidrawLinearElement[];

    expect(line.isDeleted).toBe(false);
    expect(line.points).toEqual([
      [0, 0],
      [30, 40],
    ]);
  });

  it("should restore an arrow binding given as a bare element id", () => {
    const [, arrow] = restoreImported([
      { type: "rectangle", id: "rect", x: 0, y: 0, width: 100, height: 100 },
      {
        type: "arrow",
        id: "arrow",
        x: 50,
        y: 50,
        points: [
          [0, 0],
          [200, 0],
        ],
        startBinding: "rect",
        endBinding: 5,
      },
    ]) as [ExcalidrawElement, ExcalidrawArrowElement];

    expect(arrow.startBinding).toEqual(
      expect.objectContaining({ elementId: "rect" }),
    );
    expect(arrow.endBinding).toBe(null);
  });

  it("should keep pressures that don't quite match the points", () => {
    const [freedraw] = restoreImported([
      {
        type: "freedraw",
        id: "freedraw",
        points: [
          [0, 0],
          [10, 10],
          [20, 20],
        ],
        pressures: [0.2, 0.8],
        simulatePressure: false,
      },
    ]) as ExcalidrawFreeDrawElement[];

    expect(freedraw.simulatePressure).toBe(false);
    expect(freedraw.pressures).toEqual([0.2, 0.8, 0.5]);
  });

  it("should keep pressures aligned when skipping invalid points", () => {
    const [freedraw] = restoreImported([
      {
        type: "freedraw",
        id: "freedraw",
        points: [[0, 0], "invalid", [20, 20]],
        pressures: [0.2, 0.4, 0.8],
        simulatePressure: false,
      },
    ]) as ExcalidrawFreeDrawElement[];

    expect(freedraw.points).toEqual([
      [0, 0],
      [20, 20],
    ]);
    expect(freedraw.pressures).toEqual([0.2, 0.8]);
  });

  it("should simulate pressure when there are no pressures", () => {
    const [freedraw] = restoreImported([
      {
        type: "freedraw",
        id: "freedraw",
        points: [
          [0, 0],
          [10, 10],
        ],
        simulatePressure: false,
      },
    ]) as ExcalidrawFreeDrawElement[];

    expect(freedraw.simulatePressure).toBe(true);
    expect(freedraw.pressures).toEqual([]);
  });

  it("should keep pressures matching the points", () => {
    const [freedraw] = restoreImported([
      {
        type: "freedraw",
        id: "freedraw",
        points: [
          [0, 0],
          [10, 10],
        ],
        pressures: [0.2, 0.8],
      },
    ]) as ExcalidrawFreeDrawElement[];

    expect(freedraw.simulatePressure).toBe(false);
    expect(freedraw.pressures).toEqual([0.2, 0.8]);
  });

  it("should not throw on a non-string legacy font", () => {
    const [text] = restoreImported([
      { type: "text", id: "text", text: "hi", font: 5 },
    ]) as ExcalidrawTextElement[];

    expect(text.fontSize).toBe(DEFAULT_FONT_SIZE);
  });

  it("should keep text when measuring it fails", () => {
    const measureText = vi
      .spyOn(sizeHelpers, "measureText")
      .mockImplementation(() => {
        throw new Error("no canvas");
      });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const [text] = restore.restoreElements(
        [{ type: "text", id: "text", text: "hi" }] as any[],
        null,
      ) as ExcalidrawTextElement[];

      expect(text).toEqual(expect.objectContaining({ id: "text", text: "hi" }));
    } finally {
      measureText.mockRestore();
      consoleError.mockRestore();
    }
  });

  it("should restore a numeric string font family", () => {
    const [text] = restoreImported([
      { type: "text", id: "text", text: "hi", fontFamily: "3" },
    ]) as ExcalidrawTextElement[];

    expect(text.fontFamily).toBe(3);
  });

  it("should infer the type of an element with an empty type", () => {
    const [text] = restoreImported([
      { type: " ", id: "text", text: "hi" },
    ]) as ExcalidrawTextElement[];

    expect(text.type).toBe("text");
  });

  it("should never restore a version below 1", () => {
    const [rect] = restore.restoreElements(
      [
        {
          type: "rectangle",
          id: "rect",
          index: "a0",
          width: 10,
          height: 10,
          version: 0.3,
        },
      ] as any[],
      null,
    );

    expect(rect.version).toBe(1);
  });

  it("should drop out of range, duplicate and unordered fixed segments", () => {
    const [arrow] = restoreImported([
      {
        type: "arrow",
        id: "arrow",
        elbowed: true,
        points: [
          [0, 0],
          [50, 0],
          [50, 50],
          [100, 50],
          [100, 100],
        ],
        fixedSegments: [
          { start: [50, 50], end: [100, 50], index: 3 },
          { start: [50, 0], end: [50, 50], index: 2 },
          { start: [50, 0], end: [50, 50], index: 2 },
          { start: [0, 0], end: [0, 0], index: 50 },
          { start: [0, 0], end: [0, 0], index: 0 },
        ],
      },
    ]) as ExcalidrawElbowArrowElement[];

    expect(arrow.fixedSegments?.map((segment) => segment.index)).toEqual([
      2, 3,
    ]);
  });

  it("should drop untyped boundElements entries without repairing bindings", () => {
    const [container] = restore.restoreElements(
      [
        {
          type: "rectangle",
          id: "rect",
          width: 100,
          height: 100,
          boundElements: [
            { id: "label", type: "Label" },
            "arrow",
            { id: "label", type: " TEXT " },
            { id: "arrow", type: "Arrow" },
          ],
        },
        { type: "text", id: "label", text: "hi", containerId: "rect" },
        {
          type: "arrow",
          id: "arrow",
          points: [
            [0, 0],
            [10, 10],
          ],
        },
      ] as any[],
      null,
    );

    expect(container.boundElements).toEqual([
      { id: "label", type: "text" },
      { id: "arrow", type: "arrow" },
    ]);
  });

  it("should migrate legacy bindings against the restored bound element", () => {
    const restoreArrow = (rect: Record<string, unknown>) =>
      restoreImported([
        { type: "rectangle", id: "rect", ...rect },
        {
          type: "arrow",
          id: "arrow",
          x: 0,
          y: 0,
          points: [
            [0, 0],
            [110, 125],
          ],
          endBinding: { elementId: "rect", focus: 0, gap: 0 },
        },
      ])[1] as ExcalidrawArrowElement;

    const arrow = restoreArrow({
      x: "100",
      y: "100",
      width: "50",
      height: "50",
    });

    expect(arrow.endBinding).toEqual(
      restoreArrow({ x: 100, y: 100, width: 50, height: 50 }).endBinding,
    );
    expect(arrow.endBinding?.mode).toBe("inside");
  });

  it("should migrate legacy bindings of arrows with malformed geometry", () => {
    const restoreArrow = (arrow: Record<string, unknown>) =>
      restoreImported([
        { type: "rectangle", id: "rect", x: 0, y: 0, width: 100, height: 100 },
        {
          type: "arrow",
          id: "arrow",
          x: 25,
          y: 25,
          points: [
            [0, 0],
            [200, 0],
          ],
          startBinding: "rect",
          ...arrow,
        },
      ])[1] as ExcalidrawArrowElement;

    const arrow = restoreArrow({ angle: "foo" });

    expect(arrow.angle).toBe(0);
    expect(arrow.startBinding).toEqual(restoreArrow({ angle: 0 }).startBinding);
    expect(arrow.startBinding).toEqual(
      expect.objectContaining({ elementId: "rect", mode: "inside" }),
    );
    expect(arrow.startBinding?.fixedPoint[0]).toBeCloseTo(0.25);
    expect(arrow.startBinding?.fixedPoint[1]).toBeCloseTo(0.25);
  });

  it("should migrate legacy bindings against the element keeping a duplicate id", () => {
    const [first, second, arrow] = restoreImported([
      { type: "rectangle", id: "rect", x: 0, y: 0, width: 100, height: 100 },
      { type: "rectangle", id: "rect", x: 500, y: 0, width: 100, height: 100 },
      {
        type: "arrow",
        id: "arrow",
        x: 25,
        y: 25,
        points: [
          [0, 0],
          [200, 0],
        ],
        startBinding: { elementId: "rect", focus: 0, gap: 0 },
      },
    ]) as [ExcalidrawElement, ExcalidrawElement, ExcalidrawArrowElement];

    expect(first).toEqual(expect.objectContaining({ id: "rect", x: 0 }));
    expect(second.id).not.toBe("rect");
    expect(arrow.startBinding).toEqual(
      expect.objectContaining({ elementId: "rect", mode: "inside" }),
    );
    expect(arrow.startBinding?.fixedPoint[0]).toBeCloseTo(0.25);
  });

  it("should drop empty and unknown arrowheads", () => {
    const [arrow] = restoreImported([
      {
        type: "arrow",
        id: "arrow",
        points: [
          [0, 0],
          [100, 0],
        ],
        startArrowhead: "dot",
        endArrowhead: "",
      },
    ]) as ExcalidrawArrowElement[];
    const [line] = restoreImported([
      {
        type: "line",
        id: "line",
        points: [
          [0, 0],
          [100, 0],
        ],
        startArrowhead: "foo",
        endArrowhead: "bar",
      },
    ]) as ExcalidrawLinearElement[];

    expect(arrow.startArrowhead).toBe("circle");
    expect(arrow.endArrowhead).toBe(null);
    expect(line.startArrowhead).toBe(null);
    expect(line.endArrowhead).toBe("bar");
  });

  it("should wrap labels without a size to their container", () => {
    const [container, label] = restore.restoreElements(
      [
        {
          type: "rectangle",
          id: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          boundElements: [{ type: "text", id: "label" }],
        },
        {
          type: "text",
          id: "label",
          containerId: "rect",
          text: "lorem ipsum dolor sit amet consectetur adipiscing elit",
        },
      ] as any[],
      null,
      { deleteInvisibleElements: true },
    ) as [ExcalidrawElement, ExcalidrawTextElement];

    expect(label.isDeleted).toBe(false);
    expect(label.text).toContain("\n");
    expect(label.width).toBeGreaterThan(0);
    expect(label.width).toBeLessThanOrEqual(
      sizeHelpers.getBoundTextMaxWidth(container, label),
    );
    expect(label.height).toBeGreaterThan(0);
  });

  it("should fit sticky note labels without a size to their note", () => {
    const restoredElements = restoreImported([
      {
        type: "stickynote",
        id: "sticky",
        x: 0,
        y: 0,
        width: 250,
        height: 250,
        boundElements: [{ type: "text", id: "label" }],
      },
      { type: "text", id: "label", text: "hello", containerId: "sticky" },
    ]);
    const note = restoredElements.find(
      (element) => element.id === "sticky",
    ) as ExcalidrawStickyNoteElement;
    const label = restoredElements.find(
      (element) => element.id === "label",
    ) as ExcalidrawTextElement;

    expect(label.isDeleted).toBe(false);
    expect(label.width).toBeGreaterThan(0);
    expect(label.height).toBeGreaterThan(0);
    expect(label).toEqual(
      expect.objectContaining(getStickyNoteLayout(note, label).text),
    );
  });

  it("should measure text without a size whose container doesn't exist", () => {
    const [text] = restoreImported([
      {
        type: "text",
        id: "text",
        text: "abc",
        x: 10,
        y: 20,
        containerId: "missing",
      },
    ]) as ExcalidrawTextElement[];

    expect(text).toEqual(
      expect.objectContaining({
        isDeleted: false,
        containerId: null,
        x: 10,
        y: 20,
      }),
    );
    expect(text.width).toBeGreaterThan(0);
    expect(text.height).toBeGreaterThan(0);
  });

  it("should wrap labels without a size bound only from their container", () => {
    const [container, label] = restoreImported([
      {
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ type: "text", id: "label" }],
      },
      {
        type: "text",
        id: "label",
        x: 500,
        y: 500,
        text: "lorem ipsum dolor sit amet consectetur adipiscing elit",
      },
    ]) as [ExcalidrawElement, ExcalidrawTextElement];

    expect(label.containerId).toBe("rect");
    expect(label.text).toContain("\n");
    expect(label.width).toBeLessThanOrEqual(
      sizeHelpers.getBoundTextMaxWidth(container, label),
    );
    expect(label.x).toBeGreaterThanOrEqual(container.x);
    expect(label.x + label.width).toBeLessThanOrEqual(
      container.x + container.width,
    );
  });

  it("should not truncate strings that aren't numbers to their leading number", () => {
    const [rect] = restoreImported([
      {
        type: "rectangle",
        id: "rect",
        x: "12 3",
        width: 10,
        height: 10,
        created: "2024-05-01T10:00:00Z",
        updated: "2024-05-01T10:00:00Z",
      },
    ]);

    expect(rect.x).toBe(0);
    expect(rect.updated).not.toBe(2024);
    expect((rect as any).created).not.toBe(2024);
  });

  it("should not detect the line height from the height of wrapped text it doesn't have", () => {
    const [text] = restoreImported([
      {
        type: "text",
        id: "text",
        originalText: "a long sentence",
        height: 50,
        fontSize: 20,
        fontFamily: FONT_FAMILY.Virgil,
      },
    ]) as ExcalidrawTextElement[];

    expect(text.lineHeight).toBe(getLineHeight(FONT_FAMILY.Virgil));
  });

  it("should bump the version of invisible linear elements once", () => {
    const [arrow] = restoreImported([
      {
        type: "arrow",
        id: "arrow",
        index: "a0",
        version: 3,
        x: 0,
        y: 0,
        points: [],
      },
    ]);

    expect(arrow).toEqual(
      expect.objectContaining({ isDeleted: true, version: 4 }),
    );
  });

  it("should not share points with the input", () => {
    const point = [10, 10];
    const [line] = restoreImported([
      { type: "line", id: "line", points: [[0, 0], point] },
    ]) as ExcalidrawLinearElement[];

    expect(line.points[1]).toEqual(point);
    expect(line.points[1]).not.toBe(point);
  });
});

describe("restoreAppState", () => {
  it("should restore freedraw mode app state values", () => {
    expect(
      restore.restoreAppState(
        { currentItemStrokeVariability: "constant" } as any,
        null,
      ).currentItemStrokeVariability,
    ).toBe("constant");
    expect(
      restore.restoreAppState(
        { currentItemStrokeVariability: "variable" } as any,
        null,
      ).currentItemStrokeVariability,
    ).toBe("variable");
  });

  it("when appState is null it should return the local app state property", () => {
    const stubLocalAppState = getDefaultAppState();
    stubLocalAppState.cursorButton = "down";
    stubLocalAppState.name = "local app state";

    const restoredAppState = restore.restoreAppState(null, stubLocalAppState);
    expect(restoredAppState.cursorButton).toBe(stubLocalAppState.cursorButton);
    expect(restoredAppState.name).toBe(stubLocalAppState.name);
  });

  it("when local appState is null but imported app state is supplied", () => {
    const stubImportedAppState = getDefaultAppState();
    stubImportedAppState.cursorButton = "down";
    stubImportedAppState.name = "imported app state";

    const importedDataState = {} as ImportedDataState;
    importedDataState.appState = stubImportedAppState;

    const restoredAppState = restore.restoreAppState(
      importedDataState.appState,
      null,
    );
    expect(restoredAppState.cursorButton).toBe("up");
    expect(restoredAppState.name).toBe(stubImportedAppState.name);
  });

  it("should restore with imported data", () => {
    const stubImportedAppState = getDefaultAppState();
    stubImportedAppState.activeTool.type = "selection";
    stubImportedAppState.cursorButton = "down";
    stubImportedAppState.name = "imported app state";

    const stubLocalAppState = getDefaultAppState();
    stubLocalAppState.activeTool.type = "rectangle";
    stubLocalAppState.cursorButton = "up";
    stubLocalAppState.name = "local app state";

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );
    expect(restoredAppState.activeTool).toEqual(
      stubImportedAppState.activeTool,
    );
    expect(restoredAppState.cursorButton).toBe("up");
    expect(restoredAppState.name).toBe(stubImportedAppState.name);
  });

  it("should migrate legacy current item stroke width to stroke width key", () => {
    const stubImportedAppState = {
      ...getDefaultAppState(),
      currentItemStrokeWidth: 4,
      currentItemStrokeWidthKey: undefined,
    } as any;

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      null,
    );

    expect(restoredAppState.currentItemStrokeWidthKey).toBe("bold");
  });

  it("should restore transparent current sticky note stroke as black", () => {
    const restoredAppState = restore.restoreAppState(
      {
        currentItemStickynoteStrokeColor: COLOR_PALETTE.transparent,
      } as any,
      null,
    );

    expect(restoredAppState.currentItemStickynoteStrokeColor).toBe(
      COLOR_PALETTE.black,
    );
  });

  it("should restore with current app state when imported data state is undefined", () => {
    const stubImportedAppState = {
      ...getDefaultAppState(),
      cursorButton: undefined,
      name: undefined,
    };

    const stubLocalAppState = getDefaultAppState();
    stubLocalAppState.cursorButton = "down";
    stubLocalAppState.name = "local app state";

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );
    expect(restoredAppState.cursorButton).toBe(stubLocalAppState.cursorButton);
    expect(restoredAppState.name).toBe(stubLocalAppState.name);
  });

  it("should return imported data when local app state is null", () => {
    const stubImportedAppState = getDefaultAppState();
    stubImportedAppState.cursorButton = "down";
    stubImportedAppState.name = "imported app state";

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      null,
    );
    expect(restoredAppState.cursorButton).toBe("up");
    expect(restoredAppState.name).toBe(stubImportedAppState.name);
  });

  it("should return local app state when imported data state is null", () => {
    const stubLocalAppState = getDefaultAppState();
    stubLocalAppState.cursorButton = "down";
    stubLocalAppState.name = "local app state";

    const restoredAppState = restore.restoreAppState(null, stubLocalAppState);
    expect(restoredAppState.cursorButton).toBe(stubLocalAppState.cursorButton);
    expect(restoredAppState.name).toBe(stubLocalAppState.name);
  });

  it("should return default app state when imported data state and local app state are undefined", () => {
    const stubImportedAppState = {
      ...getDefaultAppState(),
      cursorButton: undefined,
    };

    const stubLocalAppState = {
      ...getDefaultAppState(),
      cursorButton: undefined,
    };

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );
    expect(restoredAppState.cursorButton).toBe(
      getDefaultAppState().cursorButton,
    );
  });

  it("should return default app state when imported data state and local app state are null", () => {
    const restoredAppState = restore.restoreAppState(null, null);
    expect(restoredAppState.cursorButton).toBe(
      getDefaultAppState().cursorButton,
    );
  });

  it("when imported data state has a not allowed Excalidraw Element Types", () => {
    const stubImportedAppState: any = getDefaultAppState();

    stubImportedAppState.activeTool = "not allowed Excalidraw Element Types";
    const stubLocalAppState = getDefaultAppState();

    const restoredAppState = restore.restoreAppState(
      stubImportedAppState,
      stubLocalAppState,
    );
    expect(restoredAppState.activeTool.type).toBe("selection");
  });

  describe("with zoom in imported data state", () => {
    it("when imported data state has zoom as a number", () => {
      const stubImportedAppState: any = getDefaultAppState();

      stubImportedAppState.zoom = 10;

      const stubLocalAppState = getDefaultAppState();

      const restoredAppState = restore.restoreAppState(
        stubImportedAppState,
        stubLocalAppState,
      );

      expect(restoredAppState.zoom.value).toBe(10);
    });

    it("when the zoom of imported data state is not a number", () => {
      const stubImportedAppState = getDefaultAppState();
      stubImportedAppState.zoom = {
        value: 10 as NormalizedZoomValue,
      };

      const stubLocalAppState = getDefaultAppState();

      const restoredAppState = restore.restoreAppState(
        stubImportedAppState,
        stubLocalAppState,
      );

      expect(restoredAppState.zoom.value).toBe(10);
      expect(restoredAppState.zoom).toMatchObject(stubImportedAppState.zoom);
    });

    it("when the zoom of imported data state zoom is null", () => {
      const stubImportedAppState = getDefaultAppState();

      Object.defineProperty(stubImportedAppState, "zoom", {
        get: vi.fn(() => null),
      });

      const stubLocalAppState = getDefaultAppState();

      const restoredAppState = restore.restoreAppState(
        stubImportedAppState,
        stubLocalAppState,
      );

      expect(restoredAppState.zoom).toMatchObject(getDefaultAppState().zoom);
    });
  });

  it("should handle appState.openSidebar legacy values", () => {
    expect(restore.restoreAppState({}, null).openSidebar).toBe(null);
    expect(
      restore.restoreAppState({ openSidebar: "library" } as any, null)
        .openSidebar,
    ).toEqual({ name: DEFAULT_SIDEBAR.name });
    expect(
      restore.restoreAppState({ openSidebar: "xxx" } as any, null).openSidebar,
    ).toEqual({ name: DEFAULT_SIDEBAR.name });
    // while "library" was our legacy sidebar name, we can't assume it's legacy
    // value as it may be some host app's custom sidebar name ¯\_(ツ)_/¯
    expect(
      restore.restoreAppState({ openSidebar: { name: "library" } } as any, null)
        .openSidebar,
    ).toEqual({ name: "library" });
    expect(
      restore.restoreAppState(
        { openSidebar: { name: DEFAULT_SIDEBAR.name, tab: "ola" } } as any,
        null,
      ).openSidebar,
    ).toEqual({ name: DEFAULT_SIDEBAR.name, tab: "ola" });
  });
});

describe("restoreLibraryItems", () => {
  const rect = (id: string) => API.createElement({ type: "rectangle", id });

  it("should skip null and primitive items", () => {
    const restoredItems = restore.restoreLibraryItems(
      [
        null,
        undefined,
        0,
        "item",
        true,
        // v1
        [rect("A")],
        // v2
        { id: "item", status: "published", created: 1, elements: [rect("B")] },
      ] as any,
      "unpublished",
    );

    expect(restoredItems).toEqual([
      {
        id: expect.any(String),
        status: "unpublished",
        created: expect.any(Number),
        elements: [expect.objectContaining({ id: "A" })],
      },
      {
        id: "item",
        status: "published",
        created: 1,
        elements: [expect.objectContaining({ id: "B" })],
      },
    ]);
  });

  it("should skip v2 items with malformed elements", () => {
    const restoredItems = restore.restoreLibraryItems(
      [
        { id: "missing" },
        { id: "null", elements: null },
        { id: "string", elements: "abc" },
        { id: "object", elements: { 0: rect("X"), length: 1 } },
        { id: "malformed", elements: [null, 1, "abc", {}] },
        { id: "mixed", elements: [null, rect("A")] },
      ] as any,
      "unpublished",
    );

    expect(restoredItems).toEqual([
      expect.objectContaining({
        id: "mixed",
        elements: [expect.objectContaining({ id: "A" })],
      }),
    ]);
  });

  it("should skip a non-array library", () => {
    expect(
      restore.restoreLibraryItems({ 0: [rect("A")] } as any, "unpublished"),
    ).toEqual([]);
  });
});

describe("repairing bindings", () => {
  it.each(["arrow", "rectangle"] as const)(
    "should repair bound %s label order and fractional index",
    (containerType) => {
      const container = API.createElement({
        type: containerType,
        id: "container",
        index: "b2f" as ExcalidrawElement["index"],
        boundElements: [{ type: "text", id: "label" }],
      });
      const label = API.createElement({
        type: "text",
        id: "label",
        index: "b2a" as ExcalidrawElement["index"],
        containerId: container.id,
      });

      const restoredElements = restore.restoreElements(
        [label, container],
        null,
        {
          repairBindings: true,
        },
      );

      expect(restoredElements.map((element) => element.id)).toEqual([
        container.id,
        label.id,
      ]);
      expect(restoredElements[0].index).toBe(container.index);
      expect(restoredElements[1].index! > restoredElements[0].index!).toBe(
        true,
      );
    },
  );

  it("should strip arrow binding if repair throws", () => {
    const container = API.createElement({
      type: "rectangle",
      boundElements: [],
    });
    const arrowElement = API.createElement({
      type: "arrow",
      id: "id-arrow01",
      endBinding: {
        elementId: container.id,
        fixedPoint: [0.5, 0.5],
        mode: "inside",
      },
    });

    Object.assign(container, {
      boundElements: [{ type: "arrow", id: arrowElement.id }],
    });
    // make invalid binding -> throws during repair
    Object.assign(arrowElement, {
      endBinding: {
        // invalid reference
        elementId: 42,
      },
    });

    const restoredElements = restore.restoreElements(
      [arrowElement, container],
      null,
    );

    expect(restoredElements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: arrowElement.id,
          endBinding: null,
        }),
        expect.objectContaining({
          id: container.id,
        }),
      ]),
    );

    const restoredArrow = restoredElements[0] as ExcalidrawLinearElement;

    expect(restoredArrow).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
      // endBinding: expect.any(Object),
    });
  });

  it("should repair container boundElements when repair is true", () => {
    const container = API.createElement({
      type: "rectangle",
      boundElements: [],
    });
    const boundElement = API.createElement({
      type: "text",
      containerId: container.id,
    });

    expect(container.boundElements).toEqual([]);

    let restoredElements = restore.restoreElements(
      [container, boundElement],
      null,
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);

    restoredElements = restore.restoreElements(
      [container, boundElement],
      null,
      { repairBindings: true },
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [{ type: boundElement.type, id: boundElement.id }],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);
  });

  it("should repair containerId of boundElements when repair is true", () => {
    const boundElement = API.createElement({
      type: "text",
      containerId: null,
    });
    const container = API.createElement({
      type: "rectangle",
      boundElements: [{ type: boundElement.type, id: boundElement.id }],
    });

    let restoredElements = restore.restoreElements(
      [container, boundElement],
      null,
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [{ type: boundElement.type, id: boundElement.id }],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: null,
      }),
    ]);

    restoredElements = restore.restoreElements(
      [container, boundElement],
      null,
      { repairBindings: true },
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [{ type: boundElement.type, id: boundElement.id }],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);
  });

  it("should ignore bound element if deleted", () => {
    const container = API.createElement({
      type: "rectangle",
      boundElements: [],
    });
    const boundElement = API.createElement({
      type: "text",
      containerId: container.id,
      isDeleted: true,
    });

    expect(container.boundElements).toEqual([]);

    const restoredElements = restore.restoreElements(
      [container, boundElement],
      null,
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [],
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);
  });

  it("should remove bindings of deleted elements from boundElements when repair is true", () => {
    const container = API.createElement({
      type: "rectangle",
      boundElements: [],
    });
    const boundElement = API.createElement({
      type: "text",
      containerId: container.id,
      isDeleted: true,
    });
    const invisibleBoundElement = API.createElement({
      type: "text",
      containerId: container.id,
      width: 0,
      height: 0,
    });
    // a label with text gets measured, so it's only invisible when empty
    Object.assign(invisibleBoundElement, { text: "", originalText: "" });

    const obsoleteBinding = { type: boundElement.type, id: boundElement.id };
    const invisibleBinding = {
      type: invisibleBoundElement.type,
      id: invisibleBoundElement.id,
    };
    expect(container.boundElements).toEqual([]);

    const nonExistentBinding = { type: "text", id: "non-existent" };
    // @ts-ignore
    container.boundElements = [
      obsoleteBinding,
      invisibleBinding,
      nonExistentBinding,
    ];

    let restoredElements = restore.restoreElements(
      [container, invisibleBoundElement, boundElement],
      null,
      { deleteInvisibleElements: true },
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [obsoleteBinding, invisibleBinding, nonExistentBinding],
      }),
      expect.objectContaining({
        id: invisibleBoundElement.id,
        containerId: container.id,
        isDeleted: true,
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);

    restoredElements = restore.restoreElements(
      [container, invisibleBoundElement, boundElement],
      null,
      { repairBindings: true, deleteInvisibleElements: true },
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: container.id,
        boundElements: [],
      }),
      expect.objectContaining({
        id: invisibleBoundElement.id,
        containerId: container.id,
        isDeleted: true,
      }),
      expect.objectContaining({
        id: boundElement.id,
        containerId: container.id,
      }),
    ]);
  });

  it("should remove containerId if container not exists when repair is true", () => {
    const boundElement = API.createElement({
      type: "text",
      containerId: "non-existent",
    });
    const boundElementDeleted = API.createElement({
      type: "text",
      containerId: "non-existent",
      isDeleted: true,
    });

    let restoredElements = restore.restoreElements(
      [boundElement, boundElementDeleted],
      null,
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: boundElement.id,
        containerId: "non-existent",
      }),
      expect.objectContaining({
        id: boundElementDeleted.id,
        containerId: "non-existent",
      }),
    ]);

    restoredElements = restore.restoreElements(
      [boundElement, boundElementDeleted],
      null,
      { repairBindings: true },
    );

    expect(restoredElements).toEqual([
      expect.objectContaining({
        id: boundElement.id,
        containerId: null,
      }),
      expect.objectContaining({
        id: boundElementDeleted.id,
        containerId: null,
      }),
    ]);
  });
});

describe("restoreLibraryItems creation timestamps", () => {
  it.each([1, 2])(
    "accepts v%s input with missing creation metadata",
    (version) => {
      const { created, ...legacyElement } = API.createElement({
        type: "rectangle",
      });
      // models library data persisted before `created` existed; the declared
      // input type is a complete element, restore fills the field at runtime
      const elements = [
        legacyElement,
        API.createElement({ type: "rectangle", created: 123 }),
        API.createElement({ type: "rectangle", created: null }),
      ] as unknown as LibraryItem["elements"];
      const legacyItem: LibraryItem_v1 = elements;
      const currentItem: LibraryItem = {
        id: "library-item",
        status: "unpublished",
        created: 456,
        elements,
      };
      const imported: ImportedDataState = {
        libraryItems: version === 1 ? [legacyItem] : [currentItem],
      };

      const restoredItems: LibraryItems = restore.restoreLibraryItems(
        imported.libraryItems,
        "unpublished",
      );

      expect(restoredItems).toHaveLength(1);
      expect(
        restoredItems[0].elements.map((element) => element.created),
      ).toEqual([null, 123, null]);
      expect(restoredItems[0].elements.map((element) => element.id)).toEqual(
        elements.map((element) => element.id),
      );
      expect(legacyElement).not.toHaveProperty("created");
      if (version === 2) {
        expect(restoredItems[0].created).toBe(456);
      }
    },
  );
});
