import { vi } from "vitest";
import fallbackLangData from "./helpers/locales/en.json";
import type {
  SubtypeLoadedCb,
  SubtypeRecord,
  SubtypeMethods,
  SubtypePrepFn,
} from "../element/subtypes";
import {
  addSubtypeMethods,
  ensureSubtypesLoadedForElements,
  getSubtypeMethods,
  getSubtypeNames,
  hasAlwaysEnabledActions,
  isValidSubtype,
  selectSubtype,
  subtypeCollides,
} from "../element/subtypes";

import { render } from "./test-utils";
import { API } from "./helpers/api";
import { Excalidraw } from "../index";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  FontString,
  Theme,
} from "../element/types";
import { createIcon, iconFillColor } from "../components/icons";
import { SubtypeButton } from "../components/Subtypes";
import type { LangLdr } from "../i18n";
import { registerCustomLangData, t } from "../i18n";
import { getFontString, getShortcutKey } from "../utils";
import * as textElementUtils from "../element/textElement";
import { isTextElement } from "../element";
import { mutateElement, newElementWith } from "../element/mutateElement";
import type { Action, ActionName } from "../actions/types";
import { makeCustomActionName } from "../actions/types";
import type { AppState } from "../types";
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { actionChangeSloppiness } from "../actions";
import { actionChangeRoundness } from "../actions/actionProperties";

const MW = 200;
const TWIDTH = 200;
const THEIGHT = 20;
const FONTSIZE = 20;
const DBFONTSIZE = 40;
const TRFONTSIZE = 60;

const getLangData: LangLdr = (langCode) =>
  import(`./helpers/locales/${langCode}.json`);

const testSubtypeIcon = ({ theme }: { theme: Theme }) =>
  createIcon(
    <path
      stroke={iconFillColor(theme)}
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
    />,
    { width: 40, height: 20, mirror: true },
  );

const TEST_ACTION = "testAction";
const TEST_DISABLE1 = actionChangeSloppiness;
const TEST_DISABLE3 = actionChangeRoundness;

const test1: SubtypeRecord = {
  subtype: "test",
  parents: ["line", "arrow", "rectangle", "diamond", "ellipse"],
  disabledNames: [TEST_DISABLE1.name as ActionName],
  actionNames: [TEST_ACTION],
};
const test1NonParent = "text" as const;

const test2: SubtypeRecord = {
  subtype: "test2",
  parents: ["text"],
};

const test3: SubtypeRecord = {
  subtype: "test3",
  parents: ["text", "line"],
  shortcutMap: {
    testShortcut: [getShortcutKey("Shift+T")],
  },
  alwaysEnabledNames: ["test3Always"],
  disabledNames: [TEST_DISABLE3.name as ActionName],
};

let testActions: Action[] | null = null;

const makeTestActions = () => {
  if (testActions) {
    return testActions;
  }
  const testAction: Action = {
    name: makeCustomActionName(TEST_ACTION),
    label: t("toolBar.test"),
    trackEvent: false,
    perform: (elements, appState) => {
      return {
        elements,
        storeAction: "none",
      };
    },
  };

  testActions = [
    testAction,
    SubtypeButton(test1.subtype, test1.parents[0], testSubtypeIcon),
    SubtypeButton(test2.subtype, test2.parents[0], testSubtypeIcon),
    SubtypeButton(test3.subtype, test3.parents[0], testSubtypeIcon),
  ];
  return testActions;
};

const cleanTestElementUpdate = function (updates) {
  const oldUpdates = {};
  for (const key in updates) {
    if (key !== "roughness") {
      (oldUpdates as any)[key] = (updates as any)[key];
    }
  }
  (updates as any).roughness = 0;
  return oldUpdates;
} as SubtypeMethods["clean"];

const prepareNullSubtype = function () {
  const methods = {} as SubtypeMethods;
  methods.clean = cleanTestElementUpdate;
  methods.measureText = measureTest2;
  methods.wrapText = wrapTest2;

  const actions = makeTestActions().filter((_, index) => index > 0);
  return { actions, methods };
} as SubtypePrepFn;

