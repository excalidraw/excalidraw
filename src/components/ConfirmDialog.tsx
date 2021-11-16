import { t } from "../i18n";
import { Dialog } from "./Dialog";
import { ToolButton } from "./ToolButton";

import "./ConfirmDialog.scss";

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  className?: string;
}
const ConfirmDialog = (props: Props) => {
  const {
    onConfirm,
    onCancel,
    title,
    children,
    confirmText = t("buttons.confirm"),
    cancelText = t("buttons.cancel"),
    className = "",
    ...rest
  } = props;
  return (
    <Dialog
      onCloseRequest={onCancel}
      title={title}
      small={true}
      {...rest}
      className={`confirm-dialog ${className}`}
    >
      {children}
      <div className="confirm-dialog-buttons">
        <ToolButton
          type="button"
          title={cancelText}
          aria-label={cancelText}
          label={cancelText}
          onClick={onCancel}
          className="confirm-dialog--cancel"
        />
        <ToolButton
          type="button"
          title={confirmText}
          aria-label={confirmText}
          label={confirmText}
          onClick={onConfirm}
          className="confirm-dialog--confirm"
        />
      </div>
    </Dialog>
  );
};
export default ConfirmDialog;
