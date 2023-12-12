import { useRef } from "react";

export const useStable = <T extends Record<string, any>>(value: T) => {
  const ref = useRef<T>(value);
  Object.assign(ref.current, value);
  return ref.current;
};
