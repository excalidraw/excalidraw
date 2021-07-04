import { serializeAsJSON } from "../../data/json";
import { restore } from "../../data/restore";
import { ImportedDataState } from "../../data/types";
import { ExcalidrawElement } from "../../element/types";
import { t } from "../../i18n";
import { AppState, UserIdleState } from "../../types";

const byteToHex = (byte: number): string => `0${byte.toString(16)}`.slice(-2);

const BACKEND_GET = process.env.REACT_APP_BACKEND_V1_GET_URL;
const BACKEND_V2_GET = process.env.REACT_APP_BACKEND_V2_GET_URL;
const BACKEND_V2_POST = process.env.REACT_APP_BACKEND_V2_POST_URL;

const generateRandomID = async () => {
  const arr = new Uint8Array(10);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, byteToHex).join("");
};

export const generateEncryptionKey = async () => {
  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 128,
    },
    true, // extractable
    ["encrypt", "decrypt"],
  );
  return (await window.crypto.subtle.exportKey("jwk", key)).k;
};

export const SOCKET_SERVER = process.env.REACT_APP_SOCKET_SERVER_URL;

export type EncryptedData = {
  data: ArrayBuffer;
  iv: Uint8Array;
};

export type SocketUpdateDataSource = {
  SCENE_INIT: {
    type: "SCENE_INIT";
    payload: {
      elements: readonly ExcalidrawElement[];
    };
  };
  SCENE_UPDATE: {
    type: "SCENE_UPDATE";
    payload: {
      elements: readonly ExcalidrawElement[];
    };
  };
  MOUSE_LOCATION: {
    type: "MOUSE_LOCATION";
    payload: {
      socketId: string;
      pointer: { x: number; y: number };
      button: "down" | "up";
      selectedElementIds: AppState["selectedElementIds"];
      username: string;
    };
  };
  IDLE_STATUS: {
    type: "IDLE_STATUS";
    payload: {
      socketId: string;
      userState: UserIdleState;
      username: string;
    };
  };
};

export type SocketUpdateDataIncoming =
  | SocketUpdateDataSource[keyof SocketUpdateDataSource]
  | {
      type: "INVALID_RESPONSE";
    };

export type SocketUpdateData = SocketUpdateDataSource[keyof SocketUpdateDataSource] & {
  _brand: "socketUpdateData";
};

const IV_LENGTH_BYTES = 12; // 96 bits

export const createIV = () => {
  const arr = new Uint8Array(IV_LENGTH_BYTES);
  return window.crypto.getRandomValues(arr);
};

export const encryptAESGEM = async (
  data: Uint8Array,
  key: string,
): Promise<EncryptedData> => {
  const importedKey = await getImportedKey(key, "encrypt");
  const iv = createIV();
  return {
    data: await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      importedKey,
      data,
    ),
    iv,
  };
};

export const decryptAESGEM = async (
  data: ArrayBuffer,
  key: string,
  iv: Uint8Array,
): Promise<SocketUpdateDataIncoming> => {
  try {
    const importedKey = await getImportedKey(key, "decrypt");
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      importedKey,
      data,
    );

    const decodedData = new TextDecoder("utf-8").decode(
      new Uint8Array(decrypted) as any,
    );
    return JSON.parse(decodedData);
  } catch (error) {
    window.alert(t("alerts.decryptFailed"));
    console.error(error);
  }
  return {
    type: "INVALID_RESPONSE",
  };
};

export const getCollaborationLinkData = (link: string) => {
  const hash = new URL(link).hash;
  const match = hash.match(/^#room=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/);
  return match ? { roomId: match[1], roomKey: match[2] } : null;
};

export const generateCollaborationLinkData = async () => {
  const roomId = await generateRandomID();
  const roomKey = await generateEncryptionKey();

  if (!roomKey) {
    throw new Error("Couldn't generate room key");
  }

  return { roomId, roomKey };
};

export const getCollaborationLink = (data: {
  roomId: string;
  roomKey: string;
}) => {
  return `${window.location.origin}${window.location.pathname}#room=${data.roomId},${data.roomKey}`;
};

export const getImportedKey = (key: string, usage: KeyUsage) =>
  window.crypto.subtle.importKey(
    "jwk",
    {
      alg: "A128GCM",
      ext: true,
      k: key,
      key_ops: ["encrypt", "decrypt"],
      kty: "oct",
    },
    {
      name: "AES-GCM",
      length: 128,
    },
    false, // extractable
    [usage],
  );

export const decryptImported = async (
  iv: ArrayBuffer,
  encrypted: ArrayBuffer,
  privateKey: string,
): Promise<ArrayBuffer> => {
  const key = await getImportedKey(privateKey, "decrypt");
  return window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encrypted,
  );
};

