import { useI18n } from "@excalidraw/excalidraw/i18n";

import type { AuthUser } from "../auth";

import "./AuthDialog.scss";

type AuthDialogProps = {
  isOpen: boolean;
  user: AuthUser | null;
  onLogin: () => void;
  onLogout: () => void;
  onClose: () => void;
};

export const AuthDialog = ({
  isOpen,
  user,
  onLogin,
  onLogout,
  onClose,
}: AuthDialogProps) => {
  const { t } = useI18n();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="auth-dialog-backdrop" role="presentation">
      <div className="auth-dialog excalifont" role="dialog" aria-modal="true">
        <button
          type="button"
          className="auth-dialog__close"
          aria-label={t("buttons.close")}
          onClick={onClose}
        >
          ×
        </button>
        {user ? (
          <>
            <h2 className="auth-dialog__title">
              {t("authDialog.signedInTitle")}
            </h2>
            <p>
              {t("authDialog.signedInAs", {
                nickname: user.nickname,
              })}
            </p>
            <button
              type="button"
              className="auth-dialog__button"
              onClick={onLogout}
            >
              {t("authDialog.logout")}
            </button>
          </>
        ) : (
          <>
            <h2 className="auth-dialog__title">{t("authDialog.loginTitle")}</h2>
            <p>{t("authDialog.loginDescription")}</p>
            <button
              type="button"
              className="auth-dialog__button"
              onClick={onLogin}
            >
              {t("authDialog.loginWithQQ")}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
