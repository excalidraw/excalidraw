import { Center } from "./WelcomeScreen.Center";
import { MenuHint, ToolbarHint, HelpHint } from "./WelcomeScreen.Hints";

import "./WelcomeScreen.scss";

const WelcomeScreen = (props: { children: React.ReactNode }) => {
  // NOTE this component is used as a dummy wrapper to retrieve child props
  // from, and will never be rendered to DOM directly. As such, we can't
  // do anything here (use hooks and such)
  return null;
};
WelcomeScreen.displayName = "WelcomeScreen";

WelcomeScreen.Center = Center;
WelcomeScreen.Hints = { MenuHint, ToolbarHint, HelpHint };

export default WelcomeScreen;
