import fallbackLangData from "./locales/en.json";
import { registerAuxLangData } from "../../../i18n";
import { SubtypeMethods, SubtypePrepFn } from "../../../subtypes";
import { SubtypeButton } from "../../../components/SubtypeButton";
import { crispSubtypeIcon } from "./icon";
import { getCrispSubtype } from "./types";

const cleanCrispElementUpdate = function (updates) {
  const oldUpdates = {};
  for (const key in updates) {
    if (key !== "roughness") {
      (oldUpdates as any)[key] = (updates as any)[key];
    }
  }
  (updates as any).roughness = 0;
  return oldUpdates;
} as SubtypeMethods["clean"];

export const prepareCrispSubtype = function (
  addSubtypeAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {} as SubtypeMethods;
  methods.clean = cleanCrispElementUpdate;
  const getLangData = async (langCode: string): Promise<Object | undefined> => {
    try {
      const condData = await import(
        /* webpackChunkName: "locales/[request]" */ `./locales/${langCode}.json`
      );
      if (condData) {
        return condData;
      }
    } catch (e) {}
    return undefined;
  };
  addLangData(fallbackLangData, getLangData);
  registerAuxLangData(fallbackLangData, getLangData);

  const crispSubtype = getCrispSubtype().name;
  const crispAction = SubtypeButton(crispSubtype, "line", crispSubtypeIcon);

  const actions = [crispAction];
  actions.forEach((action) => addSubtypeAction(action));

  return { actions, methods };
} as SubtypePrepFn;
