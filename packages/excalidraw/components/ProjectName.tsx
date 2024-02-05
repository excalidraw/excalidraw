import "./TextInput.scss";

import React, { useState } from "react";
import { focusNearestParent } from "../utils";

import "./ProjectName.scss";
import { useExcalidrawContainer } from "./App";
import { KEYS } from "../keys";
import { EditorLocalStorage } from "../data/EditorLocalStorage";
import { EDITOR_LS_KEYS } from "../constants";
import { getFileName } from "../data/filename";

type Props = {
  value?: string;
  onChange: (value: string) => void;
  label: string;
  isNameEditable: boolean;
  ignoreFocus?: boolean;
};

export const ProjectName = (props: Props) => {
  const { id } = useExcalidrawContainer();
  const [fileName, setFileName] = useState<string>(
    props.value || getFileName(),
  );

  const handleBlur = (event: any) => {
    EditorLocalStorage.set(EDITOR_LS_KEYS.EXCALIDRAW_FILE_NAME, fileName);

    if (!props.ignoreFocus) {
      focusNearestParent(event.target);
    }
    const value = event.target.value;
    if (value !== props.value) {
      props.onChange(value);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === KEYS.ENTER) {
      event.preventDefault();
      if (event.nativeEvent.isComposing || event.keyCode === 229) {
        return;
      }
      event.currentTarget.blur();
    }
  };

  return (
    <div className="ProjectName">
      <label className="ProjectName-label" htmlFor="filename">
        {`${props.label}${props.isNameEditable ? "" : ":"}`}
      </label>
      {props.isNameEditable ? (
        <input
          type="text"
          className="TextInput"
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          id={`${id}-filename`}
          value={fileName}
          onChange={(event) => setFileName(event.target.value)}
        />
      ) : (
        <span className="TextInput TextInput--readonly" id={`${id}-filename`}>
          {props.value}
        </span>
      )}
    </div>
  );
};