const prepareTest1Subtype = function (
  addSubtypeAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {} as SubtypeMethods;
  methods.clean = cleanTestElementUpdate;

  addLangData(fallbackLangData, getLangData);
  registerCustomLangData(fallbackLangData, getLangData);

  const actions = makeTestActions().filter((_, index) => index < 2);
  actions.forEach((action) => addSubtypeAction(action));

  return { actions, methods };
} as SubtypePrepFn;

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
  return { width, height };
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

const prepareTest2Subtype = function (
  addSubtypeAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {
    ensureLoaded: ensureLoadedTest2,
    measureText: measureTest2,
    wrapText: wrapTest2,
  } as SubtypeMethods;

  addLangData(fallbackLangData, getLangData);
  registerCustomLangData(fallbackLangData, getLangData);

  const actions = [makeTestActions()[2]];
  actions.forEach((action) => addSubtypeAction(action));

  onTest2Loaded = onSubtypeLoaded;

  return { actions, methods };
} as SubtypePrepFn;

const prepareTest3Subtype = function (
  addSubtypeAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {} as SubtypeMethods;

  addLangData(fallbackLangData, getLangData);
  registerCustomLangData(fallbackLangData, getLangData);

  const actions = [makeTestActions()[3]];
  actions.forEach((action) => addSubtypeAction(action));

  return { actions, methods };
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
    expect(prepN1).toStrictEqual({ actions: null, methods: {} });
    expect(prepN2).toStrictEqual({ actions: null, methods: {} });
    expect(prepN3).toStrictEqual({ actions: null, methods: {} });
    expect(prepN4).toStrictEqual({ actions: null, methods: {} });
  });
  it("should return subtype actions and methods correctly", async () => {
    // Check initial registration works
    let prep1 = API.addSubtype(test1, prepareTest1Subtype);
    const actions = makeTestActions().filter((_, index) => index < 2);
    expect(prep1.actions).toStrictEqual(actions);
    expect(prep1.methods).toStrictEqual({ clean: cleanTestElementUpdate });
    // Check repeat registration fails
    prep1 = API.addSubtype(test1, prepareNullSubtype);
    expect(prep1.actions).toBeNull();
    expect(prep1.methods).toStrictEqual({ clean: cleanTestElementUpdate });

    // Check initial registration works
    let prep2 = API.addSubtype(test2, prepareTest2Subtype);
    expect(prep2.actions).toStrictEqual([makeTestActions()[2]]);
    expect(prep2.methods).toStrictEqual({
      ensureLoaded: ensureLoadedTest2,
      measureText: measureTest2,
      wrapText: wrapTest2,
    });
    // Check repeat registration fails
    prep2 = API.addSubtype(test2, prepareNullSubtype);
    expect(prep2.actions).toBeNull();
    expect(prep2.methods).toStrictEqual({
      ensureLoaded: ensureLoadedTest2,
      measureText: measureTest2,
      wrapText: wrapTest2,
    });

    // Check initial registration works
    let prep3 = API.addSubtype(test3, prepareTest3Subtype);
    expect(prep3.actions).toStrictEqual([makeTestActions()[3]]);
    expect(prep3.methods).toStrictEqual({});
    // Check repeat registration fails
    prep3 = API.addSubtype(test3, prepareNullSubtype);
    expect(prep3.actions).toBeNull();
    expect(prep3.methods).toStrictEqual({});
  });
});

