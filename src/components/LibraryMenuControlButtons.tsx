import { ExcalidrawProps, UIAppState } from "../types";
import LibraryMenuBrowseButton from "./LibraryMenuBrowseButton";

export const LibraryMenuControlButtons = ({
  libraryReturnUrl,
  theme,
  id,
  style,
  children,
}: {
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
  style: React.CSSProperties;
  children?: React.ReactNode;
}) => {
  return (
    <div className="library-menu-control-buttons" style={style}>
      <LibraryMenuBrowseButton
        id={id}
        libraryReturnUrl={libraryReturnUrl}
        theme={theme}
      />
      {children}
    </div>
  );
};
