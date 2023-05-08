import { LibraryItem, ExcalidrawProps, UIAppState } from "../types";
import LibraryMenuBrowseButton from "./LibraryMenuBrowseButton";
import { LibraryDropdownMenu } from "./LibraryMenuHeaderContent";

export const LibraryMenuControlButtons = ({
  selectedItems,
  onSelectItems,
  libraryReturnUrl,
  theme,
  id,
  style,
}: {
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
  style: React.CSSProperties;
}) => {
  return (
    <div className="library-menu-control-buttons" style={style}>
      <LibraryMenuBrowseButton
        id={id}
        libraryReturnUrl={libraryReturnUrl}
        theme={theme}
      />
      <LibraryDropdownMenu
        selectedItems={selectedItems}
        onSelectItems={onSelectItems}
      />
    </div>
  );
};
