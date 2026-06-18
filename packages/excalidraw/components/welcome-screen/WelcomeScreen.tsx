import { Center } from "./WelcomeScreen.Center";
import {
  HelpHint,
  MenuHint,
  SelectionToolHint,
  ToolbarHint,
} from "./WelcomeScreen.Hints";

import "./WelcomeScreen.scss";

const WelcomeScreen = (props: { children?: React.ReactNode }) => {
  return (
    <>
      {props.children || (
        <>
          <Center />
          <MenuHint />
          <SelectionToolHint />
          <HelpHint />
        </>
      )}
    </>
  );
};

WelcomeScreen.displayName = "WelcomeScreen";

WelcomeScreen.Center = Center;
WelcomeScreen.Hints = { HelpHint, MenuHint, SelectionToolHint, ToolbarHint };

export default WelcomeScreen;
