import { GithubIcon, DiscordIcon, PlusPromoIcon, TwitterIcon } from "../icons";
import MenuItem from "./MenuItem";

const MenuSocials = () => (
  <>
    <MenuItem
      icon={PlusPromoIcon}
      link="https://plus.excalidraw.com/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger"
      className="ExcalidrawPlus"
    >
      Excalidraw+
    </MenuItem>
    <MenuItem icon={GithubIcon} link="https://github.com/excalidraw/excalidraw">
      GitHub
    </MenuItem>
    <MenuItem icon={DiscordIcon} link="https://discord.gg/UexuTaE">
      Discord
    </MenuItem>
    <MenuItem icon={TwitterIcon} link="https://twitter.com/excalidraw">
      Twitter
    </MenuItem>
  </>
);

export default MenuSocials;