describe("subtypes", () => {
  it("should correctly register", async () => {
    const subtypes = getSubtypeNames();
    expect(subtypes).toContain(test1.subtype);
    expect(subtypes).toContain(test2.subtype);
    expect(subtypes).toContain(test3.subtype);
  });
  it("should return subtype methods", async () => {
    expect(getSubtypeMethods(undefined)).toBeUndefined();
    const test1Methods = getSubtypeMethods(test1.subtype);
    expect(test1Methods?.clean).toBeDefined();
    expect(test1Methods?.render).toBeUndefined();
    expect(test1Methods?.wrapText).toBeUndefined();
    expect(test1Methods?.renderSvg).toBeUndefined();
    expect(test1Methods?.measureText).toBeUndefined();
    expect(test1Methods?.ensureLoaded).toBeUndefined();
  });
  it("should not overwrite subtype methods", async () => {
    addSubtypeMethods(test1.subtype, {});
    addSubtypeMethods(test2.subtype, {});
    addSubtypeMethods(test3.subtype, { clean: cleanTestElementUpdate });
    const test1Methods = getSubtypeMethods(test1.subtype);
    expect(test1Methods?.clean).toBeDefined();
    const test2Methods = getSubtypeMethods(test2.subtype);
    expect(test2Methods?.measureText).toBeDefined();
    expect(test2Methods?.wrapText).toBeDefined();
    const test3Methods = getSubtypeMethods(test3.subtype);
    expect(test3Methods?.clean).toBeUndefined();
  });
  it("should register custom shortcuts", async () => {
    expect(
      getShortcutFromShortcutName(makeCustomActionName("testShortcut")),
    ).toBe("Shift+T");
  });
  it("should correctly validate", async () => {
    test1.parents.forEach((p) => {
      expect(isValidSubtype(test1.subtype, p)).toBe(true);
      expect(isValidSubtype(undefined, p)).toBe(false);
    });
    expect(isValidSubtype(test1.subtype, test1NonParent)).toBe(false);
    expect(isValidSubtype(test1.subtype, undefined)).toBe(false);
    expect(isValidSubtype(undefined, undefined)).toBe(false);
  });
  it("should collide with themselves", async () => {
    expect(subtypeCollides(test1.subtype, [test1.subtype])).toBe(true);
    expect(subtypeCollides(test1.subtype, [test1.subtype, test2.subtype])).toBe(
      true,
    );
  });
  it("should not collide without type overlap", async () => {
    expect(subtypeCollides(test1.subtype, [test2.subtype])).toBe(false);
  });
  it("should collide with type overlap", async () => {
    expect(subtypeCollides(test1.subtype, [test3.subtype])).toBe(true);
  });
  it("should apply to ExcalidrawElements", async () => {
    const elements = [
      API.createElement({ type: "line", id: "A", subtype: test1.subtype }),
      API.createElement({ type: "arrow", id: "B", subtype: test1.subtype }),
      API.createElement({ type: "rectangle", id: "C", subtype: test1.subtype }),
      API.createElement({ type: "diamond", id: "D", subtype: test1.subtype }),
      API.createElement({ type: "ellipse", id: "E", subtype: test1.subtype }),
    ];
    await render(<Excalidraw />, { localStorageData: { elements } });
    elements.forEach((el) => expect(el.subtype).toBe(test1.subtype));
  });
  it("should enforce prop value restrictions", async () => {
    const elements = [
      API.createElement({
        type: "line",
        id: "A",
        subtype: test1.subtype,
        roughness: 1,
      }),
      API.createElement({ type: "line", id: "B", roughness: 1 }),
    ];
    await render(<Excalidraw />, { localStorageData: { elements } });
    elements.forEach((el) => {
      if (el.subtype === test1.subtype) {
        expect(el.roughness).toBe(0);
      } else {
        expect(el.roughness).toBe(1);
      }
    });
  });
  it("should consider enforced prop values in version increments", async () => {
    const rectA = API.createElement({
      type: "line",
      id: "A",
      subtype: test1.subtype,
      roughness: 1,
      strokeWidth: 1,
    });
    const rectB = API.createElement({
      type: "line",
      id: "B",
      subtype: test1.subtype,
      roughness: 1,
      strokeWidth: 1,
    });
    // Initial element creation checks
    expect(rectA.roughness).toBe(0);
    expect(rectB.roughness).toBe(0);
    expect(rectA.version).toBe(1);
    expect(rectB.version).toBe(1);
    // Check that attempting to set prop values not permitted by the subtype
    // doesn't increment element versions
    mutateElement(rectA, { roughness: 2 });
    mutateElement(rectB, { roughness: 2, strokeWidth: 2 });
    expect(rectA.version).toBe(1);
    expect(rectB.version).toBe(2);
    // Check that element versions don't increment when creating new elements
    // while attempting to use prop values not permitted by the subtype
    // First check based on `rectA` (unsuccessfully mutated)
    const rectC = newElementWith(rectA, { roughness: 1 });
    const rectD = newElementWith(rectA, { roughness: 1, strokeWidth: 1.5 });
    expect(rectC.version).toBe(1);
    expect(rectD.version).toBe(2);
    // Then check based on `rectB` (successfully mutated)
    const rectE = newElementWith(rectB, { roughness: 1 });
    const rectF = newElementWith(rectB, { roughness: 1, strokeWidth: 1.5 });
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
        return { width, height };
      }
      return { width: 1, height: 0 };
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
        expect(nextMetrics).toStrictEqual({ width: 0, height: 0 });
        const nextWrappedText = textElementUtils.wrapTextElement(el, MW, next);
        expect(nextWrappedText).toEqual("Hello\nworld.\nHello world.");

        // Now test modified fontSizes in `next`
        next = { fontSize: DBFONTSIZE };
        const nextFM = textElementUtils.measureTextElement(el, next);
        expect(nextFM).toStrictEqual({
          width: 2 * TWIDTH - 10,
          height: 2 * THEIGHT - 5,
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
        });
        const nextCDWrText = textElementUtils.wrapTextElement(el, MW, next);
        expect(nextCDWrText).toEqual(
          `${testString.split(" ").join("\n")}\nHELLO WORLD.`,
        );
      }
    });
  });
  it("should recognize subtypes with always-enabled actions", async () => {
    expect(hasAlwaysEnabledActions(test1.subtype)).toBe(false);
    expect(hasAlwaysEnabledActions(test2.subtype)).toBe(false);
    expect(hasAlwaysEnabledActions(test3.subtype)).toBe(true);
  });
  it("should select active subtypes and customData", async () => {
    const appState = {} as {
      activeSubtypes: AppState["activeSubtypes"];
      customData: AppState["customData"];
    };

    // No active subtypes
    let subtypes = selectSubtype(appState, "text");
    expect(subtypes.subtype).toBeUndefined();
    expect(subtypes.customData).toBeUndefined();
    // Subtype for both "text" and "line" types
    appState.activeSubtypes = [test3.subtype];
    subtypes = selectSubtype(appState, "text");
    expect(subtypes.subtype).toBe(test3.subtype);
    subtypes = selectSubtype(appState, "line");
    expect(subtypes.subtype).toBe(test3.subtype);
    subtypes = selectSubtype(appState, "arrow");
    expect(subtypes.subtype).toBeUndefined();
    // Subtype for multiple linear types
    appState.activeSubtypes = [test1.subtype];
    subtypes = selectSubtype(appState, "text");
    expect(subtypes.subtype).toBeUndefined();
    subtypes = selectSubtype(appState, "line");
    expect(subtypes.subtype).toBe(test1.subtype);
    subtypes = selectSubtype(appState, "arrow");
    expect(subtypes.subtype).toBe(test1.subtype);
    // Subtype for "text" only
    appState.activeSubtypes = [test2.subtype];
    subtypes = selectSubtype(appState, "text");
    expect(subtypes.subtype).toBe(test2.subtype);
    subtypes = selectSubtype(appState, "line");
    expect(subtypes.subtype).toBeUndefined();
    subtypes = selectSubtype(appState, "arrow");
    expect(subtypes.subtype).toBeUndefined();

    // Test customData
    appState.customData = {};
    appState.customData[test1.subtype] = { test: true };
    appState.customData[test2.subtype] = { test2: true };
    appState.customData[test3.subtype] = { test3: true };
    // Subtype for both "text" and "line" types
    appState.activeSubtypes = [test3.subtype];
    subtypes = selectSubtype(appState, "text");
    expect(subtypes.customData).toBeDefined();
    expect(subtypes.customData![test1.subtype]).toBeUndefined();
    expect(subtypes.customData![test2.subtype]).toBeUndefined();
    expect(subtypes.customData![test3.subtype]).toBe(true);
    subtypes = selectSubtype(appState, "line");
    expect(subtypes.customData).toBeDefined();
    expect(subtypes.customData![test1.subtype]).toBeUndefined();
    expect(subtypes.customData![test2.subtype]).toBeUndefined();
    expect(subtypes.customData![test3.subtype]).toBe(true);
    subtypes = selectSubtype(appState, "arrow");
    expect(subtypes.customData).toBeUndefined();
    // Subtype for multiple linear types
    appState.activeSubtypes = [test1.subtype];
    subtypes = selectSubtype(appState, "text");
    expect(subtypes.customData).toBeUndefined();
    subtypes = selectSubtype(appState, "line");
    expect(subtypes.customData).toBeDefined();
    expect(subtypes.customData![test1.subtype]).toBe(true);
    expect(subtypes.customData![test2.subtype]).toBeUndefined();
    expect(subtypes.customData![test3.subtype]).toBeUndefined();
    // Multiple, non-colliding subtypes
    appState.activeSubtypes = [test1.subtype, test2.subtype];
    subtypes = selectSubtype(appState, "text");
    expect(subtypes.customData).toBeDefined();
    expect(subtypes.customData![test1.subtype]).toBeUndefined();
    expect(subtypes.customData![test2.subtype]).toBe(true);
    expect(subtypes.customData![test3.subtype]).toBeUndefined();
    subtypes = selectSubtype(appState, "line");
    expect(subtypes.customData).toBeDefined();
    expect(subtypes.customData![test1.subtype]).toBe(true);
    expect(subtypes.customData![test2.subtype]).toBeUndefined();
    expect(subtypes.customData![test3.subtype]).toBeUndefined();
  });
});
describe("subtype actions", () => {
  let elements: ExcalidrawElement[];
  beforeEach(async () => {
    elements = [
      API.createElement({ type: "line", id: "A", subtype: test1.subtype }),
      API.createElement({ type: "line", id: "B" }),
      API.createElement({ type: "line", id: "C", subtype: test3.subtype }),
      API.createElement({ type: "text", id: "D", subtype: test3.subtype }),
    ];
    await render(<Excalidraw />, { localStorageData: { elements } });
  });
  it("should apply to elements with their subtype", async () => {
    h.setState({ selectedElementIds: { A: true } });
    const am = h.app.actionManager;
    expect(am.isActionEnabled(makeTestActions()[0], { elements })).toBe(true);
    expect(am.isActionEnabled(TEST_DISABLE1, { elements })).toBe(false);
  });
  it("should apply to elements without a subtype", async () => {
    h.setState({ selectedElementIds: { B: true } });
    const am = h.app.actionManager;
    expect(am.isActionEnabled(makeTestActions()[0], { elements })).toBe(false);
    expect(am.isActionEnabled(TEST_DISABLE1, { elements })).toBe(true);
  });
  it("should apply to elements with and without their subtype", async () => {
    h.setState({ selectedElementIds: { A: true, B: true } });
    const am = h.app.actionManager;
    expect(am.isActionEnabled(makeTestActions()[0], { elements })).toBe(true);
    expect(am.isActionEnabled(TEST_DISABLE1, { elements })).toBe(true);
  });
  it("should apply to elements with a different subtype", async () => {
    h.setState({ selectedElementIds: { C: true, D: true } });
    const am = h.app.actionManager;
    expect(am.isActionEnabled(makeTestActions()[0], { elements })).toBe(false);
    expect(am.isActionEnabled(TEST_DISABLE1, { elements })).toBe(true);
  });
  it("should apply to like types with varying subtypes", async () => {
    h.setState({ selectedElementIds: { A: true, C: true } });
    const am = h.app.actionManager;
    expect(am.isActionEnabled(makeTestActions()[0], { elements })).toBe(true);
    expect(am.isActionEnabled(TEST_DISABLE1, { elements })).toBe(true);
  });
  it("should apply to non-like types with varying subtypes", async () => {
    h.setState({ selectedElementIds: { A: true, D: true } });
    const am = h.app.actionManager;
    expect(am.isActionEnabled(makeTestActions()[0], { elements })).toBe(true);
    expect(am.isActionEnabled(TEST_DISABLE1, { elements })).toBe(false);
  });
  it("should apply to like/non-like types with varying subtypes", async () => {
    h.setState({ selectedElementIds: { A: true, B: true, D: true } });
    const am = h.app.actionManager;
    expect(am.isActionEnabled(makeTestActions()[0], { elements })).toBe(true);
    expect(am.isActionEnabled(TEST_DISABLE1, { elements })).toBe(true);
  });
  it("should apply to the correct parent type", async () => {
    const am = h.app.actionManager;
    h.setState({ selectedElementIds: { A: true, C: true } });
    expect(am.isActionEnabled(TEST_DISABLE3, { elements })).toBe(true);
    h.setState({ selectedElementIds: { A: true, D: true } });
    expect(am.isActionEnabled(TEST_DISABLE3, { elements })).toBe(true);
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
  });
});
