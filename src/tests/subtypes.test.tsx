import fallbackLangData from "./helpers/locales/en.json";
import {
  CustomMethods,
  SubtypePrepFn,
  SubtypeTypes,
  isValidSubtype,
  prepareSubtype,
  subtypeCollides,
} from "../subtypes";

import { render } from "./test-utils";
import { API } from "./helpers/api";
import ExcalidrawApp from "../excalidraw-app";

import { Theme } from "../element/types";
import { createIcon, iconFillColor } from "../components/icons";
import { SubtypeButton } from "../components/SubtypeButton";
import { registerAuxLangData } from "../i18n";

const getLangData = async (langCode: string): Promise<Object | undefined> => {
  try {
    const condData = await import(
      /* webpackChunkName: "locales/[request]" */ `./helpers/locales/${langCode}.json`
    );
    if (condData) {
      return condData;
    }
  } catch (e) {}
  return undefined;
};

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

const testSubtype = "test" as const;
const testProps = [{} as {}] as const;

const testSubtypeTypes: SubtypeTypes = {
  subtype: testSubtype,
  parents: [
    { subtype: testSubtype, parentType: "line" },
    { subtype: testSubtype, parentType: "arrow" },
    { subtype: testSubtype, parentType: "rectangle" },
    { subtype: testSubtype, parentType: "diamond" },
    { subtype: testSubtype, parentType: "ellipse" },
  ],
  customData: testProps,
  customActions: [
    {
      subtype: testSubtype,
      actions: [testSubtype],
    },
  ],
  disabledActions: [{ subtype: testSubtype, actions: ["changeSloppiness"] }],
  customShortcutNames: [],
  customShortcutMap: {},
};

const testSubtypeNonParent = "text" as const;

const test2Subtype = "test2" as const;
const test2Props = [{} as {}] as const;

const test2SubtypeTypes: SubtypeTypes = {
  subtype: test2Subtype,
  parents: [{ subtype: test2Subtype, parentType: "text" }],
  customData: test2Props,
  customActions: [
    {
      subtype: test2Subtype,
      actions: [test2Subtype],
    },
  ],
  disabledActions: [],
  customShortcutNames: [],
  customShortcutMap: {},
};

const test3Subtype = "test3" as const;
const test3Props = [{} as {}] as const;

const test3SubtypeTypes: SubtypeTypes = {
  subtype: test3Subtype,
  parents: [
    { subtype: test3Subtype, parentType: "text" },
    { subtype: test3Subtype, parentType: "line" },
  ],
  customData: test3Props,
  customActions: [
    {
      subtype: test3Subtype,
      actions: [test3Subtype],
    },
  ],
  disabledActions: [],
  customShortcutNames: [],
  customShortcutMap: {},
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
} as CustomMethods["clean"];

const prepareTestSubtype = function (
  addCustomAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {} as CustomMethods;
  methods.clean = cleanTestElementUpdate;

  addLangData(fallbackLangData, getLangData);
  registerAuxLangData(fallbackLangData, getLangData);

  const actions = [SubtypeButton("test", "line", testSubtypeIcon)];
  actions.forEach((action) => addCustomAction(action));

  return { actions, methods };
} as SubtypePrepFn;

const prepareTest2Subtype = function (
  addCustomAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {} as CustomMethods;

  addLangData(fallbackLangData, getLangData);
  registerAuxLangData(fallbackLangData, getLangData);

  const actions = [SubtypeButton("test2", "text", testSubtypeIcon)];
  actions.forEach((action) => addCustomAction(action));

  return { actions, methods };
} as SubtypePrepFn;

const prepareTest3Subtype = function (
  addCustomAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {} as CustomMethods;

  addLangData(fallbackLangData, getLangData);
  registerAuxLangData(fallbackLangData, getLangData);

  const actions = [SubtypeButton("test3", "text", testSubtypeIcon)];
  actions.forEach((action) => addCustomAction(action));

  return { actions, methods };
} as SubtypePrepFn;

const { h } = window;

prepareSubtype(testSubtypeTypes, prepareTestSubtype);
prepareSubtype(test2SubtypeTypes, prepareTest2Subtype);
prepareSubtype(test3SubtypeTypes, prepareTest3Subtype);

describe("subtypes", () => {
  it("should correctly validate", async () => {
    testSubtypeTypes.parents.forEach((p) => {
      expect(isValidSubtype(p.subtype, p.parentType)).toBe(true);
      expect(isValidSubtype(undefined, p.parentType)).toBe(false);
    });
    expect(isValidSubtype(testSubtype, testSubtypeNonParent)).toBe(false);
    expect(isValidSubtype(testSubtype, undefined)).toBe(false);
    expect(isValidSubtype(undefined, undefined)).toBe(false);
  });
  it("should collide with themselves", async () => {
    expect(subtypeCollides(testSubtype, [testSubtype])).toBe(true);
    expect(subtypeCollides(testSubtype, [testSubtype, test2Subtype])).toBe(
      true,
    );
  });
  it("should not collide without type overlap", async () => {
    expect(subtypeCollides(testSubtype, [test2Subtype])).toBe(false);
  });
  it("should collide with type overlap", async () => {
    expect(subtypeCollides(testSubtype, [test3Subtype])).toBe(true);
  });
  it("should apply to ExcalidrawElements", async () => {
    await render(<ExcalidrawApp />, {
      localStorageData: {
        elements: [
          API.createElement({ type: "line", id: "A", subtype: testSubtype }),
          API.createElement({ type: "arrow", id: "B", subtype: testSubtype }),
          API.createElement({
            type: "rectangle",
            id: "C",
            subtype: testSubtype,
          }),
          API.createElement({ type: "diamond", id: "D", subtype: testSubtype }),
          API.createElement({ type: "ellipse", id: "E", subtype: testSubtype }),
        ],
      },
    });
    h.elements.forEach((el) => expect(el.subtype).toBe(testSubtype));
  });
  it("should enforce prop value restrictions", async () => {
    await render(<ExcalidrawApp />, {
      localStorageData: {
        elements: [
          API.createElement({
            type: "line",
            id: "A",
            subtype: testSubtype,
            roughness: 1,
          }),
          API.createElement({ type: "line", id: "B", roughness: 1 }),
        ],
      },
    });
    h.elements.forEach((el) => {
      if (el.subtype === testSubtype) {
        expect(el.roughness).toBe(0);
      } else {
        expect(el.roughness).toBe(1);
      }
    });
  });
});
