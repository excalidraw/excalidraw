import clsx from "clsx";

import LibraryMenuBrowseButton from "./LibraryMenuBrowseButton";

import type { ExcalidrawProps, UIAppState } from "../types";
import type Library from "../data/library";

export const LibraryMenuControlButtons = ({
  libraryReturnUrl,
  theme,
  id,
  style,
  children,
  className,
  library,
}: {
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
  style: React.CSSProperties;
  children?: React.ReactNode;
  className?: string;
  library: Library;
}) => {
  return (
    <div
      className={clsx("library-menu-control-buttons", className)}
      style={style}
    >
      <LibraryMenuBrowseButton
        id={id}
        libraryReturnUrl={libraryReturnUrl}
        theme={theme}
        library={library}
      />
      {children}
    </div>
  );
};
