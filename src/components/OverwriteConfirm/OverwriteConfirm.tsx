import React from "react";
import { useAtom } from "jotai";

import { useTunnels } from "../../context/tunnels";
import { jotaiScope } from "../../jotai";
import { Dialog } from "../Dialog";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { overwriteConfirmState } from "./OverwriteConfirmState";

import { FilledButton } from "../FilledButton";
import { alertTriangleIcon } from "../icons";
import { Actions } from "./OverwriteConfirmActions";
import "./OverwriteConfirm.scss";

export type OverwriteConfirmDialogProps = {
  children: React.ReactNode;
};

const Title = () => {
  const [{ title }] = useAtom(overwriteConfirmState, jotaiScope);

  return <h3>{title}</h3>;
};

const Description = () => {
  const [{ description, actionLabel, onConfirm, color }, setState] = useAtom(
    overwriteConfirmState,
    jotaiScope,
  );

  const handleConfirm = () => {
    setState((state) => ({ ...state, active: false }));
    onConfirm?.();
  };

  return (
    <div
      className={`OverwriteConfirm__Description OverwriteConfirm__Description--color-${color}`}
    >
      <div className="OverwriteConfirm__Description__icon">
        {alertTriangleIcon}
      </div>
      <div>{description}</div>
      <div className="OverwriteConfirm__Description__spacer"></div>
      <FilledButton
        color={color}
        size="large"
        label={actionLabel!}
        onClick={handleConfirm}
      />
    </div>
  );
};

const OverwriteConfirmDialog = Object.assign(
  withInternalFallback(
    "OverwriteConfirmDialog",
    ({ children }: OverwriteConfirmDialogProps) => {
      const { OverwriteConfirmDialogTunnel } = useTunnels();
      const [{ active, onClose }, setState] = useAtom(
        overwriteConfirmState,
        jotaiScope,
      );

      if (!active) {
        return null;
      }

      const handleClose = () => {
        onClose?.();
        setState((state) => ({ ...state, active: false }));
      };

      return (
        <OverwriteConfirmDialogTunnel.In>
          <Dialog onCloseRequest={handleClose} title={false} size={916}>
            <div className="OverwriteConfirm">{children}</div>
          </Dialog>
        </OverwriteConfirmDialogTunnel.In>
      );
    },
  ),
  {
    Actions,
    Title,
    Description,
  },
);

export { OverwriteConfirmDialog };
