import { useEffect, useState } from "react";

import { get } from "../api/client";

export interface AiStatus {
  available: boolean;
  reason?: "disabled" | "not_configured" | "not_allowed";
  remaining?: number | null;
}

/** Whether AI can be used in a workspace (drives showing the Text-to-diagram tab). */
export const useAiStatus = (workspaceId: string, enabled: boolean) => {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let alive = true;
    get(`/workspaces/${workspaceId}/ai/status`)
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus({ available: false }));
    return () => {
      alive = false;
    };
  }, [workspaceId, enabled]);
  return status;
};
