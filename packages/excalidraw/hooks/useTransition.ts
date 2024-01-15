import React, { useCallback } from "react";

/** noop polyfill for v17. Subset of API available */
function useTransitionPolyfill() {
  const startTransition = useCallback((callback: () => void) => callback(), []);
  return [false, startTransition] as const;
}

export const useTransition = React.useTransition || useTransitionPolyfill;
