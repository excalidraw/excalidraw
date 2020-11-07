import React from "react";
import clsx from "clsx";
import { ToolButton } from "./ToolButton";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { users } from "./icons";

import "./RoomDialog.scss";

export const RoomDialog = ({
  isCollaborating,
  collaboratorCount,
  onClick,
}: {
  isCollaborating: boolean;
  collaboratorCount: number;
  onClick: () => void;
}) => {
  return (
    <>
      <ToolButton
        className={clsx("RoomDialog-modalButton", {
          "is-collaborating": isCollaborating,
        })}
        onClick={onClick}
        icon={users}
        type="button"
        title={t("buttons.roomDialog")}
        aria-label={t("buttons.roomDialog")}
        showAriaLabel={useIsMobile()}
      >
        {collaboratorCount > 0 && (
          <div className="RoomDialog-modalButton-collaborators">
            {collaboratorCount}
          </div>
        )}
      </ToolButton>
    </>
  );
};
