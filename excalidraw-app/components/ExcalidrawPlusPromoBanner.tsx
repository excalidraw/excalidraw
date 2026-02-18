const VITE_APP_PLUS_APP = import.meta.env.VITE_APP_PLUS_APP;
const VITE_APP_PLUS_LP = import.meta.env.VITE_APP_PLUS_LP;

export const ExcalidrawPlusPromoBanner = ({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) => {
  return (
    <a
      href={
        isSignedIn
          ? VITE_APP_PLUS_APP
          : `${VITE_APP_PLUS_LP}/plus?utm_source=excalidraw&utm_medium=app&utm_content=guestBanner#excalidraw-redirect`
      }
      target="_blank"
      rel="noopener"
      className="plus-banner"
    >
      Excalidraw+
    </a>
  );
};
