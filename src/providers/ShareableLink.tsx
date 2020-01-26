import React, { useReducer } from "react";

export type ShareableLinkState = {
  url: string;
  fetching: boolean;
  error: boolean;
  userResquested: boolean;
};

export const initialState: ShareableLinkState = {
  url: "",
  fetching: false,
  error: false,
  userResquested: false,
};

export const initialDispatch: React.Dispatch<ShareableLinkAction> = () => {};

export const ShareableLinkContextState = React.createContext(initialState);
export const ShareableLinkContextDispatch = React.createContext(
  initialDispatch,
);

type ShareableLinkAction =
  | { type: "userRequested" }
  | { type: "fetch" }
  | { type: "success"; url: string }
  | { type: "reset" }
  | { type: "fail" };

const shareableLinkReducer = (
  state: ShareableLinkState,
  action: ShareableLinkAction,
) => {
  switch (action.type) {
    case "userRequested":
      return {
        ...initialState,
        userResquested: true,
      };
    case "fetch":
      return { ...state, fetching: true };
    case "success":
      return { ...state, url: action.url, fetching: false };
    case "fail":
      return { ...state, fetching: false, error: true };
    case "reset":
      return { ...initialState };
    default:
      throw new Error();
  }
};

type ShareableLinkProviderProps = {
  children: React.ReactNode;
};

export function ShareableLinkProvider({
  children,
}: ShareableLinkProviderProps) {
  const [state, dispatch] = useReducer(shareableLinkReducer, initialState);
  return (
    <ShareableLinkContextState.Provider value={state}>
      <ShareableLinkContextDispatch.Provider value={dispatch}>
        {children}
      </ShareableLinkContextDispatch.Provider>
    </ShareableLinkContextState.Provider>
  );
}

export function useSharebleLink(): [
  ShareableLinkState,
  React.Dispatch<ShareableLinkAction>,
] {
  const state = React.useContext(ShareableLinkContextState);
  const dispatch = React.useContext(ShareableLinkContextDispatch);
  return [state, dispatch];
}
