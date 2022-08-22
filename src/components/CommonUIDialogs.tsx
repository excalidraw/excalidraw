import { NonDeletedExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { ErrorDialog } from "./ErrorDialog";
import { HelpDialog } from "./HelpDialog";
import { LoadingMessage } from "./LoadingMessage";
import { PasteChartDialog } from "./PasteChartDialog";

const CommonUIDialogs = ({
  appState,
  setAppState,
  onInsertElements,
}: {
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
  onInsertElements: (elements: readonly NonDeletedExcalidrawElement[]) => void;
}) => {
  return (
    <>
      {appState.isLoading && <LoadingMessage delay={250} />}
      {appState.errorMessage && (
        <ErrorDialog
          message={appState.errorMessage}
          onClose={() => setAppState({ errorMessage: null })}
        />
      )}
      {appState.showHelpDialog && (
        <HelpDialog
          onClose={() => {
            setAppState({ showHelpDialog: false });
          }}
        />
      )}
      {appState.pasteDialog.shown && (
        <PasteChartDialog
          setAppState={setAppState}
          appState={appState}
          onInsertChart={onInsertElements}
          onClose={() =>
            setAppState({
              pasteDialog: { shown: false, data: null },
            })
          }
        />
      )}
    </>
  );
};

export default CommonUIDialogs;
