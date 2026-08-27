import { t } from "@excalidraw/excalidraw/i18n";

import "./SharedLinkDeferredNotice.scss";

type SharedLinkDeferredNoticeProps = {
  onSeeOptions: () => void;
  onDismiss: () => void;
};

export const SharedLinkDeferredNotice = ({
  onSeeOptions,
  onDismiss,
}: SharedLinkDeferredNoticeProps) => {
  return (
    <div className="shared-link-deferred-notice">
      <p className="shared-link-deferred-notice__text">
        {t("labels.sharedLinkDeferredNotice")}
      </p>
      <div className="shared-link-deferred-notice__actions">
        <button
          type="button"
          className="shared-link-deferred-notice__btn shared-link-deferred-notice__btn--primary"
          onClick={onSeeOptions}
        >
          {t("buttons.sharedLinkSeeOptions")}
        </button>
        <button
          type="button"
          className="shared-link-deferred-notice__btn"
          onClick={onDismiss}
        >
          {t("labels.sharedLinkDismiss")}
        </button>
      </div>
    </div>
  );
};
