import { t } from "../i18n";
import { Dialog, DialogProps } from "./Dialog";

import "./ConfirmDialog.scss";
import DialogActionButton from "./DialogActionButton";

interface Props extends Omit<DialogProps, "onCloseRequest"> {
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}
const ConfirmDialog = (props: Props) => {
  const {
    onConfirm,
    onCancel,
    children,
    confirmText = t("buttons.confirm"),
    cancelText = t("buttons.cancel"),
    className = "",
    ...rest
  } = props;
  return (
    <Dialog
      onCloseRequest={onCancel}
      small={true}
      {...rest}
      className={`confirm-dialog ${className}`}
    >
      {children}
      <div className="confirm-dialog-buttons">
        <DialogActionButton label={cancelText} onClick={onCancel} />
        <DialogActionButton
          label={confirmText}
          onClick={onConfirm}
          actionType="danger"
        />
      </div>
    </Dialog>
  );
};
export default ConfirmDialog;
