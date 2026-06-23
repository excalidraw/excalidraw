export type WorkspaceZoneId =
  | "mainMenu"
  | "toolbar"
  | "propertiesPanel"
  | "undoRedo"
  | "zoom"
  | "libraryButton";

export type WorkspaceZoneConfig = {
  offsetX: number;
  offsetY: number;
  visible: boolean;
  locked: boolean;
  /** only honored by zones that support resizing (propertiesPanel) */
  height?: number;
};

export type WorkspaceLayout = {
  /** whether the "Edit workspace layout" mode is active. Not persisted. */
  editing: boolean;
  /** sparse map of zone overrides; missing zones use defaults */
  zones: Partial<Record<WorkspaceZoneId, WorkspaceZoneConfig>>;
};

export const WORKSPACE_ZONE_IDS: readonly WorkspaceZoneId[] = [
  "mainMenu",
  "toolbar",
  "propertiesPanel",
  "undoRedo",
  "zoom",
  "libraryButton",
];

export const getDefaultWorkspaceZoneConfig = (): WorkspaceZoneConfig => ({
  offsetX: 0,
  offsetY: 0,
  visible: true,
  locked: false,
});

export const getDefaultWorkspaceLayout = (): WorkspaceLayout => ({
  editing: false,
  zones: {},
});

export const getWorkspaceZoneConfig = (
  workspaceLayout: WorkspaceLayout,
  zoneId: WorkspaceZoneId,
): WorkspaceZoneConfig => ({
  ...getDefaultWorkspaceZoneConfig(),
  ...workspaceLayout.zones[zoneId],
});

export const isWorkspaceLayoutValid = (
  workspaceLayout: unknown,
): workspaceLayout is WorkspaceLayout => {
  return (
    typeof workspaceLayout === "object" &&
    workspaceLayout !== null &&
    typeof (workspaceLayout as WorkspaceLayout).zones === "object" &&
    (workspaceLayout as WorkspaceLayout).zones !== null
  );
};
