import { useCallback, useRef, useState } from "react";

const TIMEOUT = 2000;

export const useCopyStatus = () => {
  const [copyStatus, setCopyStatus] = useState<"success" | null>(null);
  const timeoutRef = useRef<number>(0);

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
