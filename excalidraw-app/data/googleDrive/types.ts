/** Reference to a `.excalidraw` document stored in the user's Google Drive. */
export type DriveFile = {
  id: string;
  name: string;
};

/** A file returned from the Google Picker. */
export type PickedDriveFile = DriveFile & {
  mimeType: string;
};
