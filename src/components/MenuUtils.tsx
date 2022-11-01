import { GithubIcon, DiscordIcon, PlusPromoIcon, TwitterIcon } from "./icons";

export const MenuLinks = () => (
  <>
    <a
      href="https://plus.excalidraw.com/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger"
      target="_blank"
      rel="noreferrer"
      className="menu-item"
      style={{ color: "var(--color-promo)" }}
    >
      <div className="menu-item__icon">{PlusPromoIcon}</div>
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
    <a
      className="menu-item"
      target="_blank"
      href="https://twitter.com/excalidraw"
      rel="noopener noreferrer"
    >
      <div className="menu-item__icon">{TwitterIcon}</div>
      <div className="menu-item__text">Twitter</div>
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
