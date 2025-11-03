import { useState } from "react";

import { getFeatureFlag, setFeatureFlag } from "@excalidraw/common";
import * as Sentry from "@sentry/browser";

import { CheckboxItem } from "../CheckboxItem";
import { Dialog } from "../Dialog";
import { CloseIcon } from "../icons";
import { useExcalidrawSetAppState } from "../App";
import { useUIAppState } from "../../context/ui-appState";
import { t } from "../../i18n";

import "./Settings.scss";

export const DEFAULT_SETTINGS_CATEGORIES = {
  experimental: t("settings.experimental"),
};

const getCategoryOrder = (category: string) => {
  switch (category) {
    case DEFAULT_SETTINGS_CATEGORIES.experimental:
      return 1;
    default:
      return 10;
  }
};

type SettingItem = {
  label: string;
  category: string;
  flagKey: "COMPLEX_BINDINGS";
  getValue: () => boolean;
  setValue: (value: boolean) => void;
};

export const Settings = () => {
  const uiAppState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();

  const settings: SettingItem[] = [
    {
      label: t("settings.binding"),
      category: DEFAULT_SETTINGS_CATEGORIES.experimental,
      flagKey: "COMPLEX_BINDINGS",
      getValue: () => getFeatureFlag("COMPLEX_BINDINGS"),
      setValue: (value: boolean) => {
        const flagsIntegration =
          Sentry.getClient()?.getIntegrationByName<Sentry.FeatureFlagsIntegration>(
            "FeatureFlags",
          );
        if (flagsIntegration) {
          flagsIntegration.addFeatureFlag("COMPLEX_BINDINGS", value);
        }

        setFeatureFlag("COMPLEX_BINDINGS", value);
      },
    },
  ];

  const [settingStates, setSettingStates] = useState<Record<string, boolean>>(
    () => {
      const initialStates: Record<string, boolean> = {};
      settings.forEach((setting) => {
        initialStates[setting.flagKey] = setting.getValue();
      });
      return initialStates;
    },
  );

  if (uiAppState.openDialog?.name !== "settings") {
    return null;
  }

  const closeSettings = () => {
    setAppState({
      openDialog: null,
    });
  };

  const handleToggle = (setting: SettingItem, checked: boolean) => {
    setting.setValue(checked);
    setSettingStates((prev) => ({
      ...prev,
      [setting.flagKey]: checked,
    }));
  };

  const settingsByCategory = settings
    .sort(
      (a, b) =>
        getCategoryOrder(a.category) - getCategoryOrder(b.category) ||
        a.label.localeCompare(b.label),
    )
    .reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {} as Record<string, SettingItem[]>);

  return (
    <Dialog
      onCloseRequest={closeSettings}
      closeOnClickOutside
      title={t("settings.title")}
      size={720}
      autofocus
      className="settings-dialog"
    >
      <button
        className="Dialog__close"
        onClick={closeSettings}
        title={t("buttons.close")}
        aria-label={t("buttons.close")}
        type="button"
      >
        {CloseIcon}
      </button>
      <div className="settings-content">
        {Object.entries(settingsByCategory).map(([category, items]) => (
          <div key={category} className="settings-category">
            <div className="settings-category-title">{category}</div>
            <div className="settings-category-items">
              {items.map((setting) => (
                <div key={setting.flagKey} className="settings-item">
                  <CheckboxItem
                    checked={settingStates[setting.flagKey] ?? false}
                    onChange={(checked) => handleToggle(setting, checked)}
                  >
                    {setting.label}
                  </CheckboxItem>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
};
