import React from "react";

import { useTunnels } from "../../context/tunnels";
import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import { Dialog } from "../Dialog";
import { FilledButton } from "../FilledButton";
import Trans from "../Trans";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { alertTriangleIcon } from "../icons";

import { Actions, Action } from "./OverwriteConfirmActions";
import {
  openConfirmModal,
  overwriteConfirmStateAtom,
} from "./OverwriteConfirmState";

import "./OverwriteConfirm.scss";

export type OverwriteConfirmDialogProps = {
  children: React.ReactNode;
};

export const confirmLoadScene = () =>
  openConfirmModal({
    title: t("overwriteConfirm.modal.loadFromFile.title"),
    actionLabel: t("overwriteConfirm.modal.loadFromFile.button"),
    color: "warning",
    description: (
      <Trans
        i18nKey="overwriteConfirm.modal.loadFromFile.description"
        bold={(text) => <strong>{text}</strong>}
        br={() => <br />}
      />
    ),
  });

const OverwriteConfirmDialog = Object.assign(
  withInternalFallback(
    "OverwriteConfirmDialog",
    ({ children }: OverwriteConfirmDialogProps) => {
      const { OverwriteConfirmDialogTunnel } = useTunnels();
      const [overwriteConfirmState, setState] = useAtom(
        overwriteConfirmStateAtom,
      );

      if (!overwriteConfirmState.active) {
        return null;
      }

      const handleClose = () => {
        overwriteConfirmState.onClose();
        setState((state) => ({ ...state, active: false }));
      };

      const handleConfirm = () => {
        overwriteConfirmState.onConfirm();
        setState((state) => ({ ...state, active: false }));
      };

      return (
        <OverwriteConfirmDialogTunnel.In>
          <Dialog onCloseRequest={handleClose} title={false} size={916}>
            <div className="OverwriteConfirm">
              <h3>{overwriteConfirmState.title}</h3>
              <div
                className={`OverwriteConfirm__Description OverwriteConfirm__Description--color-${overwriteConfirmState.color}`}
              >
                <div className="OverwriteConfirm__Description__icon">
                  {alertTriangleIcon}
                </div>
                <div>{overwriteConfirmState.description}</div>
                <div className="OverwriteConfirm__Description__spacer"></div>
                <FilledButton
                  color={overwriteConfirmState.color}
                  size="large"
                  label={overwriteConfirmState.actionLabel}
                  onClick={handleConfirm}
                />
              </div>
              <Actions>{children}</Actions>
            </div>
          </Dialog>
        </OverwriteConfirmDialogTunnel.In>
      );
    },
  ),
  {
    Actions,
    Action,
  },
);

export { OverwriteConfirmDialog };
