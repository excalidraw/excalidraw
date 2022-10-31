import { ActionManager } from "../actions/manager";

export const FilterTagsBackground = ({
  actionManager,
}: {
  actionManager: ActionManager;
}) => (
  <div className="panelColumn">
    {actionManager.renderAction("filterTagsBackground")}
  </div>
);
