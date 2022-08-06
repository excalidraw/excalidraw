import fallbackLangData from "./locales/en.json";
import { registerAuxLangData } from "../../../i18n";
import { CustomMethods, SubtypePrepFn } from "../../../subtypes";
import { crispSubtypeIcon } from "./icon";
import { SubtypeButton } from "../../../components/SubtypeButton";

const cleanCrispElementUpdate = function (updates) {
  const oldUpdates = {};
  for (const key in updates) {
    if (key !== "roughness") {
      (oldUpdates as any)[key] = (updates as any)[key];
    }
  }
  (updates as any).roughness = 0;
  return oldUpdates;
} as CustomMethods["clean"];

export const prepareCrispSubtype = function (
  addCustomAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {} as CustomMethods;
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

  const crispAction = SubtypeButton("crisp", "line", crispSubtypeIcon);

  const actions = [crispAction];
  actions.forEach((action) => addCustomAction(action));

  return { actions, methods };
} as SubtypePrepFn;
