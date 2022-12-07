import { COOKIES } from "../../constants";

export const isExcalidrawPlusSignedUser = document.cookie.includes(
  COOKIES.AUTH_STATE_COOKIE,
);

const ExcalidrawPlusAppLink = () => {
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

export default ExcalidrawPlusAppLink;
