import { file } from "./icons";

export function FileName({
  fileHandle,
}: {
  fileHandle: import("browser-fs-access").FileSystemHandle;
}) {
  return (
    <span className="App-menu_file-name">
      {file}
      {fileHandle.name}
    </span>
  );
}
