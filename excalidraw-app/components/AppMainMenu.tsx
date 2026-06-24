import {
  loginIcon,
  ExcalLogo,
  eyeIcon,
} from "@excalidraw/excalidraw/components/icons";
import {
  areAllTerraformRuntimeExperimentsEnabled,
  getTerraformRuntimePerformanceSnapshot,
  patchTerraformRuntimePerformanceSettings,
  resetTerraformRuntimePerformanceSettings,
  setAllTerraformRuntimeExperiments,
  subscribeTerraformRuntimePerformance,
  type TerraformRuntimePerformanceSettings,
} from "@excalidraw/excalidraw/components/terraformRuntimePerformance";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";
import { isExcalidrawPlusSignedUser } from "../app_constants";

import { saveDebugState } from "./DebugCanvas";

const TerraformRuntimePerformanceMenu = ({
  refresh,
}: {
  refresh: () => void;
}) => {
  const snapshot = React.useSyncExternalStore(
    subscribeTerraformRuntimePerformance,
    getTerraformRuntimePerformanceSnapshot,
    getTerraformRuntimePerformanceSnapshot,
  );
  const settings = snapshot.value;
  const update = (patch: Partial<TerraformRuntimePerformanceSettings>) => {
    patchTerraformRuntimePerformanceSettings(patch);
    refresh();
  };

  const toggle = (
    key: keyof Pick<
      TerraformRuntimePerformanceSettings,
      | "hideAwsIconGlyphsBelowZoom"
      | "suppressHoverFocusBelowZoom"
      | "debounceHoverFocus"
      | "suppressFrameClippingBelowZoom"
      | "skipBindingRepairDuringFocus"
    >,
    testId: string,
    label: string,
  ) => (
    <MainMenu.Item
      data-testid={testId}
      onSelect={(event) => {
        event.preventDefault();
        update({ [key]: !settings[key] });
      }}
    >
      <input type="checkbox" readOnly checked={settings[key]} /> {label}
    </MainMenu.Item>
  );

  return (
    <MainMenu.Sub>
      <MainMenu.Sub.Trigger data-testid="terraform-runtime-performance-submenu">
        Terraform canvas performance
      </MainMenu.Sub.Trigger>
      <MainMenu.Sub.Content>
        <MainMenu.Item
          data-testid="terraform-runtime-enable-all"
          onSelect={(event) => {
            event.preventDefault();
            setAllTerraformRuntimeExperiments(
              !areAllTerraformRuntimeExperimentsEnabled(settings),
            );
            refresh();
          }}
        >
          <input
            type="checkbox"
            readOnly
            checked={areAllTerraformRuntimeExperimentsEnabled(settings)}
          />{" "}
          Enable all experiments
        </MainMenu.Item>
        {toggle(
          "hideAwsIconGlyphsBelowZoom",
          "terraform-runtime-hide-icons",
          "Hide AWS icon primitives below threshold",
        )}
        {toggle(
          "suppressHoverFocusBelowZoom",
          "terraform-runtime-suppress-hover",
          "Suppress relationship hover below threshold",
        )}
        {toggle(
          "debounceHoverFocus",
          "terraform-runtime-debounce-hover",
          "Debounce relationship hover",
        )}
        {toggle(
          "suppressFrameClippingBelowZoom",
          "terraform-runtime-suppress-clipping",
          "Suppress Terraform frame clipping below threshold",
        )}
        {toggle(
          "skipBindingRepairDuringFocus",
          "terraform-runtime-skip-binding-repair",
          "Skip binding repair during focus updates",
        )}
        <MainMenu.Separator />
        {([0.2, 0.3, 0.4] as const).map((threshold) => (
          <MainMenu.Item
            key={threshold}
            data-testid={`terraform-runtime-threshold-${threshold * 100}`}
            onSelect={(event) => {
              event.preventDefault();
              update({ lowZoomThreshold: threshold });
            }}
          >
            <input
              type="radio"
              readOnly
              checked={settings.lowZoomThreshold === threshold}
            />{" "}
            {threshold * 100}% threshold
          </MainMenu.Item>
        ))}
        <MainMenu.Separator />
        <MainMenu.Item
          data-testid="terraform-runtime-reset"
          onSelect={(event) => {
            event.preventDefault();
            resetTerraformRuntimePerformanceSettings();
            refresh();
          }}
        >
          Reset experiments
        </MainMenu.Item>
      </MainMenu.Sub.Content>
    </MainMenu.Sub>
  );
};

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  refresh: () => void;
  frontendOnly?: boolean;
}> = React.memo((props) => {
  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      <MainMenu.DefaultItems.ImportTerraform />
      <MainMenu.DefaultItems.TerraformExpandAllToggle />
      <MainMenu.DefaultItems.TerraformLayers />
      <MainMenu.DefaultItems.TerraformZoomLod />
      <MainMenu.DefaultItems.TerraformCopyCanvasUrl />
      {props.isCollabEnabled && !props.frontendOnly && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      {!props.frontendOnly && (
        <>
          <MainMenu.Separator />
          <MainMenu.ItemLink
            icon={ExcalLogo}
            href={`${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger`}
            className=""
          >
            tfdraw.dev
          </MainMenu.ItemLink>
          <MainMenu.DefaultItems.Socials />
          <MainMenu.ItemLink
            icon={loginIcon}
            href={`${import.meta.env.VITE_APP_PLUS_APP}${
              isExcalidrawPlusSignedUser ? "" : "/sign-up"
            }?utm_source=signin&utm_medium=app&utm_content=hamburger`}
            className="highlighted"
          >
            {isExcalidrawPlusSignedUser ? "Sign in" : "Sign up"}
          </MainMenu.ItemLink>
        </>
      )}
      {isDevEnv() && (
        <>
          <TerraformRuntimePerformanceMenu refresh={props.refresh} />
          <MainMenu.Item
            icon={eyeIcon}
            onSelect={() => {
              if (window.visualDebug) {
                delete window.visualDebug;
                saveDebugState({ enabled: false });
              } else {
                window.visualDebug = { data: [] };
                saveDebugState({ enabled: true });
              }
              props?.refresh();
            }}
          >
            Visual Debug
          </MainMenu.Item>
        </>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme
        allowSystemTheme
        theme={props.theme}
        onSelect={props.setTheme}
      />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
