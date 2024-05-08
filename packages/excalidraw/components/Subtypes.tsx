import { getShortcutKey, updateActiveTool } from "../utils";
import { t } from "../i18n";
import type { Action } from "../actions/types";
import { makeCustomActionName } from "../actions/types";
import clsx from "clsx";
import type { Subtype, SubtypeRecord } from "../element/subtypes";
import {
  getSubtypeNames,
  hasAlwaysEnabledActions,
  isSubtypeAction,
  isValidSubtype,
  subtypeCollides,
} from "../element/subtypes";
import type { ExcalidrawElement, Theme } from "../element/types";
import {
  useExcalidrawActionManager,
  useExcalidrawContainer,
  useExcalidrawSetAppState,
} from "./App";
import type { ContextMenuItems } from "./ContextMenu";
import { Island } from "./Island";

export const SubtypeButton = (
  subtype: Subtype,
  parentType: SubtypeRecord["parents"][number],
  icon: ({ theme }: { theme: Theme }) => JSX.Element,
  key?: string,
) => {
  const title = key !== undefined ? ` - ${getShortcutKey(key)}` : "";
  const keyTest: Action["keyTest"] =
    key !== undefined ? (event) => event.code === `Key${key}` : undefined;
  const subtypeAction: Action = {
    name: makeCustomActionName(subtype),
    label: t(`toolBar.${subtype}`),
    trackEvent: false,
    predicate: (...rest) => rest[4]?.subtype === subtype,
    perform: (elements, appState) => {
      const inactive = !appState.activeSubtypes?.includes(subtype) ?? true;
      const activeSubtypes: Subtype[] = [];
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
      const activeTool = !inactive
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
        storeAction: "capture",
      };
    },
    keyTest,
    PanelComponent: ({ elements, appState, updateData, data }) => (
      <button
        className={clsx("ToolIcon_type_button", "ToolIcon_type_button--show", {
          ToolIcon: true,
          "ToolIcon--selected":
            appState.activeSubtypes !== undefined &&
            appState.activeSubtypes.includes(subtype),
          "ToolIcon--plain": true,
        })}
        title={`${t(`toolBar.${subtype}`)}${title}`}
        aria-label={t(`toolBar.${subtype}`)}
        onClick={() => {
          updateData(null);
        }}
        onContextMenu={
          data && "onContextMenu" in data
            ? (event: React.MouseEvent) => {
                if (
                  appState.activeSubtypes === undefined ||
                  (appState.activeSubtypes !== undefined &&
                    !appState.activeSubtypes.includes(subtype))
                ) {
                  updateData(null);
                }
                data.onContextMenu(event, subtype);
              }
            : undefined
        }
      >
        {
          <div className="ToolIcon__icon" aria-hidden="true">
            {icon.call(this, { theme: appState.theme })}
          </div>
        }
      </button>
    ),
  };
  if (key === "") {
    delete subtypeAction.keyTest;
  }
  return subtypeAction;
};

export const SubtypeToggles = () => {
  const am = useExcalidrawActionManager();
  const { container } = useExcalidrawContainer();
  const setAppState = useExcalidrawSetAppState();

  const onContextMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    subtype: string,
  ) => {
    event.preventDefault();

    const { top: offsetTop, left: offsetLeft } =
      container!.getBoundingClientRect();
    const left = event.clientX - offsetLeft;
    const top = event.clientY - offsetTop;

    const items: ContextMenuItems = [];
    am.filterActions(isSubtypeAction).forEach(
      (action) =>
        am.isActionEnabled(action, { data: { subtype } }) && items.push(action),
    );
    setAppState({}, () => {
      setAppState({
        contextMenu: { top, left, items },
      });
    });
  };

  // Only render if one or more subtypes are registered
  if (getSubtypeNames().length === 0) {
    return <></>;
  }
  return (
    <>
      <Island
        style={{
          marginLeft: 8,
          alignSelf: "center",
          height: "fit-content",
        }}
      >
        {getSubtypeNames().map((subtype) =>
          am.renderAction(
            makeCustomActionName(subtype),
            hasAlwaysEnabledActions(subtype) ? { onContextMenu } : {},
          ),
        )}
      </Island>
    </>
  );
};

SubtypeToggles.displayName = "SubtypeToggles";

export const SubtypeShapeActions = (props: {
  elements: readonly ExcalidrawElement[];
}) => {
  const am = useExcalidrawActionManager();
  return (
    <>
      {am
        .filterActions(isSubtypeAction, { elements: props.elements })
        .map((action) => am.renderAction(action.name))}
    </>
  );
};

SubtypeShapeActions.displayName = "SubtypeShapeActions";
