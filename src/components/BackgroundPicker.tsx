import React from "react";
import { ActionManager } from "../actions/manager";

export const BackgroundPicker = ({
  actionManager,
}: {
  actionManager: ActionManager;
}) => (
  <div style={{ display: "flex" }}>
    {actionManager.renderAction("changeViewBackgroundColor")}
  </div>
);
