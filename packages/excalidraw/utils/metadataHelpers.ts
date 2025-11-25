export const jsonToKVArray = (json: any): { key: string; value: string }[] => {
  if (!json || typeof json !== "object") {
    return [];
  }
  return Object.entries(json).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
};

export const kvArrayToJson = (kv: { key: string; value: string }[]): any => {
  const obj: any = {};
  kv.forEach(({ key, value }) => {
    if (key.trim()) {
      try {
        /** Attempt to parse string values as JSON to preserve types. */
        obj[key.trim()] = JSON.parse(value);
      } catch {
        /** Fallback to raw string if JSON parsing fails. */
        obj[key.trim()] = value;
      }
    }
  });
  return obj;
};

export const isValidJson = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};
