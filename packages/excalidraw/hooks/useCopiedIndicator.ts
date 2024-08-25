import { useEffect, useRef, useState } from "react";
import { copyIcon, tablerCheckIcon } from "../components/icons";

export const useCopiedIndicator = () => {
  const [copyCheck, setcopyCheck] = useState<boolean>(false);
  const [icon, setIcon] = useState(copyIcon);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (copyCheck) {
      setIcon(tablerCheckIcon);
      timeoutRef.current = setTimeout(() => {
        setcopyCheck(false);
      }, 2000);
      return () => {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
    setIcon(copyIcon);
  }, [copyCheck]);
  return {
    icon,
    setcopyCheck,
    copyCheck,
  };
};
