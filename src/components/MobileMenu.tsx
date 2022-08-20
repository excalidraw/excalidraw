import React from "react";
import { AppState } from "../types";
import { ActionManager } from "../actions/manager";
import { t } from "../i18n";
import Stack from "./Stack";
import { showSelectedShapeActions } from "../element";
import { FixedSideContainer } from "./FixedSideContainer";
import { Island } from "./Island";
import { HintViewer } from "./HintViewer";
import { calculateScrollCenter, getSelectedElements } from "../scene";
import { SelectedShapeActions, ShapesSwitcher } from "./Actions";
import { Section } from "./Section";
import CollabButton from "./CollabButton";
import { SCROLLBAR_WIDTH, SCROLLBAR_MARGIN } from "../scene/scrollbars";
import { LockButton } from "./LockButton";
import { UserList } from "./UserList";
import { BackgroundPickerAndDarkModeToggle } from "./BackgroundPickerAndDarkModeToggle";
import { LibraryButton } from "./LibraryButton";
import { PenModeButton } from "./PenModeButton";
import { useExcalidrawElements, useExcalidrawState } from "./App";

type MobileMenuProps = {
  actionManager: ActionManager;
  renderJSONExportDialog: () => React.ReactNode;
  renderImageExportDialog: () => React.ReactNode;
  setAppState: React.Component<any, AppState>["setState"];
  libraryMenu: JSX.Element | null;
  onCollabButtonClick?: () => void;
  onLockToggle: () => void;
  onPenModeToggle: () => void;
  canvas: HTMLCanvasElement | null;
  isCollaborating: boolean;
  renderCustomFooter?: (
    isMobile: boolean,
    appState: AppState,
  ) => JSX.Element | null;
  showThemeBtn: boolean;
  onImageAction: (data: { insertOnCanvasDirectly: boolean }) => void;
  renderTopRightUI?: (
    isMobile: boolean,
    appState: AppState,
  ) => JSX.Element | null;
  renderStats: () => JSX.Element | null;
};

export const MobileMenu = ({
  libraryMenu,
  actionManager,
  renderJSONExportDialog,
  renderImageExportDialog,
  setAppState,
  onCollabButtonClick,
  onLockToggle,
  onPenModeToggle,
  canvas,
  isCollaborating,
  renderCustomFooter,
  showThemeBtn,
  onImageAction,
  renderTopRightUI,
  renderStats,
}: MobileMenuProps) => {
  const appState = useExcalidrawState();
  const elements = useExcalidrawElements();

  const renderToolbar = () => {
    return (
      <FixedSideContainer side="top" className="App-top-bar">
        <Section heading="shapes">
          {(heading: React.ReactNode) => (
            <Stack.Col gap={4} align="center">
              <Stack.Row gap={1} className="App-toolbar-container">
                <Island padding={1} className="App-toolbar">
                  {heading}
                  <Stack.Row gap={1}>
                    <ShapesSwitcher
                      appState={appState}
                      canvas={canvas}
                      activeTool={appState.activeTool}
                      setAppState={setAppState}
                      onImageAction={({ pointerType }) => {
                        onImageAction({
                          insertOnCanvasDirectly: pointerType !== "mouse",
                        });
                      }}
                    />
                  </Stack.Row>
                </Island>
                {renderTopRightUI && renderTopRightUI(true, appState)}
                <LockButton
                  checked={appState.activeTool.locked}
                  onChange={onLockToggle}
                  title={t("toolBar.lock")}
                  isMobile
                />
                <LibraryButton
                  appState={appState}
                  setAppState={setAppState}
                  isMobile
                />
                <PenModeButton
                  checked={appState.penMode}
                  onChange={onPenModeToggle}
                  title={t("toolBar.penMode")}
                  isMobile
                  penDetected={appState.penDetected}
                />
              </Stack.Row>
              {libraryMenu}
            </Stack.Col>
          )}
        </Section>
        <HintViewer appState={appState} elements={elements} isMobile={true} />
      </FixedSideContainer>
    );
  };

  const renderAppToolbar = () => {
    // Render eraser conditionally in mobile
    const showEraser =
      !appState.viewModeEnabled &&
      !appState.editingElement &&
      getSelectedElements(elements, appState).length === 0;

    if (appState.viewModeEnabled) {
      return (
        <div className="App-toolbar-content">
          {actionManager.renderAction("toggleCanvasMenu")}
        </div>
      );
    }

    return (
      <div className="App-toolbar-content">
        {actionManager.renderAction("toggleCanvasMenu")}
        {actionManager.renderAction("toggleEditMenu")}

        {actionManager.renderAction("undo")}
        {actionManager.renderAction("redo")}
        {showEraser && actionManager.renderAction("eraser")}

        {actionManager.renderAction(
          appState.multiElement ? "finalize" : "duplicateSelection",
        )}
        {actionManager.renderAction("deleteSelectedElements")}
      </div>
    );
  };

  const renderCanvasActions = () => {
    if (appState.viewModeEnabled) {
      return (
        <>
          {renderJSONExportDialog()}
          {renderImageExportDialog()}
        </>
      );
    }
    return (
      <>
        {actionManager.renderAction("clearCanvas")}
        {actionManager.renderAction("loadScene")}
        {renderJSONExportDialog()}
        {renderImageExportDialog()}
        {onCollabButtonClick && (
          <CollabButton
            isCollaborating={isCollaborating}
            collaboratorCount={appState.collaborators.size}
            onClick={onCollabButtonClick}
          />
        )}
        {
          <BackgroundPickerAndDarkModeToggle
            actionManager={actionManager}
            appState={appState}
            setAppState={setAppState}
            showThemeBtn={showThemeBtn}
          />
        }
      </>
    );
  };
  return (
    <>
      {!appState.viewModeEnabled && renderToolbar()}
      {renderStats()}
      <div
        className="App-bottom-bar"
        style={{
          marginBottom: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN * 2,
          marginLeft: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN * 2,
          marginRight: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN * 2,
        }}
      >
        <Island padding={0}>
          {appState.openMenu === "canvas" ? (
            <Section className="App-mobile-menu" heading="canvasActions">
              <div className="panelColumn">
                <Stack.Col gap={4}>
                  {renderCanvasActions()}
                  {renderCustomFooter?.(true, appState)}
                  {appState.collaborators.size > 0 && (
                    <fieldset>
                      <legend>{t("labels.collaborators")}</legend>
                      <UserList
                        mobile
                        collaborators={appState.collaborators}
                        actionManager={actionManager}
                      />
                    </fieldset>
                  )}
                </Stack.Col>
              </div>
            </Section>
          ) : appState.openMenu === "shape" &&
            !appState.viewModeEnabled &&
            showSelectedShapeActions(appState, elements) ? (
            <Section className="App-mobile-menu" heading="selectedShapeActions">
              <SelectedShapeActions
                appState={appState}
                elements={elements}
                renderAction={actionManager.renderAction}
              />
            </Section>
          ) : null}
          <footer className="App-toolbar">
            {renderAppToolbar()}
            {appState.scrolledOutside &&
              !appState.openMenu &&
              !appState.isLibraryOpen && (
                <button
                  className="scroll-back-to-content"
                  onClick={() => {
                    setAppState({
                      ...calculateScrollCenter(elements, appState, canvas),
                    });
                  }}
                >
                  {t("buttons.scrollBackToContent")}
                </button>
              )}
          </footer>
        </Island>
      </div>
    </>
  );
};
