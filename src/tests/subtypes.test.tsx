import { vi } from "vitest";
import {
  SubtypeLoadedCb,
  SubtypeRecord,
  SubtypeMethods,
  SubtypePrepFn,
  addSubtypeMethods,
  ensureSubtypesLoadedForElements,
  getSubtypeMethods,
  getSubtypeNames,
} from "../element/subtypes";

import { render } from "./test-utils";
import { API } from "./helpers/api";
import { Excalidraw, FONT_FAMILY } from "../packages/excalidraw/index";

import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  FontString,
} from "../element/types";
import { getFontString } from "../utils";
import * as textElementUtils from "../element/textElement";
import { isTextElement } from "../element";
import { mutateElement, newElementWith } from "../element/mutateElement";

const MW = 200;
const TWIDTH = 200;
const THEIGHT = 20;
const TBASELINE = 0;
const FONTSIZE = 20;
const DBFONTSIZE = 40;
const TRFONTSIZE = 60;

const test2: SubtypeRecord = {
  subtype: "test2",
  parents: ["text"],
};

const test3: SubtypeRecord = {
  subtype: "test3",
  parents: ["text", "line"],
};

const prepareNullSubtype = function () {
  const methods = {} as SubtypeMethods;
  methods.clean = cleanTest2ElementUpdate;
  methods.measureText = measureTest2;
  methods.wrapText = wrapTest2;

  return { methods };
} as SubtypePrepFn;

const cleanTest2ElementUpdate = function (updates) {
  const oldUpdates = {};
  for (const key in updates) {
    if (key !== "fontFamily") {
      (oldUpdates as any)[key] = (updates as any)[key];
    }
  }
  (updates as any).fontFamily = FONT_FAMILY.Cascadia;
  return oldUpdates;
} as SubtypeMethods["clean"];

let test2Loaded = false;

const ensureLoadedTest2: SubtypeMethods["ensureLoaded"] = async (callback) => {
  test2Loaded = true;
  if (onTest2Loaded) {
    onTest2Loaded((el) => isTextElement(el) && el.subtype === test2.subtype);
  }
  if (callback) {
    callback();
  }
};

const measureTest2: SubtypeMethods["measureText"] = function (element, next) {
  const text = next?.text ?? element.text;
  const customData = next?.customData ?? {};
  const fontSize = customData.triple
    ? TRFONTSIZE
    : next?.fontSize ?? element.fontSize;
  const fontFamily = element.fontFamily;
  const fontString = getFontString({ fontSize, fontFamily });
  const lineHeight = element.lineHeight;
  const metrics = textElementUtils.measureText(text, fontString, lineHeight);
  const width = test2Loaded
    ? metrics.width * 2
    : Math.max(metrics.width - 10, 0);
  const height = test2Loaded
    ? metrics.height * 2
    : Math.max(metrics.height - 5, 0);
  return { width, height, baseline: 1 };
};

const wrapTest2: SubtypeMethods["wrapText"] = function (
  element,
  maxWidth,
  next,
) {
  const text = next?.text ?? element.originalText;
  if (next?.customData && next?.customData.triple === true) {
    return `${text.split(" ").join("\n")}\nHELLO WORLD.`;
  }
  if (next?.fontSize === DBFONTSIZE) {
    return `${text.split(" ").join("\n")}\nHELLO World.`;
  }
  return `${text.split(" ").join("\n")}\nHello world.`;
};

let onTest2Loaded: SubtypeLoadedCb | undefined;

const prepareTest2Subtype = function (onSubtypeLoaded) {
  const methods = {
    clean: cleanTest2ElementUpdate,
    ensureLoaded: ensureLoadedTest2,
    measureText: measureTest2,
    wrapText: wrapTest2,
  } as SubtypeMethods;

  onTest2Loaded = onSubtypeLoaded;

  return { methods };
} as SubtypePrepFn;

const prepareTest3Subtype = function () {
  const methods = {} as SubtypeMethods;

  return { methods };
} as SubtypePrepFn;

const { h } = window;

