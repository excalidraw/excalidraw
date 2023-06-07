import React from "react";
import { useAtom } from "jotai";

import { useTunnels } from "../../context/tunnels";
import { Dialog } from "../Dialog";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { overwriteConfirmState } from "./state";

import { Actions } from "./Actions";
import { jotaiScope } from "../../jotai";

import "./OverwriteConfirm.scss";
import { FilledButton } from "../FilledButton";
import { alertTriangleIcon } from "../icons";

export type OverwriteConfirmDialogProps = {
  children: React.ReactNode;
};

const Title = () => {
  const [{ title }] = useAtom(overwriteConfirmState, jotaiScope);

  return <h3>{title}</h3>;
};

const Description = () => {
  const [{ description, actionLabel, onConfirm }, setState] = useAtom(
    overwriteConfirmState,
    jotaiScope,
  );

  const handleConfirm = () => {
    setState((state) => ({ ...state, active: false }));
    onConfirm?.();
  };

  return (
    <div className="OverwriteConfirm__Description">
      <div className="OverwriteConfirm__Description__icon">
        {alertTriangleIcon}
      </div>
      <div>{description}</div>
      <FilledButton
        color="danger"
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
          <Dialog onCloseRequest={handleClose} title={false}>
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
