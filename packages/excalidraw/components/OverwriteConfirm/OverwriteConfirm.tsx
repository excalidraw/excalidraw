import React from "react";

import { useTunnels } from "../../context/tunnels";
import { useAtom } from "../../editor-jotai";
import { Dialog } from "../Dialog";
import { FilledButton } from "../FilledButton";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { alertTriangleIcon } from "../icons";

import { Actions, Action } from "./OverwriteConfirmActions";
import { overwriteConfirmStateAtom } from "./OverwriteConfirmState";

import "./OverwriteConfirm.scss";

export type OverwriteConfirmDialogProps = {
  children: React.ReactNode;
};

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
