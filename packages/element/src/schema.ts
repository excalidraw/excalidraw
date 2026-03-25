/**
 * Shared schema primitives used by element types and higher-level migrations.
 */
export const SCHEMA_INITIAL_TRACK_VERSION = 1 as const;

/** Core namespace reserved for built-in Excalidraw migrations. */
export const SCHEMA_CORE_NAMESPACE = "core" as const;
export type SchemaNamespace = typeof SCHEMA_CORE_NAMESPACE | `host.${string}`;

/**
 * A schema track is an independent version line:
 * - core tracks: "excalidraw.*"
 * - host tracks: "host.<appId>.<track>"
 */
export type SchemaTrack = `excalidraw.${string}` | `host.${string}.${string}`;
export type ElementSchemaState = Readonly<{
  tracks: Readonly<Record<string, number>>;
}>;

/** Core frame track id used by the frame background migration. */
export const CORE_FRAME_SCHEMA_TRACK = "excalidraw.shape.frame" as const;

/** Latest core track versions supported by this build. */
export const CORE_SUPPORTED_TRACKS = {
  [CORE_FRAME_SCHEMA_TRACK]: 2,
} as const;

const getRequiredCoreTracksForElementType = (type: string) => {
  if (type === "frame") {
    return {
      [CORE_FRAME_SCHEMA_TRACK]: CORE_SUPPORTED_TRACKS[CORE_FRAME_SCHEMA_TRACK],
    } as const;
  }

  return {} as const;
};

const isValidTrackVersion = (version: unknown): version is number =>
  typeof version === "number" &&
  Number.isInteger(version) &&
  version >= SCHEMA_INITIAL_TRACK_VERSION;

/**
 * Ensures an element schema state is normalized and satisfies type defaults.
 * Required core tracks are only ever bumped forward (never downgraded).
 */
export const ensureSchemaStateForElementType = (
  schemaState: ElementSchemaState | undefined,
  type: string,
): ElementSchemaState => {
  const requiredTracks = getRequiredCoreTracksForElementType(type);
  const currentTracks = schemaState?.tracks || {};
  const nextTracks: Record<string, number> = {};
  let didChange = !schemaState;

  for (const [track, version] of Object.entries(
    currentTracks as Record<string, unknown>,
  )) {
    if (isValidTrackVersion(version)) {
      nextTracks[track] = version;
      continue;
    }
    nextTracks[track] = SCHEMA_INITIAL_TRACK_VERSION;
    didChange = true;
  }

  for (const [track, requiredVersion] of Object.entries(requiredTracks)) {
    const currentVersion = nextTracks[track];
    if (
      !isValidTrackVersion(currentVersion) ||
      currentVersion < requiredVersion
    ) {
      nextTracks[track] = requiredVersion;
      didChange = true;
    }
  }

  if (!didChange) {
    return schemaState!;
  }

  return { tracks: nextTracks };
};

/**
 * Default schema state for newly created elements.
 * New frames are created at the latest supported frame track version.
 */
export const getDefaultSchemaStateForElementType = (
  type: string,
): ElementSchemaState => ensureSchemaStateForElementType(undefined, type);
