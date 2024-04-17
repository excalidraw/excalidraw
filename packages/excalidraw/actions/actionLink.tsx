import { getContextMenuLabel } from "../components/hyperlink/Hyperlink";
import { LinkIcon } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { isEmbeddableElement } from "../element/typeChecks";
import { t } from "../i18n";
import { KEYS } from "../keys";
import { getSelectedElements } from "../scene";
import { StoreAction } from "../store";
import { getShortcutKey } from "../utils";
import { register } from "./register";

export const actionLink = register({
  name: "hyperlink",
  label: (elements, appState) => getContextMenuLabel(elements, appState),
  icon: LinkIcon,
  perform: (elements, appState) => {
    if (appState.showHyperlinkPopup === "editor") {
      return false;
    }

    return {
      elements,
      appState: {
        ...appState,
        showHyperlinkPopup: "editor",
        openMenu: null,
      },
      storeAction: StoreAction.CAPTURE,
    };
  },
  trackEvent: { category: "hyperlink", action: "click" },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.K,
  predicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    return selectedElements.length === 1;
  },
  PanelComponent: ({ elements, appState, updateData }) => {
    const selectedElements = getSelectedElements(elements, appState);

    return (
      <ToolButton
        type="button"
        icon={LinkIcon}
        aria-label={t(getContextMenuLabel(elements, appState))}
        title={`${
          isEmbeddableElement(elements[0])
            ? t("labels.link.labelEmbed")
            : t("labels.link.label")
        } - ${getShortcutKey("CtrlOrCmd+K")}`}
        onClick={() => updateData(null)}
        selected={selectedElements.length === 1 && !!selectedElements[0].link}
      />
    );
  },
});
