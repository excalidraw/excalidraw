import { isExcalidrawPlusSignedUser } from "../../constants";

export const ExcalidrawPlusAppLink = () => {
  if (!isExcalidrawPlusSignedUser) {
    return null;
  }
  return (
    <a
      href={`${process.env.REACT_APP_PLUS_APP}?utm_source=excalidraw&utm_medium=app&utm_content=signedInUserRedirectButton#excalidraw-redirect`}
      target="_blank"
      rel="noreferrer"
      className="plus-button"
    >
      Go to Excalidraw+
    </a>
  );
};
