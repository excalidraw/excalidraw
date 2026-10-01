import { getSingleSelectedFrame } from "../../actions/actionFrame";
import { t } from "../../i18n";
import { useExcalidrawAppState } from "../App";
import { RadioSelection } from "../RadioSelection";
import DimensionDragInput from "../Stats/Dimension";
import { createScreenIcon } from "../icons";

import {
  DEVICE_PRESETS,
  isFramePortrait,
  matchesFramePreset,
  orientFrameSize,
  SCREEN_PRESETS,
} from "./framePresets";

import "./FrameSizePanel.scss";

import type { FramePreset, FrameSize } from "./framePresets";
import type { AppClassProperties } from "../../types";

const PRESET_ICONS = new Map(
  [...SCREEN_PRESETS, ...DEVICE_PRESETS].map((preset) => [
    preset.name,
    createScreenIcon(preset.width, preset.height, preset.device),
  ]),
);

const landscapeIcon = createScreenIcon(16, 11);
const portraitIcon = createScreenIcon(11, 16);

export const FrameSizePanel = ({
  app,
  onChange,
}: {
  app: AppClassProperties;
  onChange: (size: FrameSize) => void;
}) => {
  // full AppState — the dimension inputs are shared with the Stats panel
  const appState = useExcalidrawAppState();
  // with the frame tool active, presets insert a new frame instead
  const frame =
    appState.activeTool.type === "frame"
      ? null
      : getSingleSelectedFrame(appState, app);
  const portrait = !!frame && isFramePortrait(frame);

  const renderPresets = (presets: readonly FramePreset[]) => (
    <div className="buttonList">
      <RadioSelection
        type="button"
        value={
          (frame && presets.find((preset) => matchesFramePreset(frame, preset)))
            ?.name ?? null
        }
        options={presets.map((preset) => ({
          value: preset.name,
          text: t("frameSize.presetTooltip", {
            name: t(`frameSize.presets.${preset.name}`),
            width: preset.width,
            height: preset.height,
          }),
          icon: PRESET_ICONS.get(preset.name)!,
          testId: `frame-preset-${preset.name}`,
        }))}
        onClick={(name) => {
          const preset = presets.find((preset) => preset.name === name)!;
          // a selected frame keeps its orientation
          onChange(frame ? orientFrameSize(preset, portrait) : preset);
        }}
      />
    </div>
  );

  return (
    <>
      <fieldset className="frame-size-panel">
        <legend>
          {frame ? t("frameSize.title") : t("frameSize.addFrame")}
        </legend>
        {renderPresets(SCREEN_PRESETS)}
        {renderPresets(DEVICE_PRESETS)}
        {frame && (
          <div className="frame-size-panel__dimensions">
            <DimensionDragInput
              property="width"
              element={frame}
              scene={app.scene}
              appState={appState}
            />
            <DimensionDragInput
              property="height"
              element={frame}
              scene={app.scene}
              appState={appState}
            />
          </div>
        )}
      </fieldset>
      {frame && (
        <fieldset>
          <legend>{t("frameSize.orientation")}</legend>
          <div className="buttonList">
            <RadioSelection
              type="button"
              value={portrait}
              options={[
                {
                  value: false,
                  text: t("frameSize.landscape"),
                  icon: landscapeIcon,
                  testId: "frame-orientation-landscape",
                },
                {
                  value: true,
                  text: t("frameSize.portrait"),
                  icon: portraitIcon,
                  testId: "frame-orientation-portrait",
                },
              ]}
              onClick={(nextPortrait) => {
                if (nextPortrait !== portrait) {
                  onChange(orientFrameSize(frame, nextPortrait));
                }
              }}
            />
          </div>
        </fieldset>
      )}
    </>
  );
};
