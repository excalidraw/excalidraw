import { VERSIONS } from "@excalidraw/common";

import { t } from "../i18n";

import type { ExcalidrawProps, UIAppState } from "../types";
import { t2 } from "../obsidianUtils";

const LibraryMenuBrowseButton = ({
  theme,
  id,
  libraryReturnUrl,
}: {
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
}) => {
  const referrer =
    libraryReturnUrl || window.location.origin + window.location.pathname;
  return ( //zsviczian added link to video about libraries
    <>
      <div>
        <a
          href="https://youtu.be/P_Q6avJGoWI?t=127"
          target="_blank"
          rel="noreferrer"
          style={{
            color: "var(--color-on-surface)",
            fontSize: ".75rem",
          }}
        >
          {t2("ABOUT_LIBRARIES")}
        </a>
      </div>
      <a
        className="library-menu-browse-button"
        href={`${import.meta.env.VITE_APP_LIBRARY_URL}?target=${
          window.name || "_blank"
        }&referrer=${referrer}&useHash=true&token=${id}&theme=${theme}&version=${
          VERSIONS.excalidrawLibrary
        }`}
        target="_excalidraw_libraries"
      >
        {t("labels.libraries")}
      </a>
    </>
  );
};

export default LibraryMenuBrowseButton;