const importFromBackend = async (
  id: string | null,
  privateKey?: string | null,
): Promise<ImportedDataState> => {
  try {
    const response = await fetch(
      privateKey ? `${BACKEND_V2_GET}${id}` : `${BACKEND_GET}${id}.json`,
    );

    if (!response.ok) {
      window.alert(t("alerts.importBackendFailed"));
      return {};
    }
    let data: ImportedDataState;
    if (privateKey) {
      const buffer = await response.arrayBuffer();

      let decrypted: ArrayBuffer;
      try {
        // Buffer should contain both the IV (fixed length) and encrypted data
        const iv = buffer.slice(0, IV_LENGTH_BYTES);
        const encrypted = buffer.slice(IV_LENGTH_BYTES, buffer.byteLength);
        decrypted = await decryptImported(iv, encrypted, privateKey);
      } catch (error) {
        // Fixed IV (old format, backward compatibility)
        const fixedIv = new Uint8Array(IV_LENGTH_BYTES);
        decrypted = await decryptImported(fixedIv, buffer, privateKey);
      }

      // We need to convert the decrypted array buffer to a string
      const string = new window.TextDecoder("utf-8").decode(
        new Uint8Array(decrypted) as any,
      );
      data = JSON.parse(string);
    } else {
      // Legacy format
      data = await response.json();
    }

    return {
      elements: data.elements || null,
      appState: data.appState || null,
    };
  } catch (error) {
    window.alert(t("alerts.importBackendFailed"));
    console.error(error);
    return {};
  }
};

export const loadScene = async (
  id: string | null,
  privateKey: string | null,
  // Supply local state even if importing from backend to ensure we restore
  // localStorage user settings which we do not persist on server.
  // Non-optional so we don't forget to pass it even if `undefined`.
  localDataState: ImportedDataState | undefined | null,
) => {
  let data;
  if (id != null) {
    // the private key is used to decrypt the content from the server, take
    // extra care not to leak it
    data = restore(
      await importFromBackend(id, privateKey),
      localDataState?.appState,
      localDataState?.elements,
    );
  } else {
    data = restore(localDataState || null, null, null);
  }

  return {
    elements: data.elements,
    appState: data.appState,
    commitToHistory: false,
  };
};

export const exportToBackend = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const json = serializeAsJSON(elements, appState);
  const encoded = new TextEncoder().encode(json);

  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 128,
    },
    true, // extractable
    ["encrypt", "decrypt"],
  );

  const iv = createIV();
  // We use symmetric encryption. AES-GCM is the recommended algorithm and
  // includes checks that the ciphertext has not been modified by an attacker.
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encoded,
  );

  // Concatenate IV with encrypted data (IV does not have to be secret).
  const payloadBlob = new Blob([iv.buffer, encrypted]);
  const payload = await new Response(payloadBlob).arrayBuffer();

  // We use jwk encoding to be able to extract just the base64 encoded key.
  // We will hardcode the rest of the attributes when importing back the key.
  const exportedKey = await window.crypto.subtle.exportKey("jwk", key);

  try {
    const response = await fetch(BACKEND_V2_POST, {
      method: "POST",
      body: payload,
    });
    const json = await response.json();
    if (json.id) {
      const url = new URL(window.location.href);
      // We need to store the key (and less importantly the id) as hash instead
      // of queryParam in order to never send it to the server
      url.hash = `json=${json.id},${exportedKey.k!}`;
      const urlString = url.toString();
      window.prompt(`🔒${t("alerts.uploadedSecurly")}`, urlString);
    } else if (json.error_class === "RequestTooLargeError") {
      window.alert(t("alerts.couldNotCreateShareableLinkTooBig"));
    } else {
      window.alert(t("alerts.couldNotCreateShareableLink"));
    }
  } catch (error) {
    console.error(error);
    window.alert(t("alerts.couldNotCreateShareableLink"));
  }
};
