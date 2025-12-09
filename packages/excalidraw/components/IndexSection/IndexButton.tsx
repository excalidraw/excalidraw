import React, { useState } from "react";
import { Button } from "../Button";
import { MapPin } from "../icons";
import { IndexSection } from "./IndexSection";
import { t } from "../../i18n";
import type { AppClassProperties, AppState } from "../../types";

interface IndexButtonProps {
  app: AppClassProperties;
  appState: AppState;
}

export const IndexButton: React.FC<IndexButtonProps> = ({ app, appState }) => {
  const [showIndex, setShowIndex] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="small"
        onClick={() => setShowIndex(true)}
        title={t("indexSection.title")}
      >
        <MapPin size={16} />
      </Button>
      {showIndex && (
        <div
          style={{
            position: "fixed",
            top: "80px",
            right: "20px",
            zIndex: 1000,
          }}
        >
          <IndexSection
            app={app}
            appState={appState}
            onClose={() => setShowIndex(false)}
          />
        </div>
      )}
    </>
  );
};