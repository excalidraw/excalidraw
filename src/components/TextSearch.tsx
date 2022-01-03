import React from "react";
import { NonDeletedExcalidrawElement } from "../element/types";
import { useIsMobile } from "../components/App";
import { AppState } from "../types";
import { Island } from "./Island";
import "./TextSearch.scss";
import { close, back, start } from "./icons";

export const TextSearch = (props: {
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onClose: () => void;
  onKeyUp: (event: KeyboardEvent) => void;
}) => {
  const isMobile = useIsMobile();
  if (isMobile) {
    return null;
  }

  return (
    <div className="TextSearch">
      <Island padding={2}>
        <div className="close" onClick={props.onClose}>
          {close}
        </div>
        <div className="next">{start}</div>
        <div className="last">{back}</div>
        <input
          type="text"
          className="searchInput"
          id="inputText"
          onChange={(event) => {
            props.setAppState({ searchMatchText: event.target.value });
          }}
          autoFocus
        />
      </Island>
    </div>
  );
};
