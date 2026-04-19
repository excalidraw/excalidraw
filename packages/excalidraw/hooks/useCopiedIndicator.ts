import { useCallback, useEffect, useRef, useState } from "react";

const TIMEOUT = 2000;

export const useCopyStatus = () => {
  const [copyStatus, setCopyStatus] = useState<"success" | null>(null);
  const timeoutRef = useRef<number>(0);

  // clear any pending timeout on unmount to avoid setting state on an
  // unmounted component (e.g. dialog closed within the success-indicator window)
  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const onCopy = () => {
    clearTimeout(timeoutRef.current);
    setCopyStatus("success");

    timeoutRef.current = window.setTimeout(() => {
      setCopyStatus(null);
    }, TIMEOUT);
  };

  const resetCopyStatus = useCallback(() => {
    setCopyStatus(null);
  }, []);

  return {
    copyStatus,
    resetCopyStatus,
    onCopy,
  };
};
