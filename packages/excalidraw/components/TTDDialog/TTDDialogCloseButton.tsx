import { Button } from "../Button";
import { CloseIcon } from "../icons";
import { t } from "../../i18n";

interface TTDDialogCloseButtonProps {
  onClose: () => void;
}

export const TTDDialogCloseButton = ({
  onClose,
}: TTDDialogCloseButtonProps) => {
  return (
    <Button
      className="ttd-dialog-close"
      onSelect={onClose}
      aria-label={t("buttons.close")}
      data-testid="ttd-dialog-close"
    >
      {CloseIcon}
    </Button>
  );
};