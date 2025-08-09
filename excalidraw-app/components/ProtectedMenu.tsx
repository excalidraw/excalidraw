import { MainMenu } from "@excalidraw/excalidraw/index";
import { ExcalLogo } from "@excalidraw/excalidraw/components/icons";

import { deleteAuthToken } from "excalidraw-app/data/localStorage";
import { signOut } from "excalidraw-app/data/ranggaApi";

import { useUserStore } from "../stores/useUserStore";

export const ProtectedMenu: React.FC = () => {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const setLoggedOut = useUserStore((state) => state.setLoggedOut);
  const email = useUserStore((state) => state.email);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState({}, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const onLogout = async (e: React.MouseEvent) => {
    e.preventDefault();

    try {
      await signOut();

      deleteAuthToken();
      setLoggedOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!isLoggedIn) {
    return (
      <MainMenu.ItemLink
        icon={ExcalLogo}
        className=""
        href="/login"
        onClick={handleClick}
      >
        Login
      </MainMenu.ItemLink>
    );
  }
  return (
    <>
      <p style={{ fontSize: 14 }}>Hi {email}</p>
      <MainMenu.ItemLink
        icon={ExcalLogo}
        className=""
        href="#"
        onClick={onLogout}
      >
        Log out
      </MainMenu.ItemLink>
    </>
  );
};
