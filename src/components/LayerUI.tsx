import React from "react";
import { showSelectedShapeActions } from "../element";
import { calculateScrollCenter } from "../scene";
import { exportCanvas } from "../data";

import { AppState } from "../types";
import { ExcalidrawElement } from "../element/types";

import { ActionManager } from "../actions/manager";
import { Island } from "./Island";
import Stack from "./Stack";
import { FixedSideContainer } from "./FixedSideContainer";
import { LockIcon } from "./LockIcon";
import { ExportDialog, ExportCB } from "./ExportDialog";
import { LanguageList } from "./LanguageList";
import { t, languages, setLanguage } from "../i18n";
import { HintViewer } from "./HintViewer";
import useIsMobile from "../is-mobile";

import { ExportType } from "../scene/types";
import { MobileMenu } from "./MobileMenu";
import { ZoomActions, SelectedShapeActions, ShapesSwitcher } from "./Actions";
import { Section } from "./Section";
import { RoomDialog } from "./RoomDialog";
import { ErrorDialog } from "./ErrorDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { LoadingMessage } from "./LoadingMessage";

interface LayerUIProps {
  actionManager: ActionManager;
  appState: AppState;
  canvas: HTMLCanvasElement | null;
  setAppState: any;
  elements: readonly ExcalidrawElement[];
  setElements: (elements: readonly ExcalidrawElement[]) => void;
  onRoomCreate: () => void;
  onRoomDestroy: () => void;
  onLockToggle: () => void;
}

export const LayerUI = React.memo(
  ({
    actionManager,
    appState,
    setAppState,
    canvas,
    elements,
    setElements,
    onRoomCreate,
    onRoomDestroy,
    onLockToggle,
  }: LayerUIProps) => {
    const isMobile = useIsMobile();

    function renderExportDialog() {
      const createExporter = (type: ExportType): ExportCB => (
        exportedElements,
        scale,
      ) => {
        if (canvas) {
          exportCanvas(type, exportedElements, appState, canvas, {
            exportBackground: appState.exportBackground,
            name: appState.name,
            viewBackgroundColor: appState.viewBackgroundColor,
            scale,
          });
        }
      };
      return (
        <ExportDialog
          elements={elements}
          appState={appState}
          actionManager={actionManager}
          onExportToPng={createExporter("png")}
          onExportToSvg={createExporter("svg")}
          onExportToClipboard={createExporter("clipboard")}
          onExportToBackend={(exportedElements) => {
            if (canvas) {
              exportCanvas(
                "backend",
                exportedElements,
                {
                  ...appState,
                  selectedElementIds: {},
                },
                canvas,
                appState,
              );
            }
          }}
        />
      );
    }

    return isMobile ? (
      <MobileMenu
        appState={appState}
        elements={elements}
        setElements={setElements}
        actionManager={actionManager}
        exportButton={renderExportDialog()}
        setAppState={setAppState}
        onRoomCreate={onRoomCreate}
        onRoomDestroy={onRoomDestroy}
        onLockToggle={onLockToggle}
      />
    ) : (
      <>
        {appState.isLoading && <LoadingMessage />}
        {appState.errorMessage && (
          <ErrorDialog
            message={appState.errorMessage}
            onClose={() => setAppState({ errorMessage: null })}
          />
        )}
        {appState.showShortcutsDialog && (
          <ShortcutsDialog
            onClose={() => setAppState({ showShortcutsDialog: null })}
          />
        )}
        <FixedSideContainer side="top">
          <HintViewer appState={appState} elements={elements} />
          <div className="App-menu App-menu_top">
            <Stack.Col gap={4}>
              <Section heading="canvasActions">
                <Island padding={4}>
                  <Stack.Col gap={4}>
                    <Stack.Row gap={1} justifyContent={"space-between"}>
                      {actionManager.renderAction("loadScene")}
                      {actionManager.renderAction("saveScene")}
                      {renderExportDialog()}
                      {actionManager.renderAction("clearCanvas")}
                      <RoomDialog
                        isCollaborating={appState.isCollaborating}
                        collaboratorCount={appState.collaborators.size}
                        onRoomCreate={onRoomCreate}
                        onRoomDestroy={onRoomDestroy}
                      />
                    </Stack.Row>
                    {actionManager.renderAction("changeViewBackgroundColor")}
                  </Stack.Col>
                </Island>
              </Section>
              {showSelectedShapeActions(appState, elements) && (
                <Section heading="selectedShapeActions">
                  <Island className="App-menu__left" padding={4}>
                    <SelectedShapeActions
                      appState={appState}
                      elements={elements}
                      renderAction={actionManager.renderAction}
                      elementType={appState.elementType}
                    />
                  </Island>
                </Section>
              )}
            </Stack.Col>
            <Section heading="shapes">
              {(heading) => (
                <Stack.Col gap={4} align="start">
                  <Stack.Row gap={1}>
                    <Island padding={1}>
                      {heading}
                      <Stack.Row gap={1}>
                        <ShapesSwitcher
                          elementType={appState.elementType}
                          setAppState={setAppState}
                          setElements={setElements}
                          elements={elements}
                        />
                      </Stack.Row>
                    </Island>
                    <LockIcon
                      checked={appState.elementLocked}
                      onChange={onLockToggle}
                      title={t("toolBar.lock")}
                    />
                  </Stack.Row>
                </Stack.Col>
              )}
            </Section>
            <div />
          </div>
          <div className="App-menu App-menu_bottom">
            <Stack.Col gap={2}>
              <Section heading="canvasActions">
                <Island padding={1}>
                  <ZoomActions
                    renderAction={actionManager.renderAction}
                    zoom={appState.zoom}
                  />
                </Island>
              </Section>
            </Stack.Col>
          </div>
        </FixedSideContainer>
        <footer role="contentinfo">
          <LanguageList
            onChange={(lng) => {
              setLanguage(lng);
              setAppState({});
            }}
            languages={languages}
            floating
          />
          {appState.scrolledOutside && (
            <button
              className="scroll-back-to-content"
              onClick={() => {
                setAppState({ ...calculateScrollCenter(elements) });
              }}
            >
              {t("buttons.scrollBackToContent")}
            </button>
          )}
        </footer>
      </>
    );
  },
  (prev, next) => {
    const getNecessaryObj = (appState: AppState): Partial<AppState> => {
      const {
        draggingElement,
        resizingElement,
        multiElement,
        editingElement,
        isResizing,
        cursorX,
        cursorY,
        ...ret
      } = appState;
      return ret;
    };
    const prevAppState = getNecessaryObj(prev.appState);
    const nextAppState = getNecessaryObj(next.appState);

    const keys = Object.keys(prevAppState) as (keyof Partial<AppState>)[];

    return (
      prev.elements === next.elements &&
      keys.every((key) => prevAppState[key] === nextAppState[key])
    );
  },
);
