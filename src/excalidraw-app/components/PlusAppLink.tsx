import { COOKIES } from "../../constants";

export const isExcalidrawPlusSignedUser = document.cookie.includes(
  COOKIES.AUTH_STATE_COOKIE,
);

const PlusAppLink = () => {
  return (
    <a
      href={`${process.env.REACT_APP_PLUS_APP}/#excalidraw-redirect`}
      target="_blank"
      rel="noreferrer"
      className="plus-button"
    >
      Go to Excalidraw+
    </a>
  );
};

export default PlusAppLink;
