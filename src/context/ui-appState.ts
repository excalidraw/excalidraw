import React from "react";
import { AppState } from "../types";

export const UIAppStateContext = React.createContext<AppState>(null!);
export const useUIAppState = () => React.useContext(UIAppStateContext);
