import { GithubIcon, DiscordIcon, TwitterIcon } from "../icons";
import MenuItem from "./MenuItem";

const MenuSocials = () => (
  <>
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
MenuSocials.displayName = "MenuSocials";
