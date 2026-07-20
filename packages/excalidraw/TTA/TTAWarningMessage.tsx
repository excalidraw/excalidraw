import "./TTAWarningMessage.scss";

import type { ReactNode } from "react";

export const TTAWarningMessage = ({ children }: { children: ReactNode }) => {
  if (children === null || children === undefined || children === false) {
    return null;
  }

  return (
    <div className="tta-warning-message" role="alert" aria-live="polite">
      {children}
    </div>
  );
};
