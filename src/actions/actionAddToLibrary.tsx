import React, { useContext, useEffect } from "react";
import { uuid } from "uuidv4";
import {
  addToLibrary as icon,
  addToLibraryCheck as checkedIcon,
} from "../components/icons";
import { LibraryStorage } from "../components/library/storage";
import { ToolButton } from "../components/ToolButton";
import { AppContext } from "../context/AppContext";
import { register } from "./register";
import { ActionName, KeyTestFn } from "./types";
import "../components/library/AddToLibraryButton.scss";
import { t } from "../i18n";
import { getShortcutKey } from "../utils";

const getAddToLibraryAction = (name: ActionName, keyTest?: KeyTestFn) => {
  return register({
    name,
    perform: (elements, appState) => {
      const result = { commitToHistory: false };
      if (appState.isCurrentSelectionAddedToLibrary) {
        return result;
      }
      let elementsToAdd =
        name === "addSelectionToLibrary"
          ? elements.filter(
              (element) => appState.selectedElementIds[element.id],
            )
          : elements;
      // If nothing selected, save entire drawing.
      if (!elementsToAdd.length) {
        elementsToAdd = elements;
      }
      // Name is copied from the drawing name only if the entire drawing
      // is saved.
      const drawingName =
        elementsToAdd === elements && !appState.isUntitled ? appState.name : "";
      LibraryStorage.init().then((storage) =>
        storage.save({
          uid: uuid(),
          name: drawingName,
          elements: elementsToAdd,
        }),
      );
      return {
        ...result,
        appState: {
          ...appState,
          isCurrentSelectionAddedToLibrary: true,
        },
      };
    },
    keyTest,
    PanelComponent: ({ updateData: performAction }) => {
      const { appState, setAppState } = useContext(AppContext);
      const { isCurrentSelectionAddedToLibrary: isAdded } = appState;

      useEffect(
        () => {
          // Clear the "added to library" flag whenever the selection
          // changes. Ideally this would be based on whether there's
          // an "equivalent" shape in the library but it will require
          // a bunch more work to implement something that clever.
          if (appState.isCurrentSelectionAddedToLibrary) {
            setAppState({
              ...appState,
              isCurrentSelectionAddedToLibrary: false,
            });
          }
        },
        /* eslint-disable */
        [appState.selectedElementIds],
      );

      useEffect(
        () => {
          setAppState({ ...appState, isCurrentSelectionAddedToLibrary: false });
        },
        /* eslint-disable */
        [],
      );

      const label = `${t("buttons.addToLibrary")} — ${getShortcutKey(
        "Shift+B",
      )}`;

      return (
        <ToolButton
          className={`AddToLibraryButton ${(isAdded && "Added") || ""}`}
          icon={isAdded ? checkedIcon : icon}
          aria-label={label}
          label={label}
          title={label}
          type="button"
          onClick={() => performAction()}
        ></ToolButton>
      );
    },
  });
};

export const actionAddSelectionToLibrary = getAddToLibraryAction(
  "addSelectionToLibrary",
  (event) => event.key === "B",
);

export const actionAddDrawingToLibrary = getAddToLibraryAction(
  "addDrawingToLibrary",
);
