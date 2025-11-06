export const ExcalidrawPlusPromoBanner = ({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) => {
  return (
    <a
      href={`${
        isSignedIn
          ? import.meta.env.VITE_APP_PLUS_LP
          : import.meta.env.VITE_APP_PLUS_APP
      }/plus?utm_source=excalidraw&utm_medium=app&utm_content=${
        isSignedIn ? "signedInBanner" : "guestBanner"
      }#excalidraw-redirect`}
      target="_blank"
      rel="noopener"
      className="plus-banner"
    >
      Excalidraw+
    </a>
  );
};
