import React, { ChangeEvent, useCallback, useState } from "react";
import Fuse from "fuse.js";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { useDevice } from "../components/App";
import { AppState, ExcalidrawProps } from "../types";
import { close } from "./icons";
import { Island } from "./Island";
import "./Search.scss";
import { zoomToFitElements } from "../actions/actionCanvas";

/**
 * TODO:
 * - Use icons for Prev/Next
 * - Cmd/Ctrl+F when search is open should focus the input, how to listen
 *   to such an event?
 * - Benchmark performance. Is it possible to listen to text create/delete
 *   events so we don't have to build search index from scratch on every
 *   query change.
 * - Is it necessary to highlight text?
 * - Is it ok to export `zoomToFitElements`? Or are there alternatives?
 * - What is the desired behavior for mobile?
 */
export const Search = (props: {
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onClose: () => void;
  renderCustomStats: ExcalidrawProps["renderCustomStats"];
}) => {
  const { onClose, setAppState } = props;
  const device = useDevice();

  const [matchingElements, setMatchingElements] = useState<
    Fuse.FuseResult<NonDeletedExcalidrawElement>[]
  >([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [query, setQuery] = useState("");

  const focusElement = useCallback(() => {
    const element = matchingElements[focusIndex]?.item;
    if (!element) {
      return;
    }
    setAppState(zoomToFitElements([element], props.appState, false).appState);
  }, [setAppState, props.appState, matchingElements, focusIndex]);

  const focusPrev = useCallback(() => {
    if (focusIndex <= 0) {
      setFocusIndex(matchingElements.length - 1);
    } else {
      setFocusIndex(focusIndex - 1);
    }
    focusElement();
  }, [focusIndex, matchingElements, focusElement]);

  const focusNext = useCallback(() => {
    if (focusIndex >= matchingElements.length - 1) {
      setFocusIndex(0);
    } else {
      setFocusIndex(focusIndex + 1);
    }
    focusElement();
  }, [focusIndex, matchingElements, focusElement]);

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setQuery(query);
      const fuse = new Fuse(props.elements, { keys: ["text"] });
      const result = fuse.search(query);
      setMatchingElements(result);
      setFocusIndex(0);
      focusElement();
    },
    [props.elements, focusElement],
  );
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.target === document.activeElement && e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter") {
        const fuse = new Fuse(props.elements, { keys: ["text"] });
        const result = fuse.search(query);
        if (matchingElements.length !== result.length) {
          setFocusIndex(1);
        }
        if (document.activeElement === e.target) {
          focusNext();
        }
        setMatchingElements(result);
        focusElement();
      }
    },
    [onClose, query, props.elements, matchingElements, focusElement, focusNext],
  );
  if (device.isMobile && props.appState.openMenu) {
    return null;
  }
  return (
    <div className="Search">
      <Island padding={2}>
        <div className="close" onClick={props.onClose}>
          {close}
        </div>
        <input
          value={query}
          onChange={onChange}
          onKeyDown={onKeyDown}
          autoFocus
        />
        <button onClick={focusPrev}>Prev</button>
        <button onClick={focusNext}>Next</button>
        {matchingElements.length === 0
          ? t("search.noMatch")
          : `${focusIndex + 1}/${matchingElements.length}`}
      </Island>
    </div>
  );
};
