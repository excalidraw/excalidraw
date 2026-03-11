/**
 * Fork attribution banner — credits Excalidraw as the foundation.
 * Replaces the Excalidraw+ promo for the Luzmo Flexcalidraw fork.
 */
export const ExcalidrawPlusPromoBanner = () => {
  return (
    <div className="plus-banner attribution-banner">
      <span className="attribution-banner__text">Built on</span>
      <a
        href="https://excalidraw.com?utm_source=flexcalidraw&utm_medium=app&utm_content=attribution_banner"
        target="_blank"
        rel="noopener noreferrer"
        className="attribution-banner__link"
        title="Visit Excalidraw"
      >
        Excalidraw
      </a>
      <span className="attribution-banner__separator">+</span>
      <a
        href="https://luzmo.com/flex?utm_source=flexcalidraw&utm_medium=app&utm_content=attribution_banner"
        target="_blank"
        rel="noopener noreferrer"
        className="attribution-banner__link"
        title="Visit Luzmo Flex"
      >
        Luzmo Flex
      </a>
    </div>
  );
};
