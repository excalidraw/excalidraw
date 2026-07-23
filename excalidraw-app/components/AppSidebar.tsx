import { DefaultSidebar, Sidebar, THEME } from "@excalidraw/excalidraw";
import {
  messageCircleIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { LinkButton } from "@excalidraw/excalidraw/components/LinkButton";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

import "./AppSidebar.scss";

type SidebarPromoCopyProps = {
  text: string;
};

const SidebarPromoCopy = (props: SidebarPromoCopyProps) => {
  return (
    <div className="app-sidebar-promo-copy">
      <div className="app-sidebar-promo-illustration" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 300 250"
          className="app-sidebar-promo-heart"
        >
          <path
            d="M 145 75
           C 110 35, 60 55, 65 120
           C 70 180, 140 190, 215 200
           C 225 180, 260 110, 235 55
           C 210 -5, 140 20, 160 105"
            fill="none"
            stroke="#D06B64"
            strokeWidth="16"
            strokeLinecap="round"
          />
        </svg>

        <div className="app-sidebar-promo-trial-note excalifont">
          14 days of
          <br />
          free trial
        </div>
        <svg
          className="app-sidebar-promo-trial-arrow"
          viewBox="0 0 72 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 6C23 1 50 8 48 32"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M42 26L48 32L54 26"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="app-sidebar-promo-text">{props.text}</div>
    </div>
  );
};

export const AppSidebar = () => {
  const { theme, openSidebar } = useUIAppState();

  return (
    <DefaultSidebar>
    </DefaultSidebar>
  );
};
