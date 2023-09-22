import { useReducer, useCallback, useRef } from "react";

type Status = "idle" | "pending" | "resolved" | "rejected";

type Action<T> =
  | { type: "start" }
  | { type: "resolve"; payload: T }
  | { type: "reject"; payload: Error };

type State<T> = {
  status: Status;
  result: T | null;
  error: Error | null;
};

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case "start":
      return { ...state, status: "pending" };
    case "resolve":
      return { status: "resolved", result: action.payload, error: null };
    case "reject":
      return { status: "rejected", result: null, error: action.payload };
    default:
      throw new Error("Unhandled action type");
  }
}

export function useSuspendable<T>(): [
  T | null,
  Error | null,
  Status,
  (promise: Promise<T>) => Promise<void>,
  Promise<T> | null,
] {
  const [state, dispatch] = useReducer(reducer, {
    status: "idle",
    result: null,
    error: null,
  });

  const pendingPromise = useRef<Promise<T> | null>(null);

  const suspend = useCallback((promise: Promise<T>) => {
    pendingPromise.current = promise;
    dispatch({ type: "start" });
    return promise
      .then((data) => {
        dispatch({ type: "resolve", payload: data });
      })
      .catch((error) => {
        dispatch({ type: "reject", payload: error as Error });
      });
  }, []);

  return [
    state.result as T | null,
    state.error,
    state.status,
    suspend,
    pendingPromise.current,
  ];
}
