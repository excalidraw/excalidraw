import React from "react";
import { AppState } from "../types";
import { ActionManager } from "../actions/manager";
import { t, setLanguage } from "../i18n";
import Stack from "./Stack";
import { LanguageList } from "./LanguageList";
import { showSelectedShapeActions } from "../element";
import { ExcalidrawElement } from "../element/types";
import { FixedSideContainer } from "./FixedSideContainer";
import { Island } from "./Island";
import { HintViewer } from "./HintViewer";
import { calculateScrollCenter, getTargetElement } from "../scene";
import { SelectedShapeActions, ShapesSwitcher } from "./Actions";
import { Section } from "./Section";

type MobileMenuProps = {
  appState: AppState;
  actionManager: ActionManager;
  exportButton: React.ReactNode;
  setAppState: any;
  elements: readonly ExcalidrawElement[];
  setElements: any;
};

export function MobileMenu({
  appState,
  elements,
  setElements,
  actionManager,
  exportButton,
  setAppState,
}: MobileMenuProps) {
  return (
    <>
      {appState.openMenu === "canvas" ? (
        <Section className="App-mobile-menu" heading="canvasActions">
          <div className="App-mobile-menu-scroller panelColumn">
            <Stack.Col gap={4}>
              {actionManager.renderAction("loadScene")}
              {actionManager.renderAction("saveScene")}
              {exportButton}
              {actionManager.renderAction("clearCanvas")}
              {actionManager.renderAction("changeViewBackgroundColor")}
              <fieldset>
                <legend>{t("labels.language")}</legend>
                <LanguageList
                  onChange={lng => {
                    setLanguage(lng);
                    setAppState({});
                  }}
                />
              </fieldset>
            </Stack.Col>
          </div>
        </Section>
      ) : appState.openMenu === "shape" &&
        showSelectedShapeActions(appState, elements) ? (
        <Section className="App-mobile-menu" heading="selectedShapeActions">
          <div className="App-mobile-menu-scroller">
            <SelectedShapeActions
              targetElements={getTargetElement(
                appState.editingElement,
                elements,
              )}
              renderAction={actionManager.renderAction}
              elementType={appState.elementType}
            />
          </div>
        </Section>
      ) : null}
      <FixedSideContainer side="top">
        <Section heading="shapes">
          {heading => (
            <Stack.Col gap={4} align="center">
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
              </Stack.Row>
            </Stack.Col>
          )}
        </Section>
        <HintViewer
          elementType={appState.elementType}
          multiMode={appState.multiElement !== null}
          isResizing={appState.isResizing}
          elements={elements}
        />
      </FixedSideContainer>
      <footer className="App-toolbar">
        <div className="App-toolbar-content">
          {actionManager.renderAction("toggleCanvasMenu")}
          {actionManager.renderAction("toggleEditMenu")}
          {actionManager.renderAction("undo")}
          {actionManager.renderAction("redo")}
          {actionManager.renderAction("finalize")}
          {actionManager.renderAction("deleteSelectedElements")}
        </div>
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
}