describe("subtype registration", () => {
  it("should check for invalid subtype or parents", async () => {
    await render(<Excalidraw />, {});
    // Define invalid subtype records
    const null1 = {} as SubtypeRecord;
    const null2 = { subtype: "" } as SubtypeRecord;
    const null3 = { subtype: "null" } as SubtypeRecord;
    const null4 = { subtype: "null", parents: [] } as SubtypeRecord;
    // Try registering the invalid subtypes
    const prepN1 = API.addSubtype(null1, prepareNullSubtype);
    const prepN2 = API.addSubtype(null2, prepareNullSubtype);
    const prepN3 = API.addSubtype(null3, prepareNullSubtype);
    const prepN4 = API.addSubtype(null4, prepareNullSubtype);
    // Verify the guards in `prepareSubtype` worked
    expect(prepN1).toStrictEqual({ methods: {} });
    expect(prepN2).toStrictEqual({ methods: {} });
    expect(prepN3).toStrictEqual({ methods: {} });
    expect(prepN4).toStrictEqual({ methods: {} });
  });
  it("should return subtype methods correctly", async () => {
    // Check initial registration works
    let prep2 = API.addSubtype(test2, prepareTest2Subtype);
    expect(prep2.methods).toStrictEqual({
      clean: cleanTest2ElementUpdate,
      ensureLoaded: ensureLoadedTest2,
      measureText: measureTest2,
      wrapText: wrapTest2,
    });
    // Check repeat registration fails
    prep2 = API.addSubtype(test2, prepareNullSubtype);
    expect(prep2.methods).toStrictEqual({
      clean: cleanTest2ElementUpdate,
      ensureLoaded: ensureLoadedTest2,
      measureText: measureTest2,
      wrapText: wrapTest2,
    });

    // Check initial registration works
    let prep3 = API.addSubtype(test3, prepareTest3Subtype);
    expect(prep3.methods).toStrictEqual({});
    // Check repeat registration fails
    prep3 = API.addSubtype(test3, prepareNullSubtype);
    expect(prep3.methods).toStrictEqual({});
  });
});

