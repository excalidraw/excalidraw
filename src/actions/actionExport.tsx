import React, { useState } from "react";
import { EVENT_CHANGE, EVENT_IO, trackEvent } from "../analytics";
import { load, save, saveAs } from "../components/icons";
import { ProjectName } from "../components/ProjectName";
import { ToolButton } from "../components/ToolButton";
import { Tooltip } from "../components/Tooltip";
import { questionCircle } from "../components/icons";
import { loadFromJSON, saveAsJSON } from "../data";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { KEYS } from "../keys";
import { muteFSAbortError, nFormatter } from "../utils";
import { register } from "./register";
import "../components/ToolIcon.scss";
import { serializeAsJSON } from "../data/json";

export const actionChangeProjectName = register({
  name: "changeProjectName",
  perform: (_elements, appState, value) => {
    trackEvent(EVENT_CHANGE, "title");
    return { appState: { ...appState, name: value }, commitToHistory: false };
  },
  PanelComponent: ({ appState, updateData }) => (
    <ProjectName
      label={t("labels.fileTitle")}
      value={appState.name || "Unnamed"}
      onChange={(name: string) => updateData(name)}
    />
  ),
});

export const actionChangeExportBackground = register({
  name: "changeExportBackground",
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportBackground: value },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <label>
      <input
        type="checkbox"
        checked={appState.exportBackground}
        onChange={(event) => updateData(event.target.checked)}
      />{" "}
      {t("labels.withBackground")}
    </label>
  ),
});

export const actionChangeExportEmbedScene = register({
  name: "changeExportEmbedScene",
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportEmbedScene: value },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => {
    const [increasedPngSize, setPngIncreasedSize] = useState(0);
    const [increasedSvgSize, setSvgIncreasedSize] = useState(0);

    if (appState.exportEmbedScene) {
      import(/* webpackChunkName: "image" */ "../data/image").then(
        async (_) => {
          const incPng = await _.getPngMetatdataSize({
            metadata: serializeAsJSON(elements, appState),
          });
          setPngIncreasedSize(incPng);

          const incSvg = await _.getSvgMetatdataSize({
            text: serializeAsJSON(elements, appState),
          });
          setSvgIncreasedSize(incSvg);
        },
      );
    }

    return (
      <label style={{ display: "flex" }}>
        <input
          type="checkbox"
          checked={appState.exportEmbedScene}
          onChange={(event) => updateData(event.target.checked)}
        />{" "}
        {t("labels.exportEmbedScene")}
        {appState.exportEmbedScene && (
          <Tooltip
            label={`PNG: ${nFormatter(increasedPngSize, 1)}, SVG: ${nFormatter(
              increasedSvgSize,
              1,
            )}`}
            position="above"
          >
            {
              <div style={{ color: "gray", paddingLeft: 3 }}>
                {`(Avg: ${nFormatter(
                  (increasedPngSize + increasedSvgSize) / 2,
                  1,
                )})`}
              </div>
            }
          </Tooltip>
        )}
        <Tooltip
          label={t("labels.exportEmbedScene_details")}
          position="above"
          long={true}
        >
          <div className="TooltipIcon">{questionCircle}</div>
        </Tooltip>
      </label>
    );
  },
});

export const actionChangeShouldAddWatermark = register({
  name: "changeShouldAddWatermark",
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, shouldAddWatermark: value },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <label>
      <input
        type="checkbox"
        checked={appState.shouldAddWatermark}
        onChange={(event) => updateData(event.target.checked)}
      />{" "}
      {t("labels.addWatermark")}
    </label>
  ),
});

export const actionSaveScene = register({
  name: "saveScene",
  perform: async (elements, appState, value) => {
    try {
      const { fileHandle } = await saveAsJSON(elements, appState);
      trackEvent(EVENT_IO, "save");
      return { commitToHistory: false, appState: { ...appState, fileHandle } };
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
      }
      return { commitToHistory: false };
    }
  },
  keyTest: (event) =>
    event.key === KEYS.S && event[KEYS.CTRL_OR_CMD] && !event.shiftKey,
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={save}
      title={t("buttons.save")}
      aria-label={t("buttons.save")}
      showAriaLabel={useIsMobile()}
      onClick={() => updateData(null)}
    />
  ),
});

export const actionSaveAsScene = register({
  name: "saveAsScene",
  perform: async (elements, appState, value) => {
    try {
      const { fileHandle } = await saveAsJSON(elements, {
        ...appState,
        fileHandle: null,
      });
      trackEvent(EVENT_IO, "save as");
      return { commitToHistory: false, appState: { ...appState, fileHandle } };
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
      }
      return { commitToHistory: false };
    }
  },
  keyTest: (event) =>
    event.key === KEYS.S && event.shiftKey && event[KEYS.CTRL_OR_CMD],
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={saveAs}
      title={t("buttons.saveAs")}
      aria-label={t("buttons.saveAs")}
      showAriaLabel={useIsMobile()}
      hidden={
        !("chooseFileSystemEntries" in window || "showOpenFilePicker" in window)
      }
      onClick={() => updateData(null)}
    />
  ),
});

export const actionLoadScene = register({
  name: "loadScene",
  perform: (
    elements,
    appState,
    { elements: loadedElements, appState: loadedAppState, error },
  ) => ({
    elements: loadedElements,
    appState: {
      ...loadedAppState,
      errorMessage: error,
    },
    commitToHistory: true,
  }),
  PanelComponent: ({ updateData, appState }) => (
    <ToolButton
      type="button"
      icon={load}
      title={t("buttons.load")}
      aria-label={t("buttons.load")}
      showAriaLabel={useIsMobile()}
      onClick={() => {
        loadFromJSON(appState)
          .then(({ elements, appState }) => {
            updateData({ elements, appState });
          })
          .catch(muteFSAbortError)
          .catch((error) => {
            updateData({ error: error.message });
          });
      }}
    />
  ),
});
