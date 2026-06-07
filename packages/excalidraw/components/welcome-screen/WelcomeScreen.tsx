import { Center } from "./WelcomeScreen.Center";
import { MenuHint, ToolbarHint, HelpHint, LibraryHint } from "./WelcomeScreen.Hints";

import "./WelcomeScreen.scss";

const WelcomeScreen = (props: { children?: React.ReactNode }) => {
  return (
    <>
      {props.children || (
        <>
          <Center />
          <MenuHint />
          <LibraryHint />
          <ToolbarHint />
          <HelpHint />
        </>
      )}
    </>
  );
};

WelcomeScreen.displayName = "WelcomeScreen";

WelcomeScreen.Center = Center;
WelcomeScreen.Hints = { MenuHint, ToolbarHint, HelpHint, LibraryHint };

export default WelcomeScreen;
