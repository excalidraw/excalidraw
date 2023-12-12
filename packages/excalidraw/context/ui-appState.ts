import React from "react";
import { UIAppState } from "../types";

export const UIAppStateContext = React.createContext<UIAppState>(null!);
export const useUIAppState = () => React.useContext(UIAppStateContext);
