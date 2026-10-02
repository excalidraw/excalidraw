const SAFE_KEY = /^[A-Za-z0-9_\-./]+$/;

/** Storage keys are built from ids we generate; anything else (traversal, odd chars) is refused. */
export const assertSafeKey = (key: string) => {
  if (
    !SAFE_KEY.test(key) ||
    key.split("/").some((p) => p === ".." || p === "" || p === ".")
  ) {
    throw new Error("invalid storage key");
  }
  return key;
};
