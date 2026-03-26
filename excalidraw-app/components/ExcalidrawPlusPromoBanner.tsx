export const ExcalidrawPlusPromoBanner = ({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) => {
  return (
    <a
      href={
        isSignedIn
          ? (window.EXCALIDRAW_ENV?.VITE_APP_PLUS_APP || import.meta.env.VITE_APP_PLUS_APP)
          : `${
              (window.EXCALIDRAW_ENV?.VITE_APP_PLUS_LP || import.meta.env.VITE_APP_PLUS_LP)
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=guestBanner#excalidraw-redirect`
      }
      target="_blank"
      rel="noopener"
      className="plus-banner"
    >
      Excalidraw+
    </a>
  );
};