describe("subtypes", () => {
  it("should correctly register", async () => {
    const subtypes = getSubtypeNames();
    expect(subtypes).toContain(test2.subtype);
    expect(subtypes).toContain(test3.subtype);
  });
  it("should return subtype methods", async () => {
    expect(getSubtypeMethods(undefined)).toBeUndefined();
    const test2Methods = getSubtypeMethods(test2.subtype);
    expect(test2Methods?.clean).toStrictEqual(cleanTest2ElementUpdate);
    expect(test2Methods?.ensureLoaded).toStrictEqual(ensureLoadedTest2);
    expect(test2Methods?.measureText).toStrictEqual(measureTest2);
    expect(test2Methods?.render).toBeUndefined();
    expect(test2Methods?.renderSvg).toBeUndefined();
    expect(test2Methods?.wrapText).toStrictEqual(wrapTest2);
  });
  it("should not overwrite subtype methods", async () => {
    addSubtypeMethods(test2.subtype, {});
    addSubtypeMethods(test3.subtype, { clean: cleanTest2ElementUpdate });
    const test2Methods = getSubtypeMethods(test2.subtype);
    expect(test2Methods?.measureText).toStrictEqual(measureTest2);
    expect(test2Methods?.wrapText).toStrictEqual(wrapTest2);
    const test3Methods = getSubtypeMethods(test3.subtype);
    expect(test3Methods?.clean).toBeUndefined();
  });
  it("should apply to ExcalidrawElements", async () => {
    const elements = [
      API.createElement({ type: "text", id: "A", subtype: test3.subtype }),
      API.createElement({ type: "line", id: "B", subtype: test3.subtype }),
    ];
    await render(<Excalidraw />, { localStorageData: { elements } });
    elements.forEach((el) => expect(el.subtype).toBe(test3.subtype));
  });
  it("should enforce prop value restrictions", async () => {
    const elements = [
      API.createElement({
        type: "text",
        id: "A",
        subtype: test2.subtype,
        fontFamily: FONT_FAMILY.Virgil,
      }),
      API.createElement({
        type: "text",
        id: "B",
        fontFamily: FONT_FAMILY.Virgil,
      }),
    ];
    await render(<Excalidraw />, { localStorageData: { elements } });
    elements.forEach((el) => {
      if (el.subtype === test2.subtype) {
        expect(el.fontFamily).toBe(FONT_FAMILY.Cascadia);
      } else {
        expect(el.fontFamily).toBe(FONT_FAMILY.Virgil);
      }
    });
  });
  it("should consider enforced prop values in version increments", async () => {
    const rectA = API.createElement({
      type: "text",
      id: "A",
      subtype: test2.subtype,
      fontFamily: FONT_FAMILY.Virgil,
      fontSize: 10,
    });
    const rectB = API.createElement({
      type: "text",
      id: "B",
      subtype: test2.subtype,
      fontFamily: FONT_FAMILY.Virgil,
      fontSize: 10,
    });
    // Initial element creation checks
    expect(rectA.fontFamily).toBe(FONT_FAMILY.Cascadia);
    expect(rectB.fontFamily).toBe(FONT_FAMILY.Cascadia);
    expect(rectA.version).toBe(1);
    expect(rectB.version).toBe(1);
    // Check that attempting to set prop values not permitted by the subtype
    // doesn't increment element versions
    mutateElement(rectA, { fontFamily: FONT_FAMILY.Helvetica });
    mutateElement(rectB, { fontFamily: FONT_FAMILY.Helvetica, fontSize: 20 });
    expect(rectA.version).toBe(1);
    expect(rectB.version).toBe(2);
    // Check that element versions don't increment when creating new elements
    // while attempting to use prop values not permitted by the subtype
    // First check based on `rectA` (unsuccessfully mutated)
    const rectC = newElementWith(rectA, { fontFamily: FONT_FAMILY.Virgil });
    const rectD = newElementWith(rectA, {
      fontFamily: FONT_FAMILY.Virgil,
      fontSize: 15,
    });
    expect(rectC.version).toBe(1);
    expect(rectD.version).toBe(2);
    // Then check based on `rectB` (successfully mutated)
    const rectE = newElementWith(rectB, { fontFamily: FONT_FAMILY.Virgil });
    const rectF = newElementWith(rectB, {
      fontFamily: FONT_FAMILY.Virgil,
      fontSize: 15,
    });
    expect(rectE.version).toBe(2);
    expect(rectF.version).toBe(3);
  });
  it("should call custom text methods", async () => {
    const testString = "A quick brown fox jumps over the lazy dog.";
    const elements = [
      API.createElement({
        type: "text",
        id: "A",
        subtype: test2.subtype,
        text: testString,
        fontSize: FONTSIZE,
      }),
    ];
    await render(<Excalidraw />, { localStorageData: { elements } });
    const mockMeasureText = (text: string, font: FontString) => {
      if (text === testString) {
        let multiplier = 1;
        if (font.includes(`${DBFONTSIZE}`)) {
          multiplier = 2;
        }
        if (font.includes(`${TRFONTSIZE}`)) {
          multiplier = 3;
        }
        const width = multiplier * TWIDTH;
        const height = multiplier * THEIGHT;
        const baseline = multiplier * TBASELINE;
        return { width, height, baseline };
      }
      return { width: 1, height: 0, baseline: 0 };
    };

    vi.spyOn(textElementUtils, "measureText").mockImplementation(
      mockMeasureText,
    );

    elements.forEach((el) => {
      if (isTextElement(el)) {
        // First test with `ExcalidrawTextElement.text`
        const metrics = textElementUtils.measureTextElement(el);
        expect(metrics).toStrictEqual({
          width: TWIDTH - 10,
          height: THEIGHT - 5,
          baseline: TBASELINE + 1,
        });
        const wrappedText = textElementUtils.wrapTextElement(el, MW);
        expect(wrappedText).toEqual(
          `${testString.split(" ").join("\n")}\nHello world.`,
        );

        // Now test with modified text in `next`
        let next: {
          text?: string;
          fontSize?: number;
          customData?: Record<string, any>;
        } = {
          text: "Hello world.",
        };
        const nextMetrics = textElementUtils.measureTextElement(el, next);
        expect(nextMetrics).toStrictEqual({ width: 0, height: 0, baseline: 1 });
        const nextWrappedText = textElementUtils.wrapTextElement(el, MW, next);
        expect(nextWrappedText).toEqual("Hello\nworld.\nHello world.");

        // Now test modified fontSizes in `next`
        next = { fontSize: DBFONTSIZE };
        const nextFM = textElementUtils.measureTextElement(el, next);
        expect(nextFM).toStrictEqual({
          width: 2 * TWIDTH - 10,
          height: 2 * THEIGHT - 5,
          baseline: 2 * TBASELINE + 1,
        });
        const nextFWrText = textElementUtils.wrapTextElement(el, MW, next);
        expect(nextFWrText).toEqual(
          `${testString.split(" ").join("\n")}\nHELLO World.`,
        );

        // Now test customData in `next`
        next = { customData: { triple: true } };
        const nextCD = textElementUtils.measureTextElement(el, next);
        expect(nextCD).toStrictEqual({
          width: 3 * TWIDTH - 10,
          height: 3 * THEIGHT - 5,
          baseline: 3 * TBASELINE + 1,
        });
        const nextCDWrText = textElementUtils.wrapTextElement(el, MW, next);
        expect(nextCDWrText).toEqual(
          `${testString.split(" ").join("\n")}\nHELLO WORLD.`,
        );
      }
    });
  });
});
describe("subtype loading", () => {
  let elements: ExcalidrawElement[];
  beforeEach(async () => {
    const testString = "A quick brown fox jumps over the lazy dog.";
    elements = [
      API.createElement({
        type: "text",
        id: "A",
        subtype: test2.subtype,
        text: testString,
      }),
    ];
    await render(<Excalidraw />, { localStorageData: { elements } });
    h.elements = elements;
  });
  it("should redraw text bounding boxes", async () => {
    h.setState({ selectedElementIds: { A: true } });
    const el = h.elements[0] as ExcalidrawTextElement;
    expect(el.width).toEqual(100);
    expect(el.height).toEqual(100);
    ensureSubtypesLoadedForElements(elements);
    expect(el.width).toEqual(TWIDTH * 2);
    expect(el.height).toEqual(THEIGHT * 2);
    expect(el.baseline).toEqual(TBASELINE + 1);
  });
});
