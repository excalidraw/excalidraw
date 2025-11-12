export const ExcalidrawPlusPromoBanner = ({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) => {
  if (isSignedIn) {
    return null;
  }

  const appUrl =
    import.meta.env.VITE_APP_PLUS_APP?.trim();

  if (!appUrl) {
    return null;
  }

  return (
    <a
      href={appUrl}
      target="_blank"
      rel="noopener"
      className="plus-banner"
    >
      EmbraceBoard
    </a>
  );
};
