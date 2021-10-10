export const IV_LENGTH_BYTES = 12;

export const createIV = () => {
  const arr = new Uint8Array(IV_LENGTH_BYTES);
  return window.crypto.getRandomValues(arr);
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

export const encryptData = async (
  key: string,
  data: Uint8Array | Blob | File | string,
): Promise<{ encryptedBuffer: ArrayBuffer; iv: Uint8Array }> => {
  const importedKey = await getImportedKey(key, "encrypt");
  const iv = createIV();
  const buffer =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
      ? data
      : new Uint8Array(await data.arrayBuffer());

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    importedKey,
    buffer,
  );

  return { encryptedBuffer, iv };
};

export const decryptData = async (
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
