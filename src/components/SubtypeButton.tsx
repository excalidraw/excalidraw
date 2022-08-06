import { getShortcutKey, updateActiveTool } from "../utils";
import { t } from "../i18n";
import { Action } from "../actions/types";
import { ToolButton } from "./ToolButton";
import clsx from "clsx";
import { CustomSubtype, isValidSubtype } from "../subtypes";
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
      const type =
        appState.activeTool.type !== "custom" &&
        isValidSubtype(subtype, appState.activeTool.type)
          ? appState.activeTool.type
          : parentType;
      const inactive = appState.activeSubtype !== subtype;
      const activeSubtype = inactive ? subtype : undefined;
      const activeTool = !inactive
        ? appState.activeTool
        : updateActiveTool(appState, { type });
      const selectedElementIds = inactive ? {} : appState.selectedElementIds;
      const selectedGroupIds = inactive ? {} : appState.selectedGroupIds;

      return {
        appState: {
          ...appState,
          activeSubtype,
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
          appState.activeSubtype !== undefined &&
          appState.activeSubtype === subtype
        }
        className={clsx({
          selected:
            appState.activeSubtype && appState.activeSubtype === subtype,
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
