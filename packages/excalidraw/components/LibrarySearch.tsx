import { CLASSES } from "../constants";
import { t } from "../i18n";
import { searchIcon } from "./icons";
import { TextField } from "./TextField";

const LibrarySearch = ({
  value,
  onSearch,
}: {
  value: string;
  onSearch: (query: string) => void;
}) => {
  return (
    <div className="library-menu-items-container__search">
      <TextField
        className={CLASSES.SEARCH_MENU_INPUT_WRAPPER}
        placeholder={t("library.searchPlaceholder")}
        onChange={(e) => onSearch(e)}
        value={value}
        icon={searchIcon}
        selectOnRender
      />
    </div>
  );
};

export default LibrarySearch;
