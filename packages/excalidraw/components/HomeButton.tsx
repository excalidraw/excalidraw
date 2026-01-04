import React from "react";

import { t } from "../i18n";

import { capitalizeString } from "../../common/src";

import { HomeIcon } from "./icons";

import "./HomeButton.scss";

export const HomeButton: React.FC<{ onHomeButtonClick: () => void }> = ({
  onHomeButtonClick,
}) => {
  return (
    <label title={`${capitalizeString(t("toolBar.library"))} — 0`}>
      <div className="library-button" onClick={onHomeButtonClick}>
        <div>{HomeIcon}</div>
      </div>
    </label>
  );
};
