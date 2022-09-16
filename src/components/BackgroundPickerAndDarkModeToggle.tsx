import { ActionManager } from "../actions/manager";

export const BackgroundPickerAndDarkModeToggle = ({
  actionManager,
}: {
  actionManager: ActionManager;
}) => (
  <div style={{ display: "flex" }}>
    {actionManager.renderAction("changeViewBackgroundColor")}
    {actionManager.renderAction("toggleTheme")}
  </div>
);
