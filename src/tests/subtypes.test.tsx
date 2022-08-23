import fallbackLangData from "./helpers/locales/en.json";
import {
  CustomMethods,
  SubtypePrepFn,
  SubtypeTypes,
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
  addLangData(fallbackLangData, getLangData);
  registerAuxLangData(fallbackLangData, getLangData);

  const testAction = SubtypeButton("test", "line", testSubtypeIcon);

  const actions = [testAction];
  actions.forEach((action) => addCustomAction(action));

  return { actions, methods };
} as SubtypePrepFn;

const { h } = window;

prepareSubtype(testSubtypeTypes, prepareTestSubtype);

describe("subtypes", () => {
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
  it("should collide with themselves", async () => {
    expect(subtypeCollides(testSubtype, [testSubtype])).toBe(true);
  });
});
