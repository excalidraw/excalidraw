export const Utils = {
  try<T>(cb: () => T): [T, null] | [null, Error] {
    try {
      const result = cb();
      return [result, null];
    } catch (error) {
      if (error instanceof Error) {
        return [null, error];
      }

      if (typeof error === "string") {
        return [null, new Error(error)];
      }

      return [null, new Error("Unknown error")];
    }
  },
};
