import { ExternalLinkIcon, GithubIcon, DiscordIcon } from "./icons";

export const MenuLinks = () => (
  <>
    <a
      href="https://plus.excalidraw.com/plus?utm_source=excalidraw&utm_medium=banner&utm_campaign=launch"
      target="_blank"
      rel="noreferrer"
      className="menu-item"
    >
      <div className="menu-item__icon">{ExternalLinkIcon}</div>
      <div className="menu-item__text">Excalidraw+</div>
    </a>
    <a
      className="menu-item"
      href="https://github.com/excalidraw/excalidraw"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="menu-item__icon">{GithubIcon}</div>
      <div className="menu-item__text">GitHub</div>
    </a>
    <a
      className="menu-item"
      target="_blank"
      href="https://discord.gg/UexuTaE"
      rel="noopener noreferrer"
    >
      <div className="menu-item__icon">{DiscordIcon}</div>
      <div className="menu-item__text">Discord</div>
    </a>
  </>
);

export const Separator = () => (
  <div
    style={{
      height: "1px",
      backgroundColor: "var(--default-border-color)",
      margin: ".5rem 0",
    }}
  />
);
