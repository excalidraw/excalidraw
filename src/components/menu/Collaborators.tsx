import React from "react";
import { t } from "../../i18n";
import { useDevice, useExcalidrawAppState } from "../App";
import { UserList } from "../UserList";

const Collaborators = () => {
  const device = useDevice();
  const appState = useExcalidrawAppState();
  if (!device.isMobile || appState.collaborators.size === 0) {
    return null;
  }
  return (
    <fieldset
      style={{ margin: 0, marginTop: "10px", padding: 0, border: "none" }}
    >
      <legend
        style={{
          display: "block",
          fontSize: "0.75rem",
          fontWeight: 400,
          margin: "0 0 0.25rem",
          padding: 0,
        }}
      >
        {t("labels.collaborators")}
      </legend>
      <UserList mobile collaborators={appState.collaborators} />
    </fieldset>
  );
};
export default Collaborators;
Collaborators.displayName = "Collaborators";
