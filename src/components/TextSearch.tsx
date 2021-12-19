import React from "react";
import { NonDeletedExcalidrawElement } from "../element/types";
import { useIsMobile } from "../components/App";
import { AppState } from "../types";
import { Island } from "./Island";
import "./TextSearch.scss";
import { KEYS } from "../keys";

export const TextSearch = (props: {
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onClose: () => void;
}) => {
  const isMobile = useIsMobile();
  if (isMobile) {
    return null;
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === KEYS.ESCAPE) {
      props.setAppState({ textSearchActive: false });
    }
  };

  return (
    <div className="TextSearch">
      <Island padding={2}>
        <input
          type="text"
          className="searchInput"
          id="inputText"
          onChange={(event) => {
            props.setAppState({ searchMatchText: event.target.value });
          }}
          onKeyDown={handleKeyDown}
        />
      </Island>
    </div>
  );
};
