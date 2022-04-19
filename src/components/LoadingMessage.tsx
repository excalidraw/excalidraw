import { t } from "../i18n";
import { useState, useEffect } from "react";
import Spinner from "./Spinner";

export const LoadingMessage: React.FC<{ delay?: number }> = ({ delay }) => {
  const [isWaiting, setIsWaiting] = useState(!!delay);

  useEffect(() => {
    if (!delay) {
      return;
    }
    const timer = setTimeout(() => {
      setIsWaiting(false);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (isWaiting) {
    return null;
  }

  return (
    <div className="LoadingMessage">
      <div>
        <Spinner />
      </div>
      <div className="LoadingMessage-text">{t("labels.loadingScene")}</div>
    </div>
  );
};
