import { EDITOR_LS_KEYS } from "../constants";
import { t } from "../i18n";
import { getDateTime } from "../utils";
import { EditorLocalStorage } from "./EditorLocalStorage";

export const getFileName = () => {
  return (
    EditorLocalStorage.get<string>(EDITOR_LS_KEYS.EXCALIDRAW_FILE_NAME) ||
    `${t("labels.untitled")}-${getDateTime()}`
  );
};
