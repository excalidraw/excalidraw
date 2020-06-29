import React, { useState, lazy, Suspense, useContext } from "react";
import { ToolButton } from "../ToolButton";
import { openLibrary } from "../icons";
import { t } from "../../i18n";
import { AppContext } from "../../context/AppContext";
import { getShortcutKey } from "../../utils";
import "./OpenLibraryButton.scss";

const LibraryDialog = lazy(() => import("./LibraryDialog"));

export default function OpenLibraryButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { appState, setAppState } = useContext(AppContext);
  const label = `${t("buttons.openLibrary")} — ${getShortcutKey("B")}`;

  return (
    <>
      <ToolButton
        icon={isLoading ? <>...</> : openLibrary}
        size="m"
        type="button"
        aria-label={label}
        title={label}
        className={`OpenLibraryButton ${
          appState.isCurrentSelectionAddedToLibrary ? "ItemAdded" : ""
        }`}
        onClick={async () => {
          setAppState({ ...appState, isLibraryOpen: true });
          // NOTE: to see what this loading state looks like in development,
          // you'll need to simulate a slow network using your browser's dev
          // tools.
          setIsLoading(true);
          import("./LibraryDialog").then(() => setIsLoading(false));
        }}
      ></ToolButton>
      {appState.isLibraryOpen && (
        <Suspense fallback={<></>}>
          <LibraryDialog
            onCloseRequest={() =>
              setAppState({ ...appState, isLibraryOpen: false })
            }
          />
        </Suspense>
      )}
    </>
  );
}
