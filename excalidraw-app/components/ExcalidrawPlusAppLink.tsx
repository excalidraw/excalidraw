import { isExcalidrawPlusSignedUser } from "../app_constants";

export const ExcalidrawPlusAppLink = () => {
  if (!isExcalidrawPlusSignedUser) {
    return null;
  }
  return (
    <a
      href={`${
        import.meta.env.VITE_APP_PLUS_APP
      }?utm_source=excalidraw&utm_medium=app&utm_content=signedInUserRedirectButton#excalidraw-redirect`}
      target="_blank"
      rel="noopener"
      className="plus-button"
    >
      Go to Excalidraw+
    </a>
  );
};
