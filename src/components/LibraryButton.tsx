import clsx from "clsx";
import { t } from "../i18n";
import { AppState } from "../types";
import { capitalizeString } from "../utils";

const LIBRARY_ICON = (
  <svg viewBox="0 0 448 512">
    <path
      fill="currentColor"
      d="M448 360V24c0-13.3-10.7-24-24-24H96C43 0 0 43 0 96v320c0 53 43 96 96 96h328c13.3 0 24-10.7 24-24v-16c0-7.5-3.5-14.3-8.9-18.7-4.2-15.4-4.2-59.3 0-74.7 5.4-4.3 8.9-11.1 8.9-18.6zM128 134c0-3.3 2.7-6 6-6h212c3.3 0 6 2.7 6 6v20c0 3.3-2.7 6-6 6H134c-3.3 0-6-2.7-6-6v-20zm0 64c0-3.3 2.7-6 6-6h212c3.3 0 6 2.7 6 6v20c0 3.3-2.7 6-6 6H134c-3.3 0-6-2.7-6-6v-20zm253.4 250H96c-17.7 0-32-14.3-32-32 0-17.6 14.4-32 32-32h285.4c-1.9 17.1-1.9 46.9 0 64z"
    ></path>
  </svg>
);

export const LibraryButton: React.FC<{
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
}> = ({ appState, setAppState }) => {
  return (
    <label
      className={clsx(
        "ToolIcon ToolIcon_type_floating ToolIcon__library zen-mode-visibility",
        `ToolIcon_size_m`,
        {
          "zen-mode-visibility--hidden": appState.zenModeEnabled,
        },
      )}
      title={`${capitalizeString(t("toolBar.library"))} — 9`}
      style={{ marginInlineStart: "var(--space-factor)" }}
    >
      <input
        className="ToolIcon_type_checkbox"
        type="checkbox"
        name="editor-library"
        onChange={(event) => {
          setAppState({ isLibraryOpen: event.target.checked });
        }}
        checked={appState.isLibraryOpen}
        aria-label={capitalizeString(t("toolBar.library"))}
        aria-keyshortcuts="9"
      />
      <div className="ToolIcon__icon">{LIBRARY_ICON}</div>
    </label>
  );
};
