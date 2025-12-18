import { VERSIONS } from "@excalidraw/common";

import { t } from "../i18n";

import type { ExcalidrawProps, UIAppState } from "../types";

const LIBRARY_URL_SCHEME = "excalidraw";

/**
 * Check if running on Capacitor native platform (Android/iOS)
 * We use dynamic check since Capacitor may not be available in all builds
 */
const isCapacitorNative = (
  libraryReturnUrl?: ExcalidrawProps["libraryReturnUrl"],
): boolean => {
  if (libraryReturnUrl?.startsWith(`${LIBRARY_URL_SCHEME}://`)) {
    return true;
  }
  try {
    const Capacitor = (window as any).Capacitor;
    return Capacitor?.isNativePlatform?.() ?? false;
  } catch {
    return false;
  }
};

/**
 * Open URL in Capacitor's in-app browser (Chrome Custom Tabs on Android)
 * Returns true if successful, false if Capacitor Browser is not available
 */
const openInAppBrowser = async (url: string): Promise<boolean> => {
  try {
    // Dynamically import Capacitor Browser to avoid build issues on web
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({
      url,
      windowName: "_blank",
      presentationStyle: "popover",
    });
    return true;
  } catch (error) {
    console.warn(
      "Capacitor Browser not available, falling back to default behavior:",
      error,
    );
    return false;
  }
};

import { LibraryBrowser } from "./LibraryBrowser";
import type Library from "../data/library";
import { useState } from "react";

const LibraryMenuBrowseButton = ({
  theme,
  id,
  libraryReturnUrl,
  library,
}: {
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
  library: Library;
}) => {
  const [showLibraryBrowser, setShowLibraryBrowser] = useState(false);
  const referrer =
    libraryReturnUrl || window.location.origin + window.location.pathname;

  const isNative = isCapacitorNative(libraryReturnUrl);

  const libraryUrl = `${import.meta.env.VITE_APP_LIBRARY_URL}?target=${isNative ? "_blank" : window.name || "_blank"
    }&referrer=${encodeURIComponent(referrer)}&useHash=true&token=${id}&theme=${theme
    }&version=${VERSIONS.excalidrawLibrary}`;

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    // On native platforms, open the in-app library browser
    if (isNative) {
      e.preventDefault();
      setShowLibraryBrowser(true);
    }
    // On web, let the default anchor behavior work
  };

  return (
    <>
      <a
        className="library-menu-browse-button"
        href={libraryUrl}
        target={isNative ? "_blank" : "_excalidraw_libraries"}
        onClick={handleClick}
      >
        {t("labels.libraries")}
      </a>
      {showLibraryBrowser && (
        <LibraryBrowser
          onClose={() => setShowLibraryBrowser(false)}
          library={library}
          theme={theme}
        />
      )}
    </>
  );
};

export default LibraryMenuBrowseButton;
