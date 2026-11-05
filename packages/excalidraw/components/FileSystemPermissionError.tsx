import { t } from "../i18n";

export const FileSystemPermissionError = () => (
  <div className="FileSystemPermissionError">
    <p>{t("errors.fileSystemPermission.description")}</p>

    <ol>
      <li>{t("errors.fileSystemPermission.step1")}</li>
      <li>{t("errors.fileSystemPermission.step2")}</li>
      <li>{t("errors.fileSystemPermission.step3")}</li>
      <li>{t("errors.fileSystemPermission.step4")}</li>
    </ol>

    <p>{t("errors.fileSystemPermission.adminNote")}</p>
  </div>
);
