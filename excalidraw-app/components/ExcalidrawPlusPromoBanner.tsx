import { PlusPromoIcon } from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";

export const ExcalidrawPlusPromoBanner = ({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) => {
  const { t } = useI18n();
  return (
    <a
      href={
        isSignedIn
          ? import.meta.env.VITE_APP_PLUS_APP
          : `${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=guestBanner#excalidraw-redirect`
      }
      target="_blank"
      rel="noopener"
      className="plus-banner"
    >
      <span className="plus-banner__icon">{PlusPromoIcon}</span>
      <span className="plus-banner__text">
        <span className="plus-banner__title">
          {isSignedIn ? t("labels.signIn") : t("labels.tryExcalidrawPlus")}
        </span>
        {!isSignedIn && (
          <span className="plus-banner__subtitle">
            {t("labels.plusFreeTrial")}
          </span>
        )}
      </span>
    </a>
  );
};
