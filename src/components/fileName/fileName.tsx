import { useExcalidrawActionManager } from "../App";
import { actionSaveToActiveFile } from "../../actions";
function FileName(props: any) {
  const actionManager = useExcalidrawActionManager();
  return (
    <>
      <span onClick={() => actionManager.executeAction(actionSaveToActiveFile)}>
        <b>{props.name.slice(0, -11)}</b>
      </span>
    </>
  );
}

export default FileName;
