import { useI18n } from "@excalidraw/excalidraw/i18n";

const SparkleIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 20 20"
    className="plus-banner__icon"
  >
    <path
      fill="currentColor"
      d="M8.5 2.5c.48 3.96 2.04 5.52 6 6-3.96.48-5.52 2.04-6 6-.48-3.96-2.04-5.52-6-6 3.96-.48 5.52-2.04 6-6Z"
    />
    <path
      fill="currentColor"
      d="M15.5 12c.22 1.81.94 2.53 2.75 2.75-1.81.22-2.53.94-2.75 2.75-.22-1.81-.94-2.53-2.75-2.75 1.81-.22 2.53-.94 2.75-2.75Z"
    />
  </svg>
);

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
      {SparkleIcon}
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
