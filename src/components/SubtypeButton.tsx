import { getShortcutKey, updateActiveTool } from "../utils";
import { t } from "../i18n";
import { Action } from "../actions/types";
import { ToolButton } from "./ToolButton";
import clsx from "clsx";
import { CustomSubtype, isValidSubtype, subtypeCollides } from "../subtypes";
import { ExcalidrawElement, Theme } from "../element/types";

export const SubtypeButton = (
  subtype: CustomSubtype,
  parentType: ExcalidrawElement["type"],
  icon: ({ theme }: { theme: Theme }) => JSX.Element,
  key?: string,
) => {
  const title = key !== undefined ? ` - ${getShortcutKey(key)}` : "";
  const keyTest: Action["keyTest"] =
    key !== undefined ? (event) => event.code === `Key${key}` : undefined;
  const subtypeAction: Action = {
    name: subtype,
    trackEvent: false,
    perform: (elements, appState) => {
      const inactive = !appState.activeSubtypes?.includes(subtype) ?? true;
      const activeSubtypes: CustomSubtype[] = [];
      if (appState.activeSubtypes) {
        activeSubtypes.push(...appState.activeSubtypes);
      }
      let activated = false;
      if (inactive) {
        // Ensure `element.subtype` is well-defined
        if (!subtypeCollides(subtype, activeSubtypes)) {
          activeSubtypes.push(subtype);
          activated = true;
        }
      } else {
        // Can only be active if appState.activeSubtypes is defined
        // and contains subtype.
        activeSubtypes.splice(activeSubtypes.indexOf(subtype), 1);
      }
      const type =
        appState.activeTool.type !== "custom" &&
        isValidSubtype(subtype, appState.activeTool.type)
          ? appState.activeTool.type
          : parentType;
      const activeTool = activated
        ? appState.activeTool
        : updateActiveTool(appState, { type });
      const selectedElementIds = activated ? {} : appState.selectedElementIds;
      const selectedGroupIds = activated ? {} : appState.selectedGroupIds;

      return {
        appState: {
          ...appState,
          activeSubtypes,
          selectedElementIds,
          selectedGroupIds,
          activeTool,
        },
        commitToHistory: true,
      };
    },
    keyTest,
    PanelComponent: ({ elements, appState, updateData, data }) => (
      <ToolButton
        type="icon"
        icon={icon.call(this, { theme: appState.theme })}
        selected={
          appState.activeSubtypes !== undefined &&
          appState.activeSubtypes.includes(subtype)
        }
        className={clsx({
          selected:
            appState.activeSubtypes &&
            appState.activeSubtypes.includes(subtype),
        })}
        title={`${t(`toolBar.${subtype}`)}${title}`}
        aria-label={t(`toolBar.${subtype}`)}
        onClick={() => {
          updateData(null);
        }}
        size={data?.size || "medium"}
      ></ToolButton>
    ),
  };
  if (key === "") {
    delete subtypeAction.keyTest;
  }
  return subtypeAction;
};
