import { t } from "../i18n";
import { Dialog, DialogProps } from "./Dialog";

import "./ConfirmDialog.scss";
import DialogActionButton from "./DialogActionButton";
import { isMenuOpenAtom } from "./App";
import { isDropdownOpenAtom } from "./App";
import { useSetAtom } from "jotai";

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

  const setIsMenuOpen = useSetAtom(isMenuOpenAtom);
  const setIsDropdownOpen = useSetAtom(isDropdownOpenAtom);

  return (
    <Dialog
      onCloseRequest={onCancel}
      small={true}
      {...rest}
      className={`confirm-dialog ${className}`}
    >
      {children}
      <div className="confirm-dialog-buttons">
        <DialogActionButton
          label={cancelText}
          onClick={() => {
            setIsMenuOpen(false);
            setIsDropdownOpen(false);
            onCancel();
          }}
        />
        <DialogActionButton
          label={confirmText}
          onClick={() => {
            setIsMenuOpen(false);
            setIsDropdownOpen(false);
            onConfirm();
          }}
          actionType="danger"
        />
      </div>
    </Dialog>
  );
};
export default ConfirmDialog;
