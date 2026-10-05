import { useEffect, useState } from "react";

import type { Emitter } from "@excalidraw/common";

export const useEmitter = <TEvent extends unknown>(
  emitter: Emitter<[TEvent]>,
  initialState: TEvent,
) => {
  const [event, setEvent] = useState<TEvent>(initialState);

  useEffect(() => {
    const unsubscribe = emitter.on((event) => {
      setEvent(event);
    });

    return () => {
      unsubscribe();
    };
  }, [emitter]);

  return event;
};
