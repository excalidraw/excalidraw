import clsx from "clsx";

import { useAtomValue } from "../editor-jotai";
import { t } from "../i18n";

import { useApp } from "./App";
import { IconButton } from "./IconButton";
import { Island } from "./Island";
import { RetryIcon } from "./icons";

import "./ClearAnnotationsButton.scss";

export const ClearAnnotationsButton = ({ isMobile = false }) => {
  const app = useApp();
  const hasAnnotations = useAtomValue(app.laserTrails.hasAnnotationsAtom);

  if (!hasAnnotations) {
    return null;
  }

  return (
    <Island
      padding={1}
      className={clsx("clear-annotations", {
        "clear-annotations--mobile": isMobile,
      })}
    >
      <IconButton
        type="button"
        icon={RetryIcon}
        aria-label={t("buttons.clearAnnotations")}
        title={t("buttons.clearAnnotations")}
        data-testid="clear-annotations"
        onClick={() => {
          app.laserTrails.clearAnnotations();
          app.focusContainer();
        }}
      />
    </Island>
  );
};
